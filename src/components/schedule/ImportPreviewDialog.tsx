import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, X } from "lucide-react";
import type { ImportFieldKey, ImportPreviewResult } from "@/lib/excelUtils";

const FIELDS: { key: ImportFieldKey; label: string }[] = [
  { key: "date", label: "Date (required)" }, { key: "night", label: "Night" },
  { key: "dayG20", label: "G20" }, { key: "dayH22", label: "H22" },
  { key: "dayAkron", label: "Akron" }, { key: "consults", label: "Consults" },
  { key: "dayAmet", label: "AMET" }, { key: "dayNmet", label: "NMET" },
  { key: "jeopardy", label: "Jeopardy" }, { key: "recovery", label: "Recovery" },
  { key: "vacation", label: "Vacation" },
];

interface Props {
  preview: ImportPreviewResult;
  mapping: Partial<Record<ImportFieldKey, string>>;
  busy: boolean;
  onMappingChange: (field: ImportFieldKey, value: string) => void;
  onValidate: () => void;
  onApply: () => void;
  onClose: () => void;
}

export function ImportPreviewDialog({ preview, mapping, busy, onMappingChange, onValidate, onApply, onClose }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const changed = FIELDS.some(({ key }) => (mapping[key] || "") !== (preview.mapping[key] || ""));
  const hasErrors = preview.issues.some((issue) => issue.type === "error") || preview.invalidRows > 0;
  const hasAssignmentMapping = FIELDS.some(({ key }) => key !== "date" && Boolean(mapping[key]));
  const canApply = !busy && !changed && !preview.requiresMapping && Boolean(mapping.date) && hasAssignmentMapping && !hasErrors && preview.validRows > 0;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), summary, [tabindex="0"]') ?? []).filter((item) => item.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-3 backdrop-blur-sm sm:p-6">
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="import-title" aria-describedby="import-description" className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl outline-none">
        <header className="flex items-start gap-3 border-b border-border p-5">
          <FileSpreadsheet className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1"><h2 id="import-title" className="text-xl font-semibold">Review your workbook</h2><p className="mt-1 truncate text-sm text-foreground-secondary">{preview.fileName}</p></div>
          <button type="button" onClick={onClose} aria-label="Close import preview" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-secondary"><X className="h-5 w-5" /></button>
        </header>
        <div className="space-y-5 overflow-y-auto p-5">
          <p id="import-description" className="text-sm leading-relaxed text-foreground-secondary">Check the dates and assignments before importing. Your schedule changes only when you select Apply import. You can restore the previous schedule with Roll back last import in More actions.</p>
          <div role="status" className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
            {hasErrors || preview.requiresMapping || !hasAssignmentMapping ? <AlertCircle className="h-5 w-5 shrink-0 text-error" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
            <p className="text-sm"><strong>{preview.validRows}</strong> valid rows <span className="mx-2 text-foreground-muted">/</span> {preview.totalRows} total{preview.invalidRows > 0 && <span className="ml-2 font-medium text-error">· {preview.invalidRows} need correction</span>}</p>
          </div>
          {!hasAssignmentMapping && <p role="alert" className="text-sm text-error">Map at least one service or vacation column before applying this workbook.</p>}
          <details open={preview.requiresMapping || !hasAssignmentMapping || undefined} className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer py-1 text-sm font-medium">Review column mapping</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {FIELDS.map(({ key, label }) => <label key={key} className="flex flex-col gap-1 text-sm text-foreground-secondary">{label}<select value={mapping[key] || ""} onChange={(event) => onMappingChange(key, event.target.value)} className="min-h-11 rounded-md border border-border bg-surface px-3 text-sm text-foreground"><option value="">Not mapped</option>{preview.availableHeaders.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}
            </div>
            <button type="button" disabled={busy} onClick={onValidate} className="mt-4 flex min-h-11 items-center gap-2 rounded-md border border-primary/40 px-4 text-sm font-medium text-primary disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Re-validate mapping</button>
          </details>
          {changed && <p role="status" className="text-sm text-primary">Column mapping changed. Re-validate before applying.</p>}
          {preview.issues.length > 0 && <section aria-label="Import issues"><h3 className="mb-2 text-base font-semibold">{hasErrors ? "Resolve these issues" : "Before you continue"}</h3><ul className="max-h-40 space-y-2 overflow-y-auto text-sm text-foreground-secondary">{preview.issues.map((issue, index) => <li key={`${issue.code}-${index}`}><span className={issue.type === "error" ? "font-semibold text-error" : "font-semibold text-foreground"}>{issue.type === "error" ? "Error: " : "Note: "}</span>{issue.message}{issue.action && ` ${issue.action}`}</li>)}</ul></section>}
          <div className="max-h-64 overflow-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><caption className="bg-background p-3 text-left font-medium">Assignment preview · first {Math.min(30, preview.rows.length)} rows</caption><thead className="sticky top-0 bg-background text-foreground-secondary"><tr><th scope="col" className="p-3">Date</th><th scope="col" className="p-3">Assignments</th><th scope="col" className="p-3">Status</th></tr></thead><tbody>{preview.rows.slice(0, 30).map((row, index) => <tr key={`${row.date}-${index}`} className="border-t border-border"><td className="whitespace-nowrap p-3 tabular-nums">{row.date || "Missing"}</td><td className="p-3">{Object.values(row.assignments).flat().join(", ") || "No assignments"}</td><td className="p-3">{row.issues.some((issue) => issue.type === "error") ? "Invalid" : row.issues.length ? "Review" : "Valid"}</td></tr>)}</tbody></table></div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border bg-background px-5 py-4"><button type="button" onClick={onClose} className="min-h-11 rounded-md border border-border bg-surface px-4 text-sm font-medium">Cancel</button><button type="button" disabled={!canApply} onClick={onApply} className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">Apply import</button></footer>
      </div>
    </div>
  );
}
