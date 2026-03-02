/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useScheduleStore, Provider, ShiftSlot } from "../store";
import { format } from "date-fns";

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
];

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
export type ImportFieldKey = typeof IMPORT_FIELDS[number];

export interface ImportIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  rowIndex?: number;
  column?: string;
  action?: string;
}

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

let lastImportSnapshot: { providers: Provider[]; slots: ShiftSlot[] } | null = null;

export const normalizeHeader = (header: unknown): string => String(header ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const parseProviderCell = (value: unknown) => {
  if (typeof value !== "string") return [];
  return value
    .split(/[,&/]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => name.replace(/\s+/g, " "));
};

export const normalizeDate = (value: unknown): string | null => {
  if (!value) return null;
  const asString = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;
  const parsed = new Date(asString);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "yyyy-MM-dd");
};

export const resolveHeaderMapping = (headers: string[], manualMapping?: Partial<Record<ImportFieldKey, string>>) => {
  const normalizedToOriginal = new Map<string, string>();
  headers.forEach((header) => normalizedToOriginal.set(normalizeHeader(header), header));

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
      .filter((h): h is string => Boolean(h));

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

  const uniqueHeaders = Object.values(mapping).filter(Boolean) as string[];
  const duplicateHeaders = uniqueHeaders.filter((header, idx) => uniqueHeaders.indexOf(header) !== idx);
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

export const parseScheduleImportFile = async (
  file: File,
  manualMapping?: Partial<Record<ImportFieldKey, string>>,
): Promise<ImportPreviewResult> => {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];

  if (!rows.length) {
    return {
      fileName: file.name,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      requiresMapping: false,
      availableHeaders: [],
      mapping: {},
      issues: [{ type: "error", code: "EMPTY_SHEET", message: "Spreadsheet is empty.", action: "Provide a file with at least one data row." }],
      rows: [],
    };
  }

  const availableHeaders = Object.keys(rows[0]).map((h) => h.trim());
  const { mapping, issues: mappingIssues } = resolveHeaderMapping(availableHeaders, manualMapping);

  const previewRows: ImportPreviewRow[] = rows.map((row, idx) => {
    const rowIssues: ImportIssue[] = [];
    const dateValue = mapping.date ? row[mapping.date] : "";
    const date = normalizeDate(dateValue);

    if (!date) {
      rowIssues.push({
        type: "error",
        code: "INVALID_DATE",
        rowIndex: idx + 2,
        column: mapping.date,
        message: `Row ${idx + 2}: Date '${String(dateValue)}' is invalid.`,
        action: "Use YYYY-MM-DD or a valid Excel date value.",
      });
    }

    const assignments: Partial<Record<ImportFieldKey, string[]>> = {};

    IMPORT_FIELDS.filter((f) => f !== "date").forEach((field) => {
      const sourceColumn = mapping[field];
      if (!sourceColumn) return;
      const providers = parseProviderCell(row[sourceColumn]);
      assignments[field] = providers;

      const normalizedNames = providers.map((name) => name.toLowerCase());
      const duplicates = normalizedNames.filter((name, index) => normalizedNames.indexOf(name) !== index);
      if (duplicates.length) {
        rowIssues.push({
          type: "warning",
          code: "DUPLICATE_PROVIDER_IN_CELL",
          rowIndex: idx + 2,
          column: sourceColumn,
          message: `Row ${idx + 2}: Duplicate provider in ${sourceColumn}.`,
          action: "Remove duplicate names to avoid ambiguous assignments.",
        });
      }
    });

    return { date: date ?? "", assignments, issues: rowIssues };
  });

  const rowErrors = previewRows.filter((row) => row.issues.some((issue) => issue.type === "error")).length;
  const allIssues = [...mappingIssues, ...previewRows.flatMap((row) => row.issues)];
  const hasRequiredMapping = REQUIRED_FIELDS.every((field) => Boolean(mapping[field]));

  return {
    fileName: file.name,
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

export const applyScheduleImport = (preview: ImportPreviewResult) => {
  const store = useScheduleStore.getState();
  lastImportSnapshot = {
    providers: structuredClone(store.providers),
    slots: structuredClone(store.slots),
  };

  const providers = [...store.providers];
  const slots = [...store.slots];

  const getOrCreateProviderId = (name: string) => {
    const cleanName = name.trim();
    if (!cleanName || ["unassigned", "open", "n/a"].includes(cleanName.toLowerCase())) return null;

    let provider = providers.find((p) => p.name.toLowerCase() === cleanName.toLowerCase());
    if (!provider) {
      provider = {
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
      providers.push(provider);
    }
    return provider.id;
  };

  let appliedAssignments = 0;
  preview.rows.forEach((row) => {
    if (!row.date || row.issues.some((issue) => issue.type === "error")) return;

    Object.entries(row.assignments).forEach(([field, names]) => {
      const slotSpec = fieldToSlotSpec[field as ImportFieldKey];
      if (!slotSpec || !names?.length) return;

      const slot = slots.find((s) => s.date === row.date && s.type === slotSpec.type && s.location.includes(slotSpec.locationIncludes));
      if (!slot) return;

      const providerId = getOrCreateProviderId(names[0]);
      if (!providerId) return;
      slot.providerId = providerId;
      appliedAssignments += 1;
    });
  });

  useScheduleStore.setState({ providers, slots });
  return { appliedAssignments, skippedRows: preview.invalidRows };
};

export const rollbackLastImport = () => {
  if (!lastImportSnapshot) return false;
  useScheduleStore.setState({
    providers: lastImportSnapshot.providers,
    slots: lastImportSnapshot.slots,
  });
  lastImportSnapshot = null;
  return true;
};

export const hasImportRollback = () => Boolean(lastImportSnapshot);

export const exportScheduleToExcel = () => {
  const { slots, startDate, providers } = useScheduleStore.getState();
  const slotsByDate: Record<string, typeof slots> = {};
  slots.forEach((s: any) => {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = [];
    slotsByDate[s.date].push(s);
  });

  const dates = Object.keys(slotsByDate).sort();
  const wsData: any[][] = [COLUMN_HEADERS];

  dates.forEach((date) => {
    const row = new Array(COLUMN_HEADERS.length).fill(null);
    const dateObj = new Date(`${date}T00:00:00`);

    if (dateObj.getDate() === 1 || date === dates[0]) {
      const monthRow = new Array(COLUMN_HEADERS.length).fill(format(dateObj, "MMMM"));
      wsData.push(monthRow);
    }

    row[0] = dateObj;

    const daySlots = slotsByDate[date];
    daySlots.forEach((slot: ShiftSlot) => {
      let colKey = `${slot.type}-${slot.location}`;
      if (!slotToColumnMap[colKey]) colKey = `${slot.type}-0`;
      const colIdx = slotToColumnMap[colKey];
      if (colIdx !== undefined && slot.providerId) {
        const p = providers.find((prov: Provider) => prov.id === slot.providerId);
        row[colIdx] = p ? p.name : "";
      }
    });

    wsData.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "NICU Institutional Schedule");
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([excelBuffer], { type: "application/octet-stream" }), `NICU_Schedule_${startDate}.xlsx`);
};
