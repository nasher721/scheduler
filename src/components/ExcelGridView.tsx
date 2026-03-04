import { useState, useMemo } from "react";
import { useScheduleStore, type ShiftType, type ShiftTypeFilter } from "../store";
import { motion } from "framer-motion";
import { 
  Calendar,
  Filter,
  Search,
  Download,
  Plus,
  AlertCircle
} from "lucide-react";
import { format, isWeekend, isToday } from "date-fns";
import { useScheduleViewport } from "./schedule/useScheduleViewport";

const shiftColors: Record<ShiftType, { bg: string; text: string; border: string }> = {
  DAY: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  NIGHT: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  NMET: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  JEOPARDY: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  RECOVERY: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  CONSULTS: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  VACATION: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
};

interface CellEditState {
  slotId: string;
  value: string;
}

export function ExcelGridView() {
  const { slots, providers, assignShift, detectConflicts, conflicts } = useScheduleStore();
  const { scheduleViewport, weekDates, setShiftTypeFilter, setProviderSearchTerm, setShowUnfilledOnly } = useScheduleViewport();
  const [editingCell, setEditingCell] = useState<CellEditState | null>(null);

  // Get unique shift types and locations for columns
  const shiftColumns = useMemo(() => {
    const uniqueShifts = new Map<string, { type: ShiftType; location: string }>();
    slots.forEach(slot => {
      const key = `${slot.type}-${slot.location}`;
      if (!uniqueShifts.has(key)) {
        uniqueShifts.set(key, { type: slot.type, location: slot.location });
      }
    });
    return Array.from(uniqueShifts.values());
  }, [slots]);

  // Filter slots for current week
  const weekSlots = useMemo(() => {
    const dateStrs = weekDates.map(d => format(d, "yyyy-MM-dd"));
    return slots.filter(s => dateStrs.includes(s.date));
  }, [slots, weekDates]);

  // Get cell value for date + shift
  const getCellData = (date: Date, shiftType: ShiftType, location: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const slot = weekSlots.find(s => 
      s.date === dateStr && 
      s.type === shiftType && 
      s.location === location
    );
    if (!slot) return null;
    
    const provider = providers.find(p => p.id === slot.providerId);
    const conflict = conflicts.find(c => c.slotId === slot.id && !c.resolvedAt);
    
    return { slot, provider, conflict };
  };

  // Handle cell edit
  const handleCellEdit = (slotId: string, providerName: string) => {
    const provider = providers.find(p => 
      p.name.toLowerCase() === providerName.toLowerCase().trim()
    );
    
    if (provider) {
      assignShift(slotId, provider.id);
      detectConflicts();
    } else if (providerName.trim() === "" || providerName.toLowerCase() === "clear") {
      assignShift(slotId, null);
      detectConflicts();
    }
    setEditingCell(null);
  };

  // Filter columns based on search
  const filteredColumns = shiftColumns.filter(col => 
    scheduleViewport.shiftTypeFilter === "all" || col.type === scheduleViewport.shiftTypeFilter
  );

  // Export to CSV
  const exportCSV = () => {
    const headers = ["Date", ...filteredColumns.map(c => `${c.type} (${c.location})`)];
    const rows = weekDates.map(date => {
      const row = [format(date, "yyyy-MM-dd")];
      filteredColumns.forEach(col => {
        const data = getCellData(date, col.type, col.location);
        row.push(data?.provider?.name || "");
      });
      return row;
    });
    
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-${format(weekDates[0], "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="satin-panel bg-white/60 rounded-[2rem] border border-slate-200/40 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-primary/5 rounded-2xl text-primary">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-serif text-slate-900">Excel Grid View</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                Spreadsheet-style editing
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search providers..."
              value={scheduleViewport.providerSearchTerm}
              onChange={(e) => setProviderSearchTerm(e.target.value)}
              className="bg-transparent border-none text-sm text-slate-700 focus:outline-none w-40"
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={scheduleViewport.shiftTypeFilter}
              onChange={(e) => setShiftTypeFilter(e.target.value as ShiftTypeFilter)}
              className="bg-transparent border-none text-sm text-slate-700 focus:outline-none"
            >
              <option value="all">All Shifts</option>
              <option value="DAY">Day</option>
              <option value="NIGHT">Night</option>
              <option value="CONSULTS">Consults</option>
              <option value="JEOPARDY">Jeopardy</option>
            </select>
          </div>

          <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleViewport.showUnfilledOnly}
              onChange={(e) => setShowUnfilledOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-slate-600">Unfilled only</span>
          </label>
        </div>
      </div>

      {/* Excel Grid */}
      <div className="overflow-auto max-h-[calc(100vh-400px)]">
        <table className="w-full">
          {/* Header Row */}
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="bg-slate-100 border-b border-r border-slate-200 p-3 text-left text-xs font-bold text-slate-600 min-w-[120px]">
                Date
              </th>
              {filteredColumns.map((col, idx) => {
                const colors = shiftColors[col.type];
                return (
                  <th 
                    key={idx}
                    className={`${colors.bg} border-b border-r border-slate-200 p-3 text-left min-w-[140px]`}
                  >
                    <div className={`text-xs font-bold ${colors.text}`}>{col.type}</div>
                    <div className="text-[10px] text-slate-500 truncate">{col.location}</div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Data Rows */}
          <tbody>
            {weekDates.map((date) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const isWeekendDay = isWeekend(date);
              const isTodayDay = isToday(date);

              // Check if row should be shown based on filters
              const rowHasVisibleCells = filteredColumns.some(col => {
                const data = getCellData(date, col.type, col.location);
                if (scheduleViewport.showUnfilledOnly) {
                  return !data?.provider;
                }
                if (scheduleViewport.providerSearchTerm) {
                  return data?.provider?.name.toLowerCase().includes(scheduleViewport.providerSearchTerm.toLowerCase());
                }
                return true;
              });

              if (!rowHasVisibleCells && (scheduleViewport.showUnfilledOnly || scheduleViewport.providerSearchTerm)) {
                return null;
              }

              return (
                <tr 
                  key={dateStr}
                  className={`${isWeekendDay ? 'bg-amber-50/30' : ''} ${isTodayDay ? 'ring-2 ring-primary/20' : ''}`}
                >
                  {/* Date Cell */}
                  <td className={`border-b border-r border-slate-200 p-3 ${isWeekendDay ? 'bg-amber-50/50' : 'bg-slate-50/30'}`}>
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${isTodayDay ? 'text-primary' : 'text-slate-700'}`}>
                        {format(date, "EEE, MMM d")}
                      </span>
                      {isTodayDay && (
                        <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Today</span>
                      )}
                      {isWeekendDay && !isTodayDay && (
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Weekend</span>
                      )}
                    </div>
                  </td>

                  {/* Shift Cells */}
                  {filteredColumns.map((col, colIdx) => {
                    const data = getCellData(date, col.type, col.location);
                    if (!data) return <td key={colIdx} className="border-b border-r border-slate-200 p-2 bg-slate-50/10" />;
                    
                    const { slot, provider, conflict } = data;
                    const colors = shiftColors[col.type];
                    const isEditing = editingCell?.slotId === slot.id;

                    return (
                      <td 
                        key={colIdx} 
                        className={`border-b border-r border-slate-200 p-2 ${colors.bg}/30 hover:${colors.bg}/50 transition-colors`}
                        onDoubleClick={() => setEditingCell({ slotId: slot.id, value: provider?.name || "" })}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              type="text"
                              defaultValue={provider?.name || ""}
                              onBlur={(e) => handleCellEdit(slot.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleCellEdit(slot.id, e.currentTarget.value);
                                } else if (e.key === "Escape") {
                                  setEditingCell(null);
                                }
                              }}
                              className="w-full px-2 py-1 text-sm border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                              placeholder="Provider name"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            {provider ? (
                              <>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                  conflict ? 'bg-error' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                }`}>
                                  {provider.name.charAt(0).toUpperCase()}
                                </div>
                                <span className={`text-sm font-medium truncate ${conflict ? 'text-error' : 'text-slate-700'}`}>
                                  {provider.name}
                                </span>
                                {conflict && (
                                  <div className="relative group" title={conflict.title}>
                                    <AlertCircle className="w-3.5 h-3.5 text-error" />
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="flex items-center gap-2 text-slate-400">
                                <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="text-sm italic">Empty</span>
                              </div>
                            )}
                          </div>
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

      {/* Footer Legend */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex flex-wrap gap-4 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Day Shift
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Night Shift
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            NMET
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Jeopardy
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            Recovery
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            Consults
          </span>
          <span className="ml-auto">Double-click any cell to edit</span>
        </div>
      </div>
    </motion.div>
  );
}
