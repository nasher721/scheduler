import { useState, useMemo } from "react";
import { useScheduleStore, type ShiftType, type ShiftTypeFilter, type ServicePriority, type LocationGroup } from "../store";
import { motion } from "framer-motion";
import { 
  Calendar,
  Filter,
  Search,
  Download,
  Plus,
  AlertCircle,
  Shield,
  Building2,
  Stethoscope,
  Clock,
  Users,
  MapPin
} from "lucide-react";
import { format, isWeekend, isToday } from "date-fns";
import { useScheduleViewport } from "./schedule/useScheduleViewport";

// Service priority configuration with colors and icons
const servicePriorityConfig: Record<ServicePriority, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  description: string;
}> = {
  CRITICAL: {
    label: "Priority 1",
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    icon: <Shield className="w-4 h-4" />,
    description: "Must be staffed (G20, H22, Akron)"
  },
  STANDARD: {
    label: "Priority 2",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: <Clock className="w-4 h-4" />,
    description: "Important but flexible (Nights, Consults)"
  },
  FLEXIBLE: {
    label: "Priority 3",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    icon: <Users className="w-4 h-4" />,
    description: "As needed (Jeopardy, Recovery, NMET)"
  }
};

// Location group configuration
const locationGroupConfig: Record<LocationGroup, {
  label: string;
  icon: React.ReactNode;
  color: string;
}> = {
  MAIN_CAMPUS_UNIT: {
    label: "Main Campus Units",
    icon: <Building2 className="w-4 h-4" />,
    color: "text-blue-600"
  },
  MAIN_CAMPUS_SERVICE: {
    label: "Main Campus Services",
    icon: <Stethoscope className="w-4 h-4" />,
    color: "text-indigo-600"
  },
  AKRON_UNIT: {
    label: "Akron Unit",
    icon: <MapPin className="w-4 h-4" />,
    color: "text-teal-600"
  },
  SUPPORT_SERVICE: {
    label: "Support Services",
    icon: <Users className="w-4 h-4" />,
    color: "text-slate-600"
  }
};

// Shift type colors
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

// Group columns by service priority
interface GroupedColumn {
  priority: ServicePriority;
  locationGroup: LocationGroup;
  columns: Array<{
    type: ShiftType;
    location: string;
    serviceLocation: string;
    priority: ServicePriority;
    locationGroup: LocationGroup;
  }>;
}

export function ExcelGridView() {
  const { slots, providers, assignShift, detectConflicts, conflicts } = useScheduleStore();
  const { scheduleViewport, weekDates, setShiftTypeFilter, setProviderSearchTerm, setShowUnfilledOnly } = useScheduleViewport();
  const [editingCell, setEditingCell] = useState<CellEditState | null>(null);

  // Get unique shift types and locations for columns, grouped by priority
  const groupedColumns = useMemo((): GroupedColumn[] => {
    const uniqueShifts = new Map<string, {
      type: ShiftType;
      location: string;
      serviceLocation: string;
      priority: ServicePriority;
      locationGroup: LocationGroup;
    }>();
    
    slots.forEach(slot => {
      const key = `${slot.type}-${slot.serviceLocation}`;
      if (!uniqueShifts.has(key)) {
        uniqueShifts.set(key, {
          type: slot.type,
          location: slot.location,
          serviceLocation: slot.serviceLocation,
          priority: slot.servicePriority,
          locationGroup: slot.locationGroup
        });
      }
    });

    // Group by priority
    const groups: Record<ServicePriority, GroupedColumn> = {
      CRITICAL: { priority: "CRITICAL", locationGroup: "MAIN_CAMPUS_UNIT", columns: [] },
      STANDARD: { priority: "STANDARD", locationGroup: "MAIN_CAMPUS_SERVICE", columns: [] },
      FLEXIBLE: { priority: "FLEXIBLE", locationGroup: "SUPPORT_SERVICE", columns: [] }
    };

    uniqueShifts.forEach((shift) => {
      groups[shift.priority].columns.push(shift);
    });

    // Sort columns within each group
    Object.values(groups).forEach(group => {
      group.columns.sort((a, b) => {
        // Sort by location group first
        if (a.locationGroup !== b.locationGroup) {
          return a.locationGroup.localeCompare(b.locationGroup);
        }
        return a.serviceLocation.localeCompare(b.serviceLocation);
      });
    });

    return [groups.CRITICAL, groups.STANDARD, groups.FLEXIBLE].filter(g => g.columns.length > 0);
  }, [slots]);

  // Filter slots for current week
  const weekSlots = useMemo(() => {
    const dateStrs = weekDates.map(d => format(d, "yyyy-MM-dd"));
    return slots.filter(s => dateStrs.includes(s.date));
  }, [slots, weekDates]);

  // Get cell value for date + service location
  const getCellData = (date: Date, serviceLocation: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const slot = weekSlots.find(s => 
      s.date === dateStr && 
      s.serviceLocation === serviceLocation
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
  const filteredGroups = useMemo(() => {
    return groupedColumns.map(group => ({
      ...group,
      columns: group.columns.filter(col => 
        scheduleViewport.shiftTypeFilter === "all" || col.type === scheduleViewport.shiftTypeFilter
      )
    })).filter(group => group.columns.length > 0);
  }, [groupedColumns, scheduleViewport.shiftTypeFilter]);

  // Calculate coverage stats
  const coverageStats = useMemo(() => {
    const stats: Record<ServicePriority, { total: number; filled: number }> = {
      CRITICAL: { total: 0, filled: 0 },
      STANDARD: { total: 0, filled: 0 },
      FLEXIBLE: { total: 0, filled: 0 }
    };

    weekSlots.forEach(slot => {
      stats[slot.servicePriority].total++;
      if (slot.providerId) {
        stats[slot.servicePriority].filled++;
      }
    });

    return stats;
  }, [weekSlots]);

  // Export to CSV
  const exportCSV = () => {
    const allColumns = groupedColumns.flatMap(g => g.columns);
    const headers = ["Date", ...allColumns.map(c => c.serviceLocation)];
    const rows = weekDates.map(date => {
      const row = [format(date, "yyyy-MM-dd")];
      allColumns.forEach(col => {
        const data = getCellData(date, col.serviceLocation);
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
                Service-priority organized schedule
              </p>
            </div>
          </div>

          {/* Coverage Stats */}
          <div className="flex items-center gap-3">
            {Object.entries(coverageStats).map(([priority, stats]) => {
              const config = servicePriorityConfig[priority as ServicePriority];
              const percentage = stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0;
              return (
                <div key={priority} className={`px-3 py-2 rounded-xl ${config.bgColor} border ${config.borderColor}`}>
                  <div className="flex items-center gap-1.5">
                    {config.icon}
                    <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-700 mt-0.5">
                    {stats.filled}/{stats.total} ({percentage}%)
                  </div>
                </div>
              );
            })}
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
              <option value="all">All Services</option>
              <option value="DAY">Day Units (G20, H22, Akron)</option>
              <option value="NIGHT">Nights</option>
              <option value="CONSULTS">Consults</option>
              <option value="NMET">AMET/NMET</option>
              <option value="JEOPARDY">Jeopardy</option>
              <option value="RECOVERY">Recovery</option>
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
          {/* Header Row with Service Groups */}
          <thead className="sticky top-0 z-10">
            {/* Priority Group Headers */}
            <tr>
              <th className="bg-slate-100 border-b border-r border-slate-200 p-3 text-left text-xs font-bold text-slate-600 min-w-[120px]">
                Date
              </th>
              {filteredGroups.map((group) => (
                <th
                  key={group.priority}
                  colSpan={group.columns.length}
                  className={`${servicePriorityConfig[group.priority].bgColor} border-b border-r border-slate-200 p-2 text-center`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {servicePriorityConfig[group.priority].icon}
                    <span className={`text-xs font-bold ${servicePriorityConfig[group.priority].color}`}>
                      {servicePriorityConfig[group.priority].label}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">
                    {servicePriorityConfig[group.priority].description}
                  </div>
                </th>
              ))}
            </tr>
            {/* Column Headers */}
            <tr>
              <th className="bg-slate-50 border-b border-r border-slate-200 p-2"></th>
              {filteredGroups.flatMap((group) =>
                group.columns.map((col, idx) => {
                  const colors = shiftColors[col.type];
                  const locGroup = locationGroupConfig[col.locationGroup];
                  return (
                    <th
                      key={`${col.serviceLocation}-${idx}`}
                      className={`${colors.bg} border-b border-r border-slate-200 p-3 text-left min-w-[100px]`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${colors.text}`}>{col.serviceLocation}</span>
                        {col.priority === "CRITICAL" && (
                          <span className="px-1 py-0.5 bg-rose-100 text-rose-600 text-[8px] font-bold rounded">
                            REQ
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {locGroup.icon}
                        <span className="text-[9px] text-slate-500 truncate">{locGroup.label}</span>
                      </div>
                    </th>
                  );
                })
              )}
            </tr>
          </thead>

          {/* Data Rows */}
          <tbody>
            {weekDates.map((date) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const isWeekendDay = isWeekend(date);
              const isTodayDay = isToday(date);

              // Check if row should be shown based on filters
              const rowHasVisibleCells = filteredGroups.some(group =>
                group.columns.some(col => {
                  const data = getCellData(date, col.serviceLocation);
                  if (scheduleViewport.showUnfilledOnly) {
                    return !data?.provider;
                  }
                  if (scheduleViewport.providerSearchTerm) {
                    return data?.provider?.name.toLowerCase().includes(scheduleViewport.providerSearchTerm.toLowerCase());
                  }
                  return true;
                })
              );

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
                  {filteredGroups.flatMap((group) =>
                    group.columns.map((col, colIdx) => {
                      const data = getCellData(date, col.serviceLocation);
                      if (!data) return <td key={`${col.serviceLocation}-${colIdx}`} className="border-b border-r border-slate-200 p-2 bg-slate-50/10" />;

                      const { slot, provider, conflict } = data;
                      const colors = shiftColors[col.type];
                      const isEditing = editingCell?.slotId === slot.id;
                      const isCriticalUnfilled = col.priority === "CRITICAL" && !provider;

                      return (
                        <td
                          key={`${col.serviceLocation}-${colIdx}`}
                          className={`border-b border-r border-slate-200 p-2 ${colors.bg}/30 hover:${colors.bg}/50 transition-colors ${
                            isCriticalUnfilled ? 'bg-rose-50 ring-1 ring-rose-200' : ''
                          }`}
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
                                  {slot.isSharedAssignment && slot.secondaryProviderIds && slot.secondaryProviderIds.length > 0 && (
                                    <span className="px-1 py-0.5 bg-slate-200 text-slate-600 text-[8px] rounded">
                                      +{slot.secondaryProviderIds.length}
                                    </span>
                                  )}
                                  {conflict && (
                                    <div className="relative group" title={conflict.title}>
                                      <AlertCircle className="w-3.5 h-3.5 text-error" />
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="flex items-center gap-2 text-slate-400">
                                  {isCriticalUnfilled ? (
                                    <>
                                      <AlertCircle className="w-4 h-4 text-rose-400" />
                                      <span className="text-sm text-rose-400 font-medium italic">Required</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      <span className="text-sm italic">Empty</span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })
                  )}
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
            Day Unit
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Nights
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            Consults
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            AMET/NMET
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
            <Shield className="w-3 h-3 text-rose-500" />
            Critical (Must staff)
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500" />
            Standard (Flexible)
          </span>
          <span className="ml-auto">Double-click any cell to edit</span>
        </div>
      </div>
    </motion.div>
  );
}
