import { format } from "date-fns";
import * as XLSX from "xlsx";
import type {
  FileSizeWarning,
  ImportFieldKey,
  ImportIssue,
  ImportPreviewResult,
  ImportPreviewRow,
  ParseImportWorkerRequest,
  ParseImportWorkerResponse,
  ParsedAssignment,
} from "./excelUtils";

const LARGE_FILE_WARNING_BYTES = 5 * 1024 * 1024;

// IMPORTANT: Must match excelUtils.ts exactly
const IMPORT_FIELDS = ["date", "dayG20", "dayH22", "dayAkron", "night", "consults", "dayAmet", "dayNmet", "jeopardy", "recovery", "vacation"] as const;
type AssignmentImportFieldKey = Exclude<ImportFieldKey, "date">;
const ASSIGNMENT_IMPORT_FIELDS: AssignmentImportFieldKey[] = IMPORT_FIELDS.filter((field): field is AssignmentImportFieldKey => field !== "date");

// IMPORTANT: Must match excelUtils.ts exactly
const HEADER_ALIASES: Record<ImportFieldKey, string[]> = {
  date: ["month / date", "month", "date", "schedule date", "month / date ", "month "],
  dayG20: ["g20", "g20 unit", "day g20", "g20 "],
  dayH22: ["h22", "h22 unit", "day h22", "h22 "],
  dayAkron: ["akron", "akron unit", "day akron", "akron "],
  night: ["nights", "night", "overnight", "nights "],
  consults: ["consults", "consult", "consult service", "consults "],
  dayAmet: ["amet", "amet ", "day amet"],
  dayNmet: ["nmet", "nmet ", "day nmet"],
  jeopardy: ["jeopardy", "backup", "backup jeopardy"],
  recovery: ["recovery", "post call", "post-call"],
  vacation: ["vacations", "vacation", "time off", "pto", "vacations "],
};

/** Excel column mapping for MASTER_NEW_CALENDAR format (trimmed keys) */
const EXCEL_MASTER_COLUMNS: Record<string, ImportFieldKey> = {
  "Month": "date",
  "G20": "dayG20",
  "H22": "dayH22",
  "Akron": "dayAkron",
  "Nights": "night",
  "Consults": "consults",
  "AMET": "dayAmet",
  "NMET": "dayNmet",
  "Jeopardy": "jeopardy",
  "Recovery": "recovery",
  "Vacations": "vacation",
};

const REQUIRED_FIELDS: ImportFieldKey[] = ["date", "night"];

type WorksheetRow = Record<string, unknown>;

interface WorkerHost {
  postMessage: (payload: ParseImportWorkerResponse) => void;
  addEventListener: (type: "message", listener: (event: MessageEvent<ParseImportWorkerRequest>) => void) => void;
}

const workerContext = self as unknown as WorkerHost;

const postProgress = (percent: number) => {
  const response: ParseImportWorkerResponse = {
    type: "progress",
    percent: Math.max(0, Math.min(100, Math.round(percent))),
  };
  workerContext.postMessage(response);
};

const normalizeHeader = (header: unknown): string => String(header ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// Common name corrections for Neuro ICU team - must match excelUtils.ts
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
 * Must match excelUtils.ts implementation
 */
const normalizeProviderName = (name: string): string => {
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

/**
 * Parse provider cell with support for multi-provider assignments
 * Must match excelUtils.ts implementation
 */
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

const formatDateParts = (year: number, month: number, day: number): string => {
  const monthString = String(month).padStart(2, "0");
  const dayString = String(day).padStart(2, "0");
  return `${year}-${monthString}-${dayString}`;
};

const normalizeExcelDateSerial = (serialDate: number): string | null => {
  if (!Number.isFinite(serialDate)) {
    return null;
  }

  // Excel's epoch starts at December 30, 1899
  const wholeDays = Math.trunc(serialDate);
  const epoch = Date.UTC(1899, 11, 30);
  
  // Handle Excel's leap year bug (Excel thinks 1900 was a leap year)
  // For dates after February 28, 1900, we need to subtract 1 day
  const adjustedDays = serialDate > 60 ? wholeDays - 1 : wholeDays;
  
  const dateValue = new Date(epoch + adjustedDays * 86_400_000);
  if (Number.isNaN(dateValue.getTime())) {
    return null;
  }

  return formatDateParts(dateValue.getUTCFullYear(), dateValue.getUTCMonth() + 1, dateValue.getUTCDate());
};

const normalizeDate = (value: unknown): string | null => {
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
};

const resolveHeaderMapping = (
  headers: string[],
  manualMapping?: Partial<Record<ImportFieldKey, string>>,
): { mapping: Partial<Record<ImportFieldKey, string>>; issues: ImportIssue[] } => {
  const normalizedToOriginal = new Map<string, string>();
  headers.forEach((header) => {
    normalizedToOriginal.set(normalizeHeader(header), header);
  });

  const mapping: Partial<Record<ImportFieldKey, string>> = {};
  const issues: ImportIssue[] = [];

  // First try exact MASTER file column matching
  headers.forEach((header) => {
    const trimmedHeader = header.trim();
    const masterField = EXCEL_MASTER_COLUMNS[trimmedHeader];
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
};

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
  // map correctly to row values.
  const availableHeaders = Object.keys(rows[0]);
  const { mapping, issues: mappingIssues } = resolveHeaderMapping(availableHeaders, manualMapping);

  const previewRows: ImportPreviewRow[] = new Array(rows.length);
  const rowIssues: ImportIssue[] = [];
  let rowErrors = 0;

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx];
    const issues: ImportIssue[] = [];

    const dateValue = mapping.date ? row[mapping.date] : "";
    const date = normalizeDate(dateValue);

    // Skip rows with invalid dates (like header rows with "January" text)
    if (!date) {
      const dateStr = String(dateValue).trim().toLowerCase();
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];

      if (monthNames.includes(dateStr) || dateStr === '' || dateValue === undefined || dateValue === null) {
        // Skip this row silently
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
      const percent = 45 + ((idx + 1) / rows.length) * 50;
      postProgress(percent);
    }
  }

  const hasRequiredMapping = REQUIRED_FIELDS.every((field) => Boolean(mapping[field]));

  return {
    fileName,
    totalRows: previewRows.length,
    validRows: previewRows.length - rowErrors,
    invalidRows: rowErrors,
    requiresMapping: !hasRequiredMapping || mappingIssues.some((issue) => issue.type === "error"),
    availableHeaders,
    mapping,
    issues: [...initialIssues, ...mappingIssues, ...rowIssues],
    rows: previewRows,
  };
};

workerContext.addEventListener("message", (event: MessageEvent<ParseImportWorkerRequest>) => {
  const request = event.data;
  if (!request || request.type !== "parse") {
    return;
  }

  try {
    postProgress(20);
    const rows = readWorkbookRows(request.data);
    postProgress(40);

    const sizeWarning = createFileSizeWarning(request.fileName, request.fileSize);
    const initialIssues = sizeWarning ? [sizeWarning] : [];

    const result = buildImportPreviewFromRows(rows, request.fileName, request.manualMapping, initialIssues);
    postProgress(100);

    const response: ParseImportWorkerResponse = {
      type: "result",
      result,
    };
    workerContext.postMessage(response);
  } catch (error) {
    const response: ParseImportWorkerResponse = {
      type: "error",
      error: {
        code: "WORKER_FAILED",
        message: `Failed to parse '${request.fileName}' in worker.`,
        details: {
          fileName: request.fileName,
          originalMessage: error instanceof Error ? error.message : String(error),
        },
      },
    };

    workerContext.postMessage(response);
  }
});

export { };
