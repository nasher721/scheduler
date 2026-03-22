import { useRef } from "react";
import { motion } from "framer-motion";
import { useScheduleStore, type ShiftSlot, type Provider } from "../store";
import { format, parseISO, addDays, eachDayOfInterval, isWeekend } from "date-fns";
import { Printer, X } from "lucide-react";
import printScheduleCss from "../styles/print-schedule.css?raw";

interface PrintScheduleViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrintScheduleView({ isOpen, onClose }: PrintScheduleViewProps) {
  const { slots, providers, startDate, numWeeks } = useScheduleStore();
  const printRef = useRef<HTMLDivElement>(null);

  // Get all weeks in the schedule
  const weeks = [];
  const scheduleStart = parseISO(startDate);
  for (let i = 0; i < numWeeks; i++) {
    const weekStart = addDays(scheduleStart, i * 7);
    const weekEnd = addDays(weekStart, 6);
    weeks.push({
      start: weekStart,
      end: weekEnd,
      label: `Week ${i + 1}: ${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")}`
    });
  }

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const fontHref =
      "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&display=swap";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Neuro ICU — Schedule print</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
          <link rel="stylesheet" href="${fontHref}" />
          <style>${printScheduleCss}</style>
        </head>
        <body>
          <div class="print-schedule">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    const runPrint = () => {
      printWindow.print();
      printWindow.close();
    };

    const fontsReady = printWindow.document.fonts?.ready;
    if (fontsReady) {
      fontsReady
        .then(() => setTimeout(runPrint, 50))
        .catch(() => setTimeout(runPrint, 400));
    } else {
      setTimeout(runPrint, 400);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-4 md:inset-6 bg-white rounded-2xl shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Printer className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Print Schedule</h2>
              <p className="text-sm text-slate-500">{numWeeks} weeks • Print-optimized layout</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Close print preview"
            >
              <X className="w-5 h-5 text-slate-500" aria-hidden />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-6 bg-slate-100">
          <div ref={printRef} className="print-schedule space-y-8">
            {weeks.map((week, weekIndex) => (
              <PrintableWeek
                key={weekIndex}
                weekStart={week.start}
                weekEnd={week.end}
                weekNumber={weekIndex + 1}
                slots={slots}
                providers={providers}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}

interface PrintableWeekProps {
  weekStart: Date;
  weekEnd: Date;
  weekNumber: number;
  slots: ShiftSlot[];
  providers: Provider[];
}

function PrintableWeek({ weekStart, weekEnd, weekNumber, slots, providers }: PrintableWeekProps) {
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  // Get unique service locations (columns)
  const serviceLocations = Array.from(
    new Set(slots.map((s: ShiftSlot) => s.serviceLocation))
  ).sort();

  // Group slots by date
  const slotsByDate = new Map<string, ShiftSlot[]>();
  weekDays.forEach(day => {
    const dateStr = format(day, "yyyy-MM-dd");
    const daySlots = slots.filter((s: ShiftSlot) => s.date === dateStr);
    slotsByDate.set(dateStr, daySlots);
  });

  const getProviderName = (providerId: string | null) => {
    if (!providerId) return null;
    return providers.find((p: Provider) => p.id === providerId)?.name || 'Unknown';
  };

  return (
    <div className="print-page">
      <header className="print-schedule-header">
        <div className="print-schedule-header__accent" aria-hidden />
        <div className="print-schedule-header__body">
          <p className="print-schedule-kicker">Neuro ICU · Coverage roster</p>
          <h1 className="print-schedule-title">Week {weekNumber}</h1>
          <p className="print-schedule-subtitle">
            {format(weekStart, "MMMM d")} – {format(weekEnd, "MMMM d, yyyy")}
          </p>
        </div>
      </header>

      <div className="print-schedule-table-wrap">
        <table className="print-schedule-table">
          <thead>
            <tr>
              <th scope="col" className="print-schedule-th-date">
                Date
              </th>
              {serviceLocations.map((loc) => (
                <th key={loc} scope="col" className="print-schedule-th-loc">
                  {loc}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const daySlots = slotsByDate.get(dateStr) || [];
              const isWeekendDay = isWeekend(day);

              return (
                <tr key={dateStr} className={isWeekendDay ? "print-weekend-row" : undefined}>
                  <td className="print-date-cell">
                    <span className="print-day-name">{format(day, "EEE")}</span>
                    <span className="print-day-num">{format(day, "MMM d")}</span>
                  </td>
                  {serviceLocations.map((loc: string) => {
                    const slot = daySlots.find((s: ShiftSlot) => s.serviceLocation === loc);
                    const providerName = slot ? getProviderName(slot.providerId) : null;
                    const isCritical = slot?.servicePriority === "CRITICAL";
                    const showUnfilledCritical = !providerName && isCritical;

                    let cellClass = "print-shift-cell";
                    if (providerName && isCritical) cellClass += " print-cell-critical";
                    if (!providerName && !showUnfilledCritical) cellClass += " print-cell-empty";
                    if (showUnfilledCritical) cellClass += " print-cell-unfilled";

                    return (
                      <td key={loc} className={cellClass}>
                        {providerName ? (
                          <>
                            {providerName}
                            {isCritical ? (
                              <span className="print-critical-badge" title="Critical priority">
                                Critical
                              </span>
                            ) : null}
                          </>
                        ) : showUnfilledCritical ? (
                          <>
                            Required
                            <span className="print-critical-badge" title="Unfilled critical shift">
                              Open
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="print-schedule-legend" role="note">
        <strong>Key</strong>
        <span className="print-schedule-legend__item">
          <span className="print-legend-swatch print-legend-swatch--critical" aria-hidden />
          Critical / open shift
        </span>
        <span className="print-schedule-legend__item">
          <span className="print-legend-swatch print-legend-swatch--weekend" aria-hidden />
          Weekend row
        </span>
        <span className="print-schedule-legend__item">— Empty / unassigned</span>
      </div>

      <footer className="print-schedule-footer">
        <span className="print-schedule-footer__stamp">
          Printed {format(new Date(), "MMMM d, yyyy '·' h:mm a")}
        </span>
        <span className="print-schedule-footer__notice">
          Neuro ICU Scheduler · Confidential — for clinical coordination only
        </span>
      </footer>
    </div>
  );
}

// Print button for the main calendar
export function PrintButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
      title="Print-optimized view"
    >
      <Printer className="w-4 h-4" />
      <span className="hidden sm:inline">Print</span>
    </button>
  );
}
