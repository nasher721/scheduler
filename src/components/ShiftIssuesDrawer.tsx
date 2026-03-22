import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, X, Pencil } from "lucide-react";
import type { Conflict, ConflictSeverity, ShiftSlot } from "../store";
import { getShiftIssueMarkers, getUnresolvedConflictsForSlot, isCriticalUnfilledSlot } from "../lib/shiftConflictUtils";
import { format, parseISO } from "date-fns";

function severityStyles(severity: ConflictSeverity): { bar: string; label: string } {
  switch (severity) {
    case "CRITICAL":
      return { bar: "bg-rose-500", label: "text-rose-700" };
    case "WARNING":
      return { bar: "bg-amber-500", label: "text-amber-700" };
    default:
      return { bar: "bg-sky-500", label: "text-sky-700" };
  }
}

type ShiftIssuesDrawerProps = {
  slot: ShiftSlot | null;
  conflicts: Conflict[];
  isOpen: boolean;
  onClose: () => void;
  onEditShift: () => void;
};

export function ShiftIssuesDrawer({ slot, conflicts, isOpen, onClose, onEditShift }: ShiftIssuesDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const unresolved = slot ? getUnresolvedConflictsForSlot(slot.id, conflicts) : [];
  const markers = slot ? getShiftIssueMarkers(slot, conflicts) : null;

  return (
    <AnimatePresence>
      {isOpen && slot && markers && (
        <>
          <motion.button
            type="button"
            aria-label="Close issues panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[55] bg-slate-900/40"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="shift-issues-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed top-0 right-0 z-[60] flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="shift-issues-title" className="text-lg font-bold text-slate-900">
                  {slot.serviceLocation}
                </h2>
                <p className="text-sm text-slate-500">{format(parseISO(slot.date), "EEEE, MMMM d, yyyy")}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {isCriticalUnfilledSlot(slot) && (
                <div
                  className={`rounded-xl border p-4 ${
                    markers.isCriticalCoverageGap
                      ? "border-rose-300 bg-rose-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    Critical coverage
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {markers.isCriticalCoverageGap
                      ? "This priority‑1 shift has no assigned provider. Assign someone or adjust priority to resolve the gap."
                      : "Critical unfilled coverage is tracked below as a schedule issue."}
                  </p>
                </div>
              )}

              {unresolved.length === 0 && !isCriticalUnfilledSlot(slot) && (
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Info className="h-5 w-5 shrink-0 text-slate-500" />
                  <p className="text-sm text-slate-600">No open issues are recorded for this shift.</p>
                </div>
              )}

              {unresolved.map((c) => {
                const sev = severityStyles(c.severity);
                return (
                  <article key={c.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${sev.bar}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${sev.label}`}>{c.severity}</span>
                    </div>
                    <h3 className="mt-2 font-semibold text-slate-900">{c.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                    {c.suggestedActions.length > 0 && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Suggested actions</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
                          {c.suggestedActions.map((a) => (
                            <li key={a.id}>
                              <span className="font-medium">{a.label}</span>
                              <span className="text-slate-600"> — {a.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  onEditShift();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                <Pencil className="h-4 w-4" />
                Edit shift
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
