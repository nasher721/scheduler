import { useRef } from "react";
import { motion } from "framer-motion";
import { useScheduleStore } from "../store";
import { format, parseISO, addDays, eachDayOfInterval, isWeekend } from "date-fns";
import { 
  Printer, 
  X
} from "lucide-react";

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

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printStyles = `
      @media print {
        @page {
          size: landscape;
          margin: 0.5in;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #000;
          background: #fff;
        }
        .print-page {
          page-break-after: always;
          page-break-inside: avoid;
        }
        .print-page:last-child {
          page-break-after: avoid;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
        }
        th, td {
          border: 1px solid #ccc;
          padding: 6px 8px;
          text-align: left;
        }
        th {
          background: #f5f5f5;
          font-weight: 600;
        }
        .weekend {
          background: #fafafa;
        }
        .critical {
          font-weight: 600;
        }
        .empty {
          color: #999;
          font-style: italic;
        }
        .header {
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #333;
        }
        .header h1 {
          margin: 0 0 5px 0;
          font-size: 18pt;
        }
        .header p {
          margin: 0;
          color: #666;
          font-size: 10pt;
        }
        .legend {
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #ccc;
          font-size: 9pt;
        }
        .legend-item {
          display: inline-block;
          margin-right: 20px;
        }
        .no-print {
          display: none !important;
        }
      }
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Schedule Print</title>
          <style>${printStyles}</style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    // Wait for styles to load
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
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
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-6 bg-slate-100">
          <div ref={printRef} className="space-y-8">
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

import type { ShiftSlot, Provider } from "../store";

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
    <div className="print-page bg-white p-8 shadow-lg">
      {/* Header */}
      <div className="header">
        <h1>Neuro ICU Schedule - Week {weekNumber}</h1>
        <p>{format(weekStart, "MMMM d")} - {format(weekEnd, "MMMM d, yyyy")}</p>
      </div>

      {/* Schedule Table */}
      <table>
        <thead>
          <tr>
            <th style={{ width: '12%' }}>Date</th>
            {serviceLocations.map(loc => (
              <th key={loc} style={{ width: `${88 / serviceLocations.length}%` }}>{loc}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const daySlots = slotsByDate.get(dateStr) || [];
            const isWeekendDay = isWeekend(day);

            return (
              <tr key={dateStr} className={isWeekendDay ? 'weekend' : ''}>
                <td className={isWeekendDay ? 'weekend' : ''}>
                  <strong>{format(day, "EEE")}</strong>
                  <br />
                  {format(day, "MMM d")}
                </td>
                {serviceLocations.map((loc: string) => {
                  const slot = daySlots.find((s: ShiftSlot) => s.serviceLocation === loc);
                  const providerName = slot ? getProviderName(slot.providerId) : null;
                  const isCritical = slot?.servicePriority === 'CRITICAL';

                  return (
                    <td 
                      key={loc} 
                      className={`
                        ${isWeekendDay ? 'weekend' : ''}
                        ${isCritical ? 'critical' : ''}
                        ${!providerName ? 'empty' : ''}
                      `}
                    >
                      {providerName || (isCritical ? '⚠ REQUIRED' : '—')}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="legend">
        <strong>Legend:</strong>
        <span className="legend-item">⚠ = Critical shift unfilled</span>
        <span className="legend-item">— = Empty shift</span>
        <span className="legend-item">Gray background = Weekend</span>
        <span className="legend-item">Bold text = Critical priority</span>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500">
        Printed on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
      </div>
    </div>
  );
}

// Print button for the main calendar
export function PrintButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
      title="Print-optimized view"
    >
      <Printer className="w-4 h-4" />
      <span className="hidden sm:inline">Print</span>
    </button>
  );
}
