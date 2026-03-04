import { format } from "date-fns";
import * as XLSX from "xlsx";
import { useScheduleStore } from "../store.ts";
import type { Provider, ShiftSlot } from "../store.ts";

const LARGE_FILE_WARNING_BYTES = 5 * 1024 * 1024;
const WORKER_PARSE_TIMEOUT_MS = 120_000;

const COLUMN_HEADERS = [
  "Month / Date",
  "G20",
  "H22",
  "Akron",
  "Nights",
  "Consults",
  "AMET / NMET",
  "Jeopardy",
  "Recovery",
  "Vacations",
] as const;

/** Excel column mapping for MASTER_NEW_CALENDAR format (trimmed keys) */
const EXCEL_MASTER_COLUMNS: Record<string, ImportFieldKey> = {
  "Month": "date",
  "G20": "dayG20",
  "H22": "dayH22",
  "Akron": "dayAkron",
  "Nights": "night",
  "Consults": "consults",
  "AMET": "nmet",
  "NMET": "nmet",
  "Jeopardy": "jeopardy",
  "Recovery": "recovery",
  "Vacations": "vacation",
};

const slotToColumnMap: Record<string, number> = {
  "DAY-G20": 1,
  "DAY-H22": 2,
  "DAY-Akron": 3,
  "NIGHT-Main Campus": 4,
  "NIGHT-0": 4,
  "CONSULTS-Main Campus": 5,
  "CONSULTS-0": 5,
  "NMET-Main Campus": 6,
  "NMET-0": 6,
  "JEOPARDY-Main Campus": 7,
  "JEOPARDY-0": 7,
  "RECOVERY-Main Campus": 8,
  "RECOVERY-0": 8,
  "VACATION-Any": 9,
  "VACATION-0": 9,
};

const IMPORT_FIELDS = ["date", "dayG20", "dayH22", "dayAkron", "night", "consults", "nmet", "jeopardy", "recovery", "vacation"] as const;
type AssignmentImportFieldKey = Exclude<ImportFieldKey, "date">;
const ASSIGNMENT_IMPORT_FIELDS: AssignmentImportFieldKey[] = IMPORT_FIELDS.filter((field): field is AssignmentImportFieldKey => field !== "date");

export type ImportFieldKey = typeof IMPORT_FIELDS[number];

export type ExcelErrorCode =
  | "HEADER_MAPPING_FAILED"
  | "IMPORT_PARSE_FAILED"
  | "IMPORT_APPLY_FAILED"
  | "ROLLBACK_FAILED"
  | "EXPORT_FAILED"
  | "WORKER_FAILED"
  | "WORKER_TIMEOUT";

interface ExcelErrorOptions {
  details?: Record<string, unknown>;
  originalError?: unknown;
}

export class ExcelError extends Error {
  public readonly code: ExcelErrorCode;

  public readonly details?: Record<string, unknown>;

  public readonly originalError?: unknown;

  constructor(code: ExcelErrorCode, message: string, options: ExcelErrorOptions = {}) {
    super(message);
    this.name = "ExcelError";
    this.code = code;
    this.details = options.details;
    this.originalError = options.originalError;
  }
}

const toExcelError = (
  error: unknown,
  code: ExcelErrorCode,
  fallbackMessage: string,
  details?: Record<string, unknown>,
): ExcelError => {
  if (error instanceof ExcelError) {
    return error;
  }

  const resolvedDetails: Record<string, unknown> = {
    ...(details ?? {}),
  };

  if (error instanceof Error) {
    resolvedDetails.originalMessage = error.message;
  }

  return new ExcelError(code, fallbackMessage, {
    details: Object.keys(resolvedDetails).length > 0 ? resolvedDetails : undefined,
    originalError: error,
  });
};

export type ImportIssueType = "error" | "warning";

export interface BaseImportIssue {
  type: ImportIssueType;
  code: string;
  message: string;
  rowIndex?: number;
  column?: string;
  action?: string;
}

export interface FileSizeWarning extends BaseImportIssue {
  type: "warning";
  code: "FILE_SIZE_WARNING";
  fileSizeBytes: number;
  maxRecommendedBytes: number;
}

export type ImportIssue = BaseImportIssue | FileSizeWarning;

export interface ImportPreviewRow {
  date: string;
  assignments: Partial<Record<ImportFieldKey, string[]>>;
  /** Detailed assignment info with multi-provider support */
  parsedAssignments?: Partial<Record<ImportFieldKey, ParsedAssignment>>;
  issues: ImportIssue[];
}

export interface ImportPreviewResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  requiresMapping: boolean;
  availableHeaders: string[];
  mapping: Partial<Record<ImportFieldKey, string>>;
  aiSuggestedMapping?: Partial<Record<ImportFieldKey, string>>;
  aiConfidence?: number;
  issues: ImportIssue[];
  rows: ImportPreviewRow[];
}

export interface ExcelOperationResult {
  success: boolean;
  error?: ExcelError;
}

export interface ApplyImportResult extends ExcelOperationResult {
  appliedAssignments: number;
  skippedRows: number;
}

export interface ParseImportWorkerRequest {
  type: "parse";
  fileName: string;
  fileSize: number;
  data: ArrayBuffer;
  manualMapping?: Partial<Record<ImportFieldKey, string>>;
}

export interface ParseImportWorkerProgressResponse {
  type: "progress";
  percent: number;
}

export interface ParseImportWorkerResultResponse {
  type: "result";
  result: ImportPreviewResult;
}

export interface ParseImportWorkerErrorResponse {
  type: "error";
  error: {
    code: ExcelErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ParseImportWorkerResponse = ParseImportWorkerProgressResponse | ParseImportWorkerResultResponse | ParseImportWorkerErrorResponse;

const HEADER_ALIASES: Record<ImportFieldKey, string[]> = {
  date: ["month / date", "month", "date", "schedule date", "month / date ", "month "],
  dayG20: ["g20", "g20 unit", "day g20", "g20 "],
  dayH22: ["h22", "h22 unit", "day h22", "h22 "],
  dayAkron: ["akron", "akron unit", "day akron", "akron "],
  night: ["nights", "night", "overnight", "nights "],
  consults: ["consults", "consult", "consult service", "consults "],
  nmet: ["amet / nmet", "nmet", "amet", "airway", "amet ", "amet / nmet "],
  jeopardy: ["jeopardy", "backup", "backup jeopardy"],
  recovery: ["recovery", "post call", "post-call"],
  vacation: ["vacations", "vacation", "time off", "pto", "vacations "],
};

const REQUIRED_FIELDS: ImportFieldKey[] = ["date", "night"];

interface ImportSnapshot {
  providers: Provider[];
  slots: ShiftSlot[];
}

let lastImportSnapshot: ImportSnapshot | null = null;

type ProgressCallback = (percent: number) => void;
type WorksheetRow = Record<string, unknown>;
type ExportSheetCell = string | number | Date | null;

const fieldToSlotSpec: Partial<Record<ImportFieldKey, {
  type: ShiftSlot["type"];
  locationIncludes: string;
  serviceLocation: string;
}>> = {
  dayG20: { type: "DAY", locationIncludes: "G20", serviceLocation: "G20" },
  dayH22: { type: "DAY", locationIncludes: "H22", serviceLocation: "H22" },
  dayAkron: { type: "DAY", locationIncludes: "Akron", serviceLocation: "Akron" },
  night: { type: "NIGHT", locationIncludes: "Nights", serviceLocation: "Nights" },
  consults: { type: "CONSULTS", locationIncludes: "Consults", serviceLocation: "Consults" },
  nmet: { type: "NMET", locationIncludes: "AMET", serviceLocation: "AMET" },
  jeopardy: { type: "JEOPARDY", locationIncludes: "Jeopardy", serviceLocation: "Jeopardy" },
  recovery: { type: "RECOVERY", locationIncludes: "Recovery", serviceLocation: "Recovery" },
  vacation: { type: "VACATION", locationIncludes: "Vacation", serviceLocation: "Vacation" },
};

const reportProgress = (onProgress: ProgressCallback | undefined, percent: number) => {
  if (!onProgress) {
    return;
  }

  const boundedPercent = Math.max(0, Math.min(100, Math.round(percent)));
  try {
    onProgress(boundedPercent);
  } catch {
    return;
  }
};

const createImportSnapshot = (providers: Provider[], slots: ShiftSlot[]): ImportSnapshot => ({
  providers: structuredClone(providers),
  slots: structuredClone(slots),
});

const createFileSizeWarning = (fileName: string, fileSizeBytes: number): FileSizeWarning | null => {
  if (fileSizeBytes <= LARGE_FILE_WARNING_BYTES) {
    return null;
  }

  return {
    type: "warning",
    code: "FILE_SIZE_WARNING",
    message: `The file '${fileName}' is ${(fileSizeBytes / (1024 * 1024)).toFixed(2)}MB. Large files may take longer to parse.`,
    action: "Continue import or split the workbook into smaller files for faster previews.",
    fileSizeBytes,
    maxRecommendedBytes: LARGE_FILE_WARNING_BYTES,
  };
};

const saveBlobToFile = (blob: Blob, fileName: string) => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new ExcelError("EXPORT_FAILED", "File export is only available in browser environments.");
  }

  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
};

const createEmptyImportPreview = (fileName: string, issues: ImportIssue[]): ImportPreviewResult => ({
  fileName,
  totalRows: 0,
  validRows: 0,
  invalidRows: 0,
  requiresMapping: false,
  availableHeaders: [],
  mapping: {},
  issues,
  rows: [],
});

export const normalizeHeader = (header: unknown): string => {
  try {
    return String(header ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  } catch {
    return "";
  }
};

// Common name corrections for Neuro ICU team
const NAME_CORRECTIONS: Record<string, string> = {
  // Exact matches (lowercase keys)
  'lynch': 'Lynch',
  'hasset': 'Hassett',
  'hassett': 'Hassett',
  'sabarwhal': 'Sabharwal',
  'sabharwal': 'Sabharwal',
  'villamizar rosales': 'Villamizar Rosales',
  'rosales': 'Villamizar Rosales',
  'barron': 'Barron',
  'bates': 'Bates',
  'bolt': 'Bolt',
  'dani': 'Dani',
  'gomes': 'Gomes',
  'goswami': 'Goswami',
  'asher': 'Asher',
  'new': 'New', // Placeholder for new hires
  'nn': 'NN',
  'aa': 'AA',
  'bb': 'BB',
  'cc': 'CC',
  // With trailing spaces
  'hassett ': 'Hassett',
  'sabharwal ': 'Sabharwal',
  'barron ': 'Barron',
  'bates ': 'Bates',
  'bolt ': 'Bolt',
  'dani ': 'Dani',
  'gomes ': 'Gomes',
  'goswami ': 'Goswami',
  'asher ': 'Asher',
  // Typos and variations
  'lynch ': 'Lynch',
  'rosales ': 'Villamizar Rosales',
};

/**
 * Normalize provider names to handle common typos and inconsistencies
 */
export const normalizeProviderName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return '';

  // Check for exact match in corrections (case-insensitive)
  const lowerName = trimmed.toLowerCase();
  if (NAME_CORRECTIONS[lowerName]) {
    return NAME_CORRECTIONS[lowerName];
  }

  // Check for partial matches (e.g., "Rosales" -> "Villamizar Rosales")
  for (const [key, value] of Object.entries(NAME_CORRECTIONS)) {
    if (lowerName.includes(key) && key.length > 3) {
      return value;
    }
  }

  // Capitalize first letter of each word
  return trimmed
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export interface ParsedAssignment {
  /** All providers assigned to this shift */
  providers: string[];
  /** The primary/responsible provider (first in list) */
  primaryProvider: string;
  /** Whether this is a shared/multi-provider assignment */
  isShared: boolean;
  /** Original raw value from cell */
  rawValue: string;
}

const parseProviderCell = (value: unknown): ParsedAssignment | null => {
  if (typeof value !== "string") {
    return null;
  }

  const rawValue = value.trim();
  if (!rawValue) {
    return null;
  }

  // Split on common separators: &, and, /, +
  const providers = rawValue
    .split(/(?:\s*&\s*|\s+and\s+|\s*\/\s*|\s*\+\s*)/i)
    .map((entry) => normalizeProviderName(entry.trim()))
    .filter(Boolean);

  if (providers.length === 0) {
    return null;
  }

  return {
    providers,
    primaryProvider: providers[0],
    isShared: providers.length > 1,
    rawValue,
  };
};

/**
 * Convert Excel serial date to ISO date string
 * Excel epoch is December 30, 1899 (don't ask why not 1900)
 */
export const excelSerialToDate = (serial: number): string | null => {
  if (!Number.isFinite(serial) || serial <= 0) {
    return null;
  }

  // Excel's epoch starts at December 30, 1899
  const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));
  const msPerDay = 24 * 60 * 60 * 1000;

  // Handle Excel's leap year bug (Excel thinks 1900 was a leap year)
  // For dates after February 28, 1900, we need to subtract 1 day
  const adjustedSerial = serial > 60 ? serial - 1 : serial;

  const date = new Date(EXCEL_EPOCH.getTime() + adjustedSerial * msPerDay);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return format(date, "yyyy-MM-dd");
};

export const normalizeDate = (value: unknown): string | null => {
  try {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return null;
      }

      return format(value, "yyyy-MM-dd");
    }

    if (typeof value === "number") {
      // First try as Excel serial date (most likely for MASTER file)
      const excelDate = excelSerialToDate(value);
      if (excelDate) {
        return excelDate;
      }
      // Fall back to timestamp interpretation
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return format(date, "yyyy-MM-dd");
      }
      return null;
    }

    const asString = String(value).trim();
    if (!asString) {
      return null;
    }

    // Already in ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) {
      return asString;
    }

    // Try parsing as date string
    const parsedDate = new Date(asString);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return format(parsedDate, "yyyy-MM-dd");
  } catch {
    return null;
  }
};

export const resolveHeaderMapping = (
  headers: string[],
  manualMapping?: Partial<Record<ImportFieldKey, string>>,
): { mapping: Partial<Record<ImportFieldKey, string>>; issues: ImportIssue[] } => {
  try {
    const normalizedToOriginal = new Map<string, string>();
    headers.forEach((header) => {
      normalizedToOriginal.set(normalizeHeader(header), header);
    });

    const mapping: Partial<Record<ImportFieldKey, string>> = {};
    const issues: ImportIssue[] = [];

    // First try exact MASTER file column matching
    headers.forEach((header) => {
      const trimmedHeader = header.trim();
      const masterField = EXCEL_MASTER_COLUMNS[trimmedHeader] || EXCEL_MASTER_COLUMNS[header];
      if (masterField && !mapping[masterField]) {
        mapping[masterField] = header;
      }
    });

    IMPORT_FIELDS.forEach((field) => {
      const manual = manualMapping?.[field];
      if (manual && headers.includes(manual)) {
        mapping[field] = manual;
        return;
      }

      // Skip if already mapped via EXCEL_MASTER_COLUMNS
      if (mapping[field]) {
        return;
      }

      const matches = HEADER_ALIASES[field]
        .map((alias) => normalizedToOriginal.get(alias))
        .filter((entry): entry is string => Boolean(entry));

      if (matches.length > 1) {
        issues.push({
          type: "error",
          code: "AMBIGUOUS_HEADER",
          column: field,
          message: `Ambiguous mapping for ${field}: ${matches.join(", ")}.`,
          action: "Choose one column in the mapping step.",
        });
      }

      if (matches[0]) {
        mapping[field] = matches[0];
      }
    });

    const uniqueHeaders = Object.values(mapping).filter((value): value is string => Boolean(value));
    const duplicateHeaders = uniqueHeaders.filter((header, index) => uniqueHeaders.indexOf(header) !== index);
    duplicateHeaders.forEach((header) => {
      issues.push({
        type: "error",
        code: "DUPLICATE_MAPPING",
        message: `Column ${header} is mapped more than once.`,
        action: "Assign each import field to a unique source column.",
      });
    });

    REQUIRED_FIELDS.forEach((field) => {
      if (!mapping[field]) {
        issues.push({
          type: "warning",
          code: "MISSING_REQUIRED_HEADER",
          column: field,
          message: `Required column '${field}' not detected.`,
          action: "Map the missing column before applying import.",
        });
      }
    });

    return { mapping, issues };
  } catch (error) {
    return {
      mapping: {},
      issues: [
        {
          type: "error",
          code: "HEADER_MAPPING_FAILED",
          message: "Failed to resolve column mappings from spreadsheet headers.",
          action: "Review headers and try again.",
          column: undefined,
          rowIndex: undefined,
        },
        {
          type: "warning",
          code: "HEADER_MAPPING_CONTEXT",
          message: error instanceof Error ? error.message : "Unknown mapping failure.",
        },
      ],
    };
  }
};

const readWorkbookRows = (data: ArrayBuffer): WorksheetRow[] => {
  const workbook = XLSX.read(data, { type: "array", cellDates: true, dense: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json<WorksheetRow>(worksheet, { defval: "" });
};

const buildImportPreviewFromRows = (
  rows: WorksheetRow[],
  fileName: string,
  manualMapping?: Partial<Record<ImportFieldKey, string>>,
  initialIssues: ImportIssue[] = [],
  onProgress?: ProgressCallback,
): ImportPreviewResult => {
  if (!rows.length) {
    return createEmptyImportPreview(fileName, [
      ...initialIssues,
      {
        type: "error",
        code: "EMPTY_SHEET",
        message: "Spreadsheet is empty.",
        action: "Provide a file with at least one data row.",
      },
    ]);
  }

  // Use original (untrimmed) headers so row[mapping.field] lookups work correctly.
  // resolveHeaderMapping normalizes headers internally for comparison.
  const originalHeaders = Object.keys(rows[0]);
  const availableHeaders = originalHeaders.map((h) => h.trim()); // trimmed for display only
  const { mapping, issues: mappingIssues } = resolveHeaderMapping(originalHeaders, manualMapping);
  const previewRows: ImportPreviewRow[] = new Array(rows.length);
  const rowIssues: ImportIssue[] = [];
  let rowErrors = 0;

  reportProgress(onProgress, 45);

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx];
    const issues: ImportIssue[] = [];
    const dateValue = mapping.date ? row[mapping.date] : "";
    const date = normalizeDate(dateValue);

    // Skip rows with invalid dates (like header rows with "January" text)
    if (!date) {
      // Check if this looks like a month header row (text like "January" in date column)
      const dateStr = String(dateValue).trim().toLowerCase();
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];

      if (monthNames.includes(dateStr) || dateStr === '' || dateValue === undefined || dateValue === null) {
        // Skip this row silently - it's likely a header/subheader row
        previewRows[idx] = {
          date: "",
          assignments: {},
          parsedAssignments: {},
          issues: [],
        };
        continue;
      }

      issues.push({
        type: "error",
        code: "INVALID_DATE",
        rowIndex: idx + 2,
        column: mapping.date,
        message: `Row ${idx + 2}: Date '${String(dateValue)}' is invalid.`,
        action: "Use YYYY-MM-DD or a valid Excel date value.",
      });
    }

    const assignments: Partial<Record<ImportFieldKey, string[]>> = {};
    const parsedAssignments: Partial<Record<ImportFieldKey, ParsedAssignment>> = {};

    ASSIGNMENT_IMPORT_FIELDS.forEach((field) => {
      const sourceColumn = mapping[field];
      if (!sourceColumn) {
        return;
      }

      const parsed = parseProviderCell(row[sourceColumn]);
      if (parsed) {
        assignments[field] = parsed.providers;
        parsedAssignments[field] = parsed;

        // Warn about shared assignments (multi-provider cells)
        if (parsed.isShared) {
          issues.push({
            type: "warning",
            code: "SHARED_ASSIGNMENT",
            rowIndex: idx + 2,
            column: sourceColumn,
            message: `Row ${idx + 2}: Shared assignment detected - ${parsed.providers.join(', ')}. Primary: ${parsed.primaryProvider}`,
            action: "Review shared assignment. Both providers will be tracked.",
          });
        }

        // Check for duplicates within the cell
        const namesSeen = new Set<string>();
        const hasDuplicateName = parsed.providers.some((providerName) => {
          const normalizedProviderName = providerName.toLowerCase();
          if (namesSeen.has(normalizedProviderName)) {
            return true;
          }
          namesSeen.add(normalizedProviderName);
          return false;
        });

        if (hasDuplicateName) {
          issues.push({
            type: "warning",
            code: "DUPLICATE_PROVIDER_IN_CELL",
            rowIndex: idx + 2,
            column: sourceColumn,
            message: `Row ${idx + 2}: Duplicate provider in ${sourceColumn}.`,
            action: "Remove duplicate names to avoid ambiguous assignments.",
          });
        }
      }
    });

    if (issues.some((issue) => issue.type === "error")) {
      rowErrors += 1;
    }

    rowIssues.push(...issues);
    previewRows[idx] = {
      date: date ?? "",
      assignments,
      parsedAssignments,
      issues,
    };

    if (idx === rows.length - 1 || idx % 10 === 0) {
      const parseProgress = 45 + ((idx + 1) / rows.length) * 50;
      reportProgress(onProgress, parseProgress);
    }
  }

  const allIssues = [...initialIssues, ...mappingIssues, ...rowIssues];
  const hasRequiredMapping = REQUIRED_FIELDS.every((field) => Boolean(mapping[field]));

  return {
    fileName,
    totalRows: previewRows.length,
    validRows: previewRows.length - rowErrors,
    invalidRows: rowErrors,
    requiresMapping: !hasRequiredMapping || mappingIssues.some((issue) => issue.type === "error"),
    availableHeaders,
    mapping,
    issues: allIssues,
    rows: previewRows,
  };
};

export const parseScheduleImportFile = async (
  file: File,
  manualMapping?: Partial<Record<ImportFieldKey, string>>,
  onProgress?: ProgressCallback,
): Promise<ImportPreviewResult> => {
  try {
    reportProgress(onProgress, 0);
    const sizeWarning = createFileSizeWarning(file.name, file.size);
    const initialIssues = sizeWarning ? [sizeWarning] : [];

    const data = await file.arrayBuffer();
    reportProgress(onProgress, 20);

    const rows = readWorkbookRows(data);
    reportProgress(onProgress, 40);

    const preview = buildImportPreviewFromRows(rows, file.name, manualMapping, initialIssues, onProgress);
    reportProgress(onProgress, 100);
    return preview;
  } catch (error) {
    reportProgress(onProgress, 100);
    throw toExcelError(error, "IMPORT_PARSE_FAILED", `Failed to parse '${file.name}'.`, {
      fileName: file.name,
      fileSizeBytes: file.size,
    });
  }
};

export const parseScheduleImportFileAsync = async (
  file: File,
  manualMapping?: Partial<Record<ImportFieldKey, string>>,
  onProgress?: ProgressCallback,
): Promise<ImportPreviewResult> => {
  try {
    if (typeof Worker === "undefined") {
      return await parseScheduleImportFile(file, manualMapping, onProgress);
    }

    reportProgress(onProgress, 0);
    const data = await file.arrayBuffer();
    reportProgress(onProgress, 10);

    const worker = new Worker(new URL("./excelWorker.ts", import.meta.url), { type: "module" });

    try {
      const result = await new Promise<ImportPreviewResult>((resolve, reject) => {
        const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
          reject(
            new ExcelError("WORKER_TIMEOUT", `Worker timed out while parsing '${file.name}'.`, {
              details: { timeoutMs: WORKER_PARSE_TIMEOUT_MS, fileName: file.name },
            }),
          );
        }, WORKER_PARSE_TIMEOUT_MS);

        const cleanup = () => {
          clearTimeout(timeoutId);
          worker.removeEventListener("message", handleMessage);
          worker.removeEventListener("error", handleError);
        };

        const handleError = (event: ErrorEvent) => {
          cleanup();
          reject(
            new ExcelError("WORKER_FAILED", `Worker failed while parsing '${file.name}'.`, {
              details: { fileName: file.name },
              originalError: event.error ?? event.message,
            }),
          );
        };

        const handleMessage = (event: MessageEvent<ParseImportWorkerResponse>) => {
          const payload = event.data;
          if (payload.type === "progress") {
            reportProgress(onProgress, payload.percent);
            return;
          }

          cleanup();

          if (payload.type === "result") {
            resolve(payload.result);
            return;
          }

          reject(
            new ExcelError(payload.error.code, payload.error.message, {
              details: payload.error.details,
            }),
          );
        };

        worker.addEventListener("message", handleMessage);
        worker.addEventListener("error", handleError);

        const request: ParseImportWorkerRequest = {
          type: "parse",
          fileName: file.name,
          fileSize: file.size,
          data,
          manualMapping,
        };

        worker.postMessage(request, [data]);
      });

      reportProgress(onProgress, 100);
      return result;
    } catch (error) {
      const workerError = toExcelError(error, "WORKER_FAILED", `Failed to parse '${file.name}' in a Web Worker.`, {
        fileName: file.name,
        fileSizeBytes: file.size,
      });

      try {
        return await parseScheduleImportFile(file, manualMapping, onProgress);
      } catch (fallbackError) {
        throw toExcelError(fallbackError, "IMPORT_PARSE_FAILED", `Failed to parse '${file.name}' after worker fallback.`, {
          workerErrorCode: workerError.code,
          workerErrorMessage: workerError.message,
        });
      }
    } finally {
      worker.terminate();
    }
  } catch (error) {
    throw toExcelError(error, "IMPORT_PARSE_FAILED", `Failed to parse '${file.name}' asynchronously.`, {
      fileName: file.name,
      fileSizeBytes: file.size,
    });
  }
};

export const getAiHeaderMapping = async (
  sampleRows: WorksheetRow[],
): Promise<{ mapping: Partial<Record<ImportFieldKey, string>>; confidence: number }> => {
  try {
    const response = await fetch("http://localhost:4000/api/ai/parse-excel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sampleData: sampleRows.slice(0, 5),
        targetFields: IMPORT_FIELDS,
      }),
    });

    if (!response.ok) {
      throw new Error("AI mapping request failed.");
    }

    const { result } = await response.json();
    return {
      mapping: result.mapping || {},
      confidence: result.confidence || 0,
    };
  } catch (error) {
    console.error("Smart mapping failed:", error);
    return { mapping: {}, confidence: 0 };
  }
};

export const applyScheduleImport = (preview: ImportPreviewResult): ApplyImportResult => {
  const previousSnapshot = lastImportSnapshot ? createImportSnapshot(lastImportSnapshot.providers, lastImportSnapshot.slots) : null;
  let transactionSnapshot: ImportSnapshot | null = null;

  try {
    const store = useScheduleStore.getState();
    transactionSnapshot = createImportSnapshot(store.providers, store.slots);

    const providers = structuredClone(transactionSnapshot.providers);
    const slots = structuredClone(transactionSnapshot.slots);

    const providerIdByName = new Map<string, string>();
    providers.forEach((provider) => {
      providerIdByName.set(provider.name.trim().toLowerCase(), provider.id);
    });

    const ignoredProviderNames = new Set(["unassigned", "open", "n/a"]);

    const getOrCreateProviderId = (name: string): string | null => {
      const cleanName = name.trim();
      if (!cleanName || ignoredProviderNames.has(cleanName.toLowerCase())) {
        return null;
      }

      const normalizedName = cleanName.toLowerCase();
      const existingProviderId = providerIdByName.get(normalizedName);
      if (existingProviderId) {
        return existingProviderId;
      }

      const newProvider: Provider = {
        id: crypto.randomUUID(),
        name: cleanName,
        targetWeekDays: 0,
        targetWeekendDays: 0,
        targetWeekNights: 0,
        targetWeekendNights: 0,
        timeOffRequests: [],
        preferredDates: [],
        skills: ["NEURO_CRITICAL"],
        maxConsecutiveNights: 2,
        minDaysOffAfterNight: 1,
      };

      providers.push(newProvider);
      providerIdByName.set(normalizedName, newProvider.id);
      return newProvider.id;
    };

    const slotsByDateAndService = new Map<string, ShiftSlot>();
    slots.forEach((slot) => {
      const slotKey = `${slot.date}::${slot.serviceLocation}`;
      slotsByDateAndService.set(slotKey, slot);
    });

    let appliedAssignments = 0;
    let vacationEntries = 0;

    preview.rows.forEach((row) => {
      if (!row.date || row.issues.some((issue) => issue.type === "error")) {
        return;
      }

      ASSIGNMENT_IMPORT_FIELDS.forEach((field) => {
        const slotSpec = fieldToSlotSpec[field];
        const names = row.assignments[field];
        if (!slotSpec || !names || names.length === 0) {
          return;
        }

        // Handle vacation specially - mark as time off for providers
        if (field === "vacation") {
          names.forEach((name) => {
            const providerId = getOrCreateProviderId(name);
            if (providerId) {
              const provider = providers.find(p => p.id === providerId);
              if (provider && !provider.timeOffRequests.some(r => r.date === row.date)) {
                provider.timeOffRequests.push({
                  date: row.date,
                  type: "PTO"
                });
                vacationEntries++;
              }
            }
          });
          return;
        }

        // Find slot by service location
        const slotKey = `${row.date}::${slotSpec.serviceLocation}`;
        const slot = slotsByDateAndService.get(slotKey);

        if (!slot) {
          return;
        }

        // Handle primary provider
        const primaryProviderId = getOrCreateProviderId(names[0]);
        if (!primaryProviderId) {
          return;
        }

        slot.providerId = primaryProviderId;

        // Handle secondary providers (shared assignments)
        if (names.length > 1) {
          slot.secondaryProviderIds = names.slice(1).map(name => getOrCreateProviderId(name)).filter((id): id is string => Boolean(id));
          slot.isSharedAssignment = true;
        }

        appliedAssignments += 1;
      });
    });

    useScheduleStore.getState().applyImportedSnapshot(providers, slots, appliedAssignments, preview.invalidRows);
    lastImportSnapshot = transactionSnapshot;

    return {
      success: true,
      appliedAssignments,
      skippedRows: preview.invalidRows,
    };
  } catch (error) {
    let rollbackFailure: unknown;

    if (transactionSnapshot) {
      try {
        useScheduleStore.setState({ providers: transactionSnapshot.providers, slots: transactionSnapshot.slots });
        useScheduleStore.getState().detectConflicts();
      } catch (rollbackError) {
        rollbackFailure = rollbackError;
      }
    }

    lastImportSnapshot = previousSnapshot;

    return {
      success: false,
      appliedAssignments: 0,
      skippedRows: preview.invalidRows,
      error: toExcelError(error, "IMPORT_APPLY_FAILED", "Failed to apply parsed spreadsheet assignments.", {
        rollbackFailed: Boolean(rollbackFailure),
        rollbackFailureMessage: rollbackFailure instanceof Error ? rollbackFailure.message : undefined,
      }),
    };
  }
};

export const rollbackLastImport = (): boolean => {
  try {
    if (!lastImportSnapshot) {
      return false;
    }

    const snapshot = createImportSnapshot(lastImportSnapshot.providers, lastImportSnapshot.slots);
    useScheduleStore.setState({
      providers: snapshot.providers,
      slots: snapshot.slots,
    });
    useScheduleStore.getState().detectConflicts();

    lastImportSnapshot = null;
    return true;
  } catch {
    return false;
  }
};

export const hasImportRollback = (): boolean => {
  try {
    return Boolean(lastImportSnapshot);
  } catch {
    return false;
  }
};

const countMonthRows = (dates: string[]): number => {
  let monthRows = 0;
  for (let index = 0; index < dates.length; index += 1) {
    const date = new Date(`${dates[index]}T00:00:00`);
    if (index === 0 || date.getDate() === 1) {
      monthRows += 1;
    }
  }

  return monthRows;
};

export const exportScheduleToExcel = (): ExcelOperationResult => {
  try {
    const { slots, startDate, providers, swapRequests, holidayAssignments } = useScheduleStore.getState();

    const providerNamesById = new Map<string, string>();
    providers.forEach((provider) => {
      providerNamesById.set(provider.id, provider.name);
    });

    // ============== SHEET 1: SCHEDULE ==============
    const slotsByDate = new Map<string, ShiftSlot[]>();
    slots.forEach((slot) => {
      const dateSlots = slotsByDate.get(slot.date);
      if (dateSlots) {
        dateSlots.push(slot);
      } else {
        slotsByDate.set(slot.date, [slot]);
      }
    });

    const dates = Array.from(slotsByDate.keys()).sort();
    const totalRows = 1 + dates.length + countMonthRows(dates);
    const wsData: ExportSheetCell[][] = new Array(totalRows);

    wsData[0] = [...COLUMN_HEADERS];
    let rowIndex = 1;

    dates.forEach((date, dateIndex) => {
      const dateObj = new Date(`${date}T00:00:00`);
      if (dateIndex === 0 || dateObj.getDate() === 1) {
        const monthLabel = format(dateObj, "MMMM");
        const monthRow: ExportSheetCell[] = new Array(COLUMN_HEADERS.length);
        monthRow.fill(monthLabel);
        wsData[rowIndex] = monthRow;
        rowIndex += 1;
      }

      const row: ExportSheetCell[] = new Array(COLUMN_HEADERS.length);
      row.fill(null);
      row[0] = dateObj;

      const dateSlots = slotsByDate.get(date);
      if (dateSlots) {
        dateSlots.forEach((slot) => {
          const specificKey = `${slot.type}-${slot.location}`;
          const fallbackKey = `${slot.type}-0`;
          const columnIndex = slotToColumnMap[specificKey] ?? slotToColumnMap[fallbackKey];

          if (columnIndex !== undefined && slot.providerId) {
            const providerName = providerNamesById.get(slot.providerId) ?? "";
            // Handle shared assignments
            if (slot.isSharedAssignment && slot.secondaryProviderIds && slot.secondaryProviderIds.length > 0) {
              const secondaryNames = slot.secondaryProviderIds
                .map(id => providerNamesById.get(id))
                .filter(Boolean)
                .join(" & ");
              row[columnIndex] = secondaryNames ? `${providerName} & ${secondaryNames}` : providerName;
            } else {
              row[columnIndex] = providerName;
            }
          }
        });
      }

      wsData[rowIndex] = row;
      rowIndex += 1;
    });

    wsData.length = rowIndex;

    const scheduleSheet = XLSX.utils.aoa_to_sheet(wsData);

    // ============== SHEET 2: STAFF FTE TRACKING ==============
    const fteHeaders = [
      "Staff", "G20", "H22", "WeekDAY Nights", "Main Wknds", "WeekEND Nights",
      "Akron", "Akron Wknds", "Consults", "Total Weeks", "Total Weekends",
      "Jeopardy", "FTE Week Target", "FTE Weekend Target",
      "Week Assigned", "Weekend Assigned", "Week Deficit", "Weekend Deficit", "Notes"
    ];

    const fteData: ExportSheetCell[][] = [fteHeaders];

    providers.forEach((provider, idx) => {
      const row = idx + 2; // Excel row number (1-indexed, with header)
      const pName = provider.name;

      fteData.push([
        pName,
        `=COUNTIF('Schedule'!B:B,A${row})`, // G20
        `=COUNTIF('Schedule'!C:C,A${row})`, // H22
        `=COUNTIF('Schedule'!E:E,A${row})`, // WeekDAY Nights
        `=COUNTIFS('Schedule'!B:B,A${row},'Schedule'!A:A,">="&DATE(${new Date(startDate).getFullYear()},1,1),WEEKDAY('Schedule'!A:A,2)>5)`, // Main Wknds
        `=COUNTIFS('Schedule'!E:E,A${row},'Schedule'!A:A,">="&DATE(${new Date(startDate).getFullYear()},1,1),WEEKDAY('Schedule'!A:A,2)>5)`, // WeekEND Nights
        `=COUNTIF('Schedule'!D:D,A${row})`, // Akron
        `=COUNTIFS('Schedule'!D:D,A${row},'Schedule'!A:A,">="&DATE(${new Date(startDate).getFullYear()},1,1),WEEKDAY('Schedule'!A:A,2)>5)`, // Akron Wknds
        `=COUNTIF('Schedule'!F:F,A${row})`, // Consults
        `=SUM(B${row}:E${row},G${row}:I${row})`, // Total Weeks
        `=F${row}+H${row}`, // Total Weekends
        `=COUNTIF('Schedule'!H:H,A${row})`, // Jeopardy
        provider.targetWeekDays + provider.targetWeekendDays, // FTE Week Target
        provider.targetWeekendNights + provider.targetWeekNights, // FTE Weekend Target (using nights as proxy for weekend target)
        `=J${row}`, // Week Assigned
        `=K${row}`, // Weekend Assigned
        `=M${row}-O${row}`, // Week Deficit
        `=N${row}-P${row}`, // Weekend Deficit
        provider.notes || "", // Notes
      ]);
    });

    const fteSheet = XLSX.utils.aoa_to_sheet(fteData);

    // ============== SHEET 3: SWAP TRACKER ==============
    const swapHeaders = ["ID", "Date Requested", "Staff Involved", "Dates Exchanged", "Services", "Status", "Approved By", "Notes", "Validation"];
    const swapData: ExportSheetCell[][] = [swapHeaders];

    swapRequests.forEach((swap) => {
      const requestorName = providerNamesById.get(swap.requestorId) || "Unknown";
      const targetName = swap.targetProviderId ? (providerNamesById.get(swap.targetProviderId) || "Unknown") : "Any";
      const resolverName = swap.resolvedBy ? (providerNamesById.get(swap.resolvedBy) || "Unknown") : "";

      swapData.push([
        swap.id.slice(0, 8),
        swap.requestedAt,
        `${requestorName} ↔ ${targetName}`,
        `${swap.fromDate} (${swap.fromShiftType}) ↔ ${swap.toDate} (${swap.toShiftType})`,
        `${swap.fromShiftType} ↔ ${swap.toShiftType}`,
        swap.status,
        resolverName,
        swap.notes || "",
        swap.validationErrors ? swap.validationErrors.join("; ") : "",
      ]);
    });

    const swapSheet = XLSX.utils.aoa_to_sheet(swapData);

    // ============== SHEET 4: HOLIDAY SUMMARY ==============
    const holidayHeaders = ["Holiday", "Date", "Provider", "Shift Type", "Previous Year Provider"];
    const holidayData: ExportSheetCell[][] = [holidayHeaders];

    holidayAssignments.forEach((holiday) => {
      holidayData.push([
        holiday.holidayName,
        holiday.date,
        providerNamesById.get(holiday.providerId) || "Unknown",
        holiday.shiftType,
        holiday.previousYearProviderId ? (providerNamesById.get(holiday.previousYearProviderId) || "") : "",
      ]);
    });

    const holidaySheet = XLSX.utils.aoa_to_sheet(holidayData);

    // ============== CREATE WORKBOOK ==============
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, scheduleSheet, "Schedule");
    XLSX.utils.book_append_sheet(workbook, fteSheet, "Staff FTE Tracking");
    XLSX.utils.book_append_sheet(workbook, swapSheet, "Swap Tracker");
    XLSX.utils.book_append_sheet(workbook, holidaySheet, "Holiday Summary");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveBlobToFile(new Blob([excelBuffer], { type: "application/octet-stream" }), `NICU_Schedule_${startDate}.xlsx`);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: toExcelError(error, "EXPORT_FAILED", "Failed to export schedule workbook."),
    };
  }
};
