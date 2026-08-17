import { Calendar, FileSpreadsheet, Printer, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { motion } from "framer-motion";
import { exportScheduleToExcel } from "@/lib/excelUtils";
import { generateProviderICal } from "@/lib/icalUtils";
import { useScheduleStore } from "@/store";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Replaces the old nested export dropdown: one sheet holding every way the
 * schedule leaves the app — workbook, print/PDF, and per-clinician calendars.
 */
export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const { providers, slots, showToast } = useScheduleStore(
    useShallow((s) => ({ providers: s.providers, slots: s.slots, showToast: s.showToast })),
  );

  if (!isOpen) return null;

  const handleExcelExport = async () => {
    onClose();
    try {
      const result = await exportScheduleToExcel();
      if (result.success) {
        showToast({
          type: "success",
          title: "Export complete",
          message: "Downloaded the institutional schedule workbook (NICU_Schedule.xlsx).",
        });
      } else {
        showToast({
          type: "error",
          title: "Export failed",
          message: result.error?.message || "Failed to generate the Excel workbook.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Export failed",
        message: "An unexpected error occurred while generating the Excel file.",
      });
    }
  };

  const handlePersonalExport = (providerId: string) => {
    const provider = providers.find((entry) => entry.id === providerId);
    if (!provider) return;
    const result = generateProviderICal(provider, slots);
    if (!result.ok) {
      showToast({ type: "info", title: "Nothing to export", message: result.error });
    } else {
      showToast({
        type: "success",
        title: "Calendar exported",
        message: `Downloaded the iCal file for ${provider.name}.`,
      });
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        role="dialog"
        aria-label="Export schedule"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 className="text-[15px] font-semibold tracking-tight">Export</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-2">
          <button
            type="button"
            onClick={handleExcelExport}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-secondary/70"
          >
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-foreground-muted" strokeWidth={1.8} />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium">Institutional workbook</span>
              <span className="block text-xs text-foreground-muted">Every service and date as .xlsx</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              window.print();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-secondary/70"
          >
            <Printer className="h-4 w-4 shrink-0 text-foreground-muted" strokeWidth={1.8} />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium">Print or save as PDF</span>
              <span className="block text-xs text-foreground-muted">Uses the print layout</span>
            </span>
          </button>
        </div>

        <div className="border-t border-border/70 p-2">
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-foreground-muted">
            Personal calendar (.ics)
          </p>
          <div className="max-h-56 overflow-auto">
            {providers.length > 0 ? (
              providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handlePersonalExport(provider.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary/70"
                >
                  <span className="truncate text-[13px] font-medium">{provider.name}</span>
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
                </button>
              ))
            ) : (
              <p className="px-2.5 py-1.5 text-xs text-foreground-muted">
                Add clinicians to unlock personal calendar exports.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
