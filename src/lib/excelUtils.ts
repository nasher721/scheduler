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
  date: ["month / date", "month", "date", "schedule date"],
  dayG20: ["g20", "g20 unit", "day g20"],
  dayH22: ["h22", "h22 unit", "day h22"],
  dayAkron: ["akron", "akron unit", "day akron"],
  night: ["nights", "night", "overnight"],
  consults: ["consults", "consult", "consult service"],
  nmet: ["amet / nmet", "nmet", "amet", "airway"],
  jeopardy: ["jeopardy", "backup", "backup jeopardy"],
  recovery: ["recovery", "post call", "post-call"],
  vacation: ["vacations", "vacation", "time off", "pto"],
};

const REQUIRED_FIELDS: ImportFieldKey[] = ["date", "night"];

interface ImportSnapshot {
  providers: Provider[];
  slots: ShiftSlot[];
}

let lastImportSnapshot: ImportSnapshot | null = null;

type ProgressCallback = (percent: number) => void;
type WorksheetRow = Record<string, unknown>;
type ExportSheetCell = string | Date | null;

const fieldToSlotSpec: Partial<Record<ImportFieldKey, { type: ShiftSlot["type"]; locationIncludes: string }>> = {
  dayG20: { type: "DAY", locationIncludes: "G20" },
  dayH22: { type: "DAY", locationIncludes: "H22" },
  dayAkron: { type: "DAY", locationIncludes: "Akron" },
  night: { type: "NIGHT", locationIncludes: "Main Campus" },
  consults: { type: "CONSULTS", locationIncludes: "Main Campus" },
  nmet: { type: "NMET", locationIncludes: "Main Campus" },
  jeopardy: { type: "JEOPARDY", locationIncludes: "Main Campus" },
  recovery: { type: "RECOVERY", locationIncludes: "Main Campus" },
  vacation: { type: "VACATION", locationIncludes: "Any" },
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

const parseProviderCell = (value: unknown): string[] => {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[,&/]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((name) => name.replace(/\s+/g, " "));
};

const formatDateParts = (year: number, month: number, day: number): string => {
  const monthString = String(month).padStart(2, "0");
  const dayString = String(day).padStart(2, "0");
  return `${year}-${monthString}-${dayString}`;
};

const normalizeExcelDateSerial = (serialDate: number): string | null => {
  if (!Number.isFinite(serialDate)) {
    return null;
  }

  const wholeDays = Math.trunc(serialDate);
  const epoch = Date.UTC(1899, 11, 30);
  const dateValue = new Date(epoch + wholeDays * 86_400_000);
  if (Number.isNaN(dateValue.getTime())) {
    return null;
  }

  return formatDateParts(dateValue.getUTCFullYear(), dateValue.getUTCMonth() + 1, dateValue.getUTCDate());
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
      return normalizeExcelDateSerial(value);
    }

    const asString = String(value).trim();
    if (!asString) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) {
      return asString;
    }

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

    IMPORT_FIELDS.forEach((field) => {
      const manual = manualMapping?.[field];
      if (manual && headers.includes(manual)) {
        mapping[field] = manual;
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

  const availableHeaders = Object.keys(rows[0]).map((header) => header.trim());
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

    if (!date) {
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

    ASSIGNMENT_IMPORT_FIELDS.forEach((field) => {
      const sourceColumn = mapping[field];
      if (!sourceColumn) {
        return;
      }

      const providers = parseProviderCell(row[sourceColumn]);
      assignments[field] = providers;

      const namesSeen = new Set<string>();
      const hasDuplicateName = providers.some((providerName) => {
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
    });

    if (issues.some((issue) => issue.type === "error")) {
      rowErrors += 1;
    }

    rowIssues.push(...issues);
    previewRows[idx] = {
      date: date ?? "",
      assignments,
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

    const slotsByDateAndType = new Map<string, ShiftSlot[]>();
    slots.forEach((slot) => {
      const slotKey = `${slot.date}::${slot.type}`;
      const existing = slotsByDateAndType.get(slotKey);
      if (existing) {
        existing.push(slot);
      } else {
        slotsByDateAndType.set(slotKey, [slot]);
      }
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

        const slotCandidates = slotsByDateAndType.get(`${row.date}::${slotSpec.type}`);
        if (!slotCandidates || slotCandidates.length === 0) {
          return;
        }

        const slot = slotCandidates.find((candidate) => candidate.location.includes(slotSpec.locationIncludes));
        if (!slot) {
          return;
        }

        const providerId = getOrCreateProviderId(names[0]);
        if (!providerId) {
          return;
        }

        slot.providerId = providerId;
        appliedAssignments += 1;
      });
    });

    useScheduleStore.setState({ providers, slots });
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
    const { slots, startDate, providers } = useScheduleStore.getState();

    const providerNamesById = new Map<string, string>();
    providers.forEach((provider) => {
      providerNamesById.set(provider.id, provider.name);
    });

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
            row[columnIndex] = providerNamesById.get(slot.providerId) ?? "";
          }
        });
      }

      wsData[rowIndex] = row;
      rowIndex += 1;
    });

    wsData.length = rowIndex;

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "NICU Institutional Schedule");

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
