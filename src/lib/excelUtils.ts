import { format, parseISO, addDays, startOfWeek, differenceInCalendarDays } from "date-fns";
import * as XLSX from "xlsx";
import { useScheduleStore, generateInitialSlots } from "../store.ts";
import type { Provider, ShiftSlot } from "../store.ts";

const LARGE_FILE_WARNING_BYTES = 5 * 1024 * 1024;
const WORKER_PARSE_TIMEOUT_MS = 120_000;


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

  const rawRows = XLSX.utils.sheet_to_json<WorksheetRow>(worksheet, { defval: "" });
  // Normalize all row keys by trimming whitespace so header matching and row lookups
  // use consistent keys regardless of trailing spaces in Excel column headers.
  return rawRows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim(), v]))
  );
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

  // Row keys are already normalized (trimmed) by readWorkbookRows, so trimmed headers
  // correctly match row lookups.
  const availableHeaders = Object.keys(rows[0]);
  const { mapping, issues: mappingIssues } = resolveHeaderMapping(availableHeaders, manualMapping);
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

    // ── Determine the date range covered by the imported rows ──────────────────
    const validDates = preview.rows
      .map(r => r.date)
      .filter((d): d is string => Boolean(d) && /^\d{4}-\d{2}-\d{2}$/.test(d));

    let slotsForImport: ShiftSlot[];

    if (validDates.length > 0) {
      const sortedDates = [...validDates].sort();
      const minDate = sortedDates[0];
      const maxDate = sortedDates[sortedDates.length - 1];

      // Snap to the Monday of the first week through the Sunday of the last week
      const importStart = startOfWeek(parseISO(minDate), { weekStartsOn: 1 });
      const importEnd = parseISO(maxDate);
      const daySpan = differenceInCalendarDays(importEnd, importStart);
      const numWeeks = Math.ceil((daySpan + 1) / 7);

      const importStartStr = format(importStart, "yyyy-MM-dd");

      // Generate a complete set of slots for the imported date range
      const freshImportSlots = generateInitialSlots(importStartStr, Math.max(numWeeks, 1));

      // Build a set of all dates covered by the import
      const importDateSet = new Set<string>();
      for (let i = 0; i <= daySpan + 7; i++) {
        importDateSet.add(format(addDays(importStart, i), "yyyy-MM-dd"));
      }

      // Keep existing slots that fall OUTSIDE the import range (preserve other months)
      const existingOutsideRange = structuredClone(transactionSnapshot.slots).filter(
        slot => !importDateSet.has(slot.date)
      );

      slotsForImport = [...existingOutsideRange, ...freshImportSlots];
    } else {
      // No valid dates — fall back to existing slots
      slotsForImport = structuredClone(transactionSnapshot.slots);
    }

    const providerIdByName = new Map<string, string>();
    providers.forEach((provider) => {
      providerIdByName.set(provider.name.trim().toLowerCase(), provider.id);
    });

    const ignoredProviderNames = new Set(["unassigned", "open", "n/a", ""]);

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

    // Build lookup from date+serviceLocation → slot (mutable reference)
    const slotsByDateAndService = new Map<string, ShiftSlot>();
    slotsForImport.forEach((slot) => {
      const slotKey = `${slot.date}::${slot.serviceLocation}`;
      slotsByDateAndService.set(slotKey, slot);
    });

    let appliedAssignments = 0;

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
              }
            }
          });
          return;
        }

        // Find slot by date + service location
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
          slot.secondaryProviderIds = names.slice(1)
            .map(name => getOrCreateProviderId(name))
            .filter((id): id is string => Boolean(id));
          slot.isSharedAssignment = true;
        }

        appliedAssignments += 1;
      });
    });

    useScheduleStore.getState().applyImportedSnapshot(providers, slotsForImport, appliedAssignments, preview.invalidRows);
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


export const exportScheduleToExcel = (): ExcelOperationResult => {
  try {
    const { slots, startDate, providers, swapRequests, holidayAssignments, dayHandoffs } = useScheduleStore.getState();

    const providerNamesById = new Map<string, string>();
    providers.forEach((p) => providerNamesById.set(p.id, p.name));

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 1: "2026 Sch" — mirrors the master NICU Excel format exactly
    // ═══════════════════════════════════════════════════════════════════════════

    // Column order and exact header text (incl. trailing spaces from master)
    const MASTER_HEADERS = [
      "Month ", "G20 ", "H22", "Akron ", "Nights",
      "Consults ", "AMET", "Jeopardy", "Recovery", "Vacations ",
    ] as const;

    // 0-based column indices
    const COL_DATE = 0;  // A
    const COL_G20 = 1;  // B
    const COL_H22 = 2;  // C
    const COL_AKRON = 3;  // D
    const COL_NIGHTS = 4;  // E
    const COL_CONSULTS = 5;  // F
    const COL_AMET = 6;  // G
    const COL_JEOPARDY = 7;  // H
    const COL_RECOVERY = 8;  // I
    const COL_VACATIONS = 9;  // J
    const NUM_COLS = 10;

    // slot.serviceLocation → export column (handles both AMET and NMET → col G)
    const svcToCol: Record<string, number> = {
      G20: COL_G20,
      H22: COL_H22,
      Akron: COL_AKRON,
      Nights: COL_NIGHTS,
      Consults: COL_CONSULTS,
      AMET: COL_AMET,
      NMET: COL_AMET,
      Jeopardy: COL_JEOPARDY,
      Recovery: COL_RECOVERY,
      Vacation: COL_VACATIONS,
    };

    // Gold fill that matches master (FFFFC000)
    const goldFill = { patternType: "solid", fgColor: { rgb: "FFC000" } };

    const ws: XLSX.WorkSheet = {};
    const addr = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

    const cell = (
      v: XLSX.CellObject["v"],
      t: XLSX.CellObject["t"],
      extra?: Partial<XLSX.CellObject>,
    ): XLSX.CellObject => ({ v, t, ...extra } as XLSX.CellObject);

    let ri = 0; // current row index (0-based)

    // ── Row 1: Column headers ────────────────────────────────────────────────
    MASTER_HEADERS.forEach((hdr, ci) => {
      ws[addr(ri, ci)] = cell(hdr, "s");
    });
    ri++;

    // ── Build date → slots map ───────────────────────────────────────────────
    const byDate = new Map<string, ShiftSlot[]>();
    slots.forEach((s) => {
      const list = byDate.get(s.date);
      if (list) list.push(s); else byDate.set(s.date, [s]);
    });
    const dates = [...byDate.keys()].sort();

    let prevMonth = -1;

    dates.forEach((dateStr) => {
      const d = new Date(`${dateStr}T00:00:00`);
      const month = d.getMonth();
      const isNewMonth = month !== prevMonth;
      prevMonth = month;

      // ── Month header row (e.g. "January" repeated across A-F & J) ─────────
      if (isNewMonth) {
        const monthName = format(d, "MMMM");
        for (let ci = 0; ci < NUM_COLS; ci++) {
          // Original master fills A-F (cols 0-5) + J (col 9) with month name
          const showName = ci <= COL_CONSULTS || ci === COL_VACATIONS;
          ws[addr(ri, ci)] = showName
            ? cell(monthName, "s", { s: { fill: goldFill } })
            : cell(undefined, "z", { s: { fill: goldFill } });
        }
        ri++;
      }

      // ── Date row ─────────────────────────────────────────────────────────
      // First day of a new month gets gold fill (matches master Jan 1)
      const rowStyle = isNewMonth ? { s: { fill: goldFill } } : undefined;

      // Column A: Excel date serial + master number format
      const epoch = new Date(1899, 11, 30);
      const serial = Math.round((d.getTime() - epoch.getTime()) / 86400000);
      ws[addr(ri, COL_DATE)] = {
        v: serial,
        t: "n",
        z: '[$-F800]dddd\\, mmmm dd\\, yyyy',
        ...rowStyle,
      } as XLSX.CellObject;

      // Blank-fill remaining columns (carries gold fill for new-month row)
      for (let ci = 1; ci < NUM_COLS; ci++) {
        ws[addr(ri, ci)] = rowStyle
          ? cell(undefined, "z", rowStyle)
          : cell(undefined, "z");
      }

      // Fill in provider assignments
      (byDate.get(dateStr) ?? []).forEach((slot) => {
        if (!slot.providerId) return;
        const ci = svcToCol[slot.serviceLocation ?? ""];
        if (ci === undefined) return;

        let name = providerNamesById.get(slot.providerId) ?? "";
        if (slot.isSharedAssignment && slot.secondaryProviderIds?.length) {
          const extras = slot.secondaryProviderIds
            .map((id) => providerNamesById.get(id))
            .filter(Boolean)
            .join(" & ");
          if (extras) name = `${name} & ${extras}`;
        }
        ws[addr(ri, ci)] = rowStyle
          ? cell(name, "s", rowStyle)
          : cell(name, "s");
      });

      ri++;
    });

    ws["!ref"] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: ri - 1, c: NUM_COLS - 1 });
    // Column widths matching the master NICU file
    ws["!cols"] = [
      { wch: 30 }, // A – Date
      { wch: 10.3 }, // B – G20
      { wch: 8 }, // C – H22
      { wch: 11.1 }, // D – Akron
      { wch: 11.3 }, // E – Nights
      { wch: 13.7 }, // F – Consults
      { wch: 13.7 }, // G – AMET
      { wch: 10 }, // H – Jeopardy
      { wch: 17.9 }, // I – Recovery
      { wch: 30.3 }, // J – Vacations
    ];

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 2: "Staff 2026 #s" — FTE tracking (mirrors "Staff 2026 #s" tab)
    // ═══════════════════════════════════════════════════════════════════════════
    const fteHeaders = [
      "Staff", "G20", "H22", "WeekDAY Nights", "Main Wknds", "WeekEND Nights",
      "Akron", "Akron Wknds", "Consults", "Total Weeks", "Total Weekends",
      "Jeopardy", "FTE Week Target", "FTE Weekend Target",
      "Week Assigned", "Weekend Assigned", "Week Deficit", "Weekend Deficit", "Notes",
    ];

    const yr = new Date(startDate).getFullYear();
    const fteRows: (string | number)[][] = [fteHeaders];

    providers.forEach((p, idx) => {
      const r = idx + 2;
      fteRows.push([
        p.name,
        `=COUNTIF('2026 Sch'!B:B,A${r})`,
        `=COUNTIF('2026 Sch'!C:C,A${r})`,
        `=COUNTIF('2026 Sch'!E:E,A${r})`,
        `=COUNTIFS('2026 Sch'!B:B,A${r},'2026 Sch'!A:A,">="&DATE(${yr},1,1),WEEKDAY('2026 Sch'!A:A,2)>5)`,
        `=COUNTIFS('2026 Sch'!E:E,A${r},'2026 Sch'!A:A,">="&DATE(${yr},1,1),WEEKDAY('2026 Sch'!A:A,2)>5)`,
        `=COUNTIF('2026 Sch'!D:D,A${r})`,
        `=COUNTIFS('2026 Sch'!D:D,A${r},'2026 Sch'!A:A,">="&DATE(${yr},1,1),WEEKDAY('2026 Sch'!A:A,2)>5)`,
        `=COUNTIF('2026 Sch'!F:F,A${r})`,
        `=SUM(B${r}:E${r},G${r}:I${r})`,
        `=F${r}+H${r}`,
        `=COUNTIF('2026 Sch'!H:H,A${r})`,
        p.targetWeekDays + p.targetWeekendDays,
        p.targetWeekNights + p.targetWeekendNights,
        `=J${r}`,
        `=K${r}`,
        `=M${r}-O${r}`,
        `=N${r}-P${r}`,
        p.notes || "",
      ]);
    });
    const fteSheet = XLSX.utils.aoa_to_sheet(fteRows);

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 3: Swap Tracker
    // ═══════════════════════════════════════════════════════════════════════════
    const swapHeaders = [
      "ID", "Date Requested", "Staff Involved", "Dates Exchanged",
      "Services", "Status", "Approved By", "Notes", "Validation",
    ];
    const swapRows: (string | null)[][] = [swapHeaders];

    swapRequests.forEach((sw) => {
      const rName = providerNamesById.get(sw.requestorId) || "Unknown";
      const tName = sw.targetProviderId ? (providerNamesById.get(sw.targetProviderId) || "Unknown") : "Any";
      const approver = sw.resolvedBy ? (providerNamesById.get(sw.resolvedBy) || "Unknown") : "";
      swapRows.push([
        sw.id.slice(0, 8),
        sw.requestedAt,
        `${rName} ↔ ${tName}`,
        `${sw.fromDate} (${sw.fromShiftType}) ↔ ${sw.toDate} (${sw.toShiftType})`,
        `${sw.fromShiftType} ↔ ${sw.toShiftType}`,
        sw.status,
        approver,
        sw.notes || "",
        sw.validationErrors ? sw.validationErrors.join("; ") : "",
      ]);
    });
    const swapSheet = XLSX.utils.aoa_to_sheet(swapRows);

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 4: Holiday Summary
    // ═══════════════════════════════════════════════════════════════════════════
    const holHeaders = ["Holiday", "Date", "Provider", "Shift Type", "Previous Year Provider"];
    const holRows: (string | null)[][] = [holHeaders];

    holidayAssignments.forEach((h) => {
      holRows.push([
        h.holidayName,
        h.date,
        providerNamesById.get(h.providerId) || "Unknown",
        h.shiftType,
        h.previousYearProviderId ? (providerNamesById.get(h.previousYearProviderId) || "") : "",
      ]);
    });
    const holSheet = XLSX.utils.aoa_to_sheet(holRows);

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 5: Shift Notes
    // ═══════════════════════════════════════════════════════════════════════════
    const notesHeaders = ["Date", "Service Location", "Shift Type", "Provider", "Notes"];
    const notesRows: (string | null)[][] = [notesHeaders];

    // Get slots that have notes
    const slotsWithNotes = slots.filter(s => s.notes && s.notes.trim());
    slotsWithNotes.forEach((slot) => {
      const providerName = slot.providerId ? (providerNamesById.get(slot.providerId) || "Unassigned") : "Unassigned";
      notesRows.push([
        slot.date,
        slot.serviceLocation,
        slot.type,
        providerName,
        slot.notes || "",
      ]);
    });

    // Add rows for dates with day-level notes (if any providers have notes for that day)
    // This can be extended later for day-level notes

    const notesSheet = XLSX.utils.aoa_to_sheet(notesRows);

    // ═══════════════════════════════════════════════════════════════════════════
    // SHEET 6: Daily Handoffs
    // ═══════════════════════════════════════════════════════════════════════════
    const handoffHeaders = ["Date", "Notes", "Updated At", "Updated By"];
    const handoffRows: (string | null)[][] = [handoffHeaders];

    const sortedHandoffs = [...(dayHandoffs || [])].sort((a, b) => a.date.localeCompare(b.date));
    sortedHandoffs.forEach((handoff) => {
      handoffRows.push([
        handoff.date,
        handoff.notes,
        handoff.updatedAt ? format(new Date(handoff.updatedAt), "yyyy-MM-dd HH:mm") : "",
        handoff.updatedBy || "",
      ]);
    });

    const handoffSheet = XLSX.utils.aoa_to_sheet(handoffRows);

    // ═══════════════════════════════════════════════════════════════════════════
    // Assemble workbook with master-matching sheet names
    // ═══════════════════════════════════════════════════════════════════════════
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws, "2026 Sch");
    XLSX.utils.book_append_sheet(workbook, fteSheet, "Staff 2026 #s");
    XLSX.utils.book_append_sheet(workbook, swapSheet, "Swap Tracker");
    XLSX.utils.book_append_sheet(workbook, holSheet, "Holiday Summary");

    // Only add notes sheet if there are notes
    if (slotsWithNotes.length > 0) {
      XLSX.utils.book_append_sheet(workbook, notesSheet, "Shift Notes");
    }

    // Only add handoff sheet if there are handoff notes
    if (sortedHandoffs.length > 0) {
      XLSX.utils.book_append_sheet(workbook, handoffSheet, "Daily Handoffs");
    }

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
      cellStyles: true,
    });

    const year = new Date(startDate).getFullYear();
    saveBlobToFile(
      new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `NICU_Schedule_${year}.xlsx`,
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: toExcelError(error, "EXPORT_FAILED", "Failed to export schedule workbook."),
    };
  }
};
