import { useState, useMemo } from "react";
import { useScheduleStore, type ShiftType } from "../store";
import { motion } from "framer-motion";
import { Calendar, Gift, AlertCircle, ChevronLeft, ChevronRight, User } from "lucide-react";
import { format } from "date-fns";

// Major US holidays for 2025-2027
const HOLIDAY_DEFINITIONS = [
  { name: "New Year's Day", month: 0, day: 1 },
  { name: "MLK Day", type: "third-monday", month: 0 },
  { name: "Memorial Day", type: "last-monday", month: 4 },
  { name: "Independence Day", month: 6, day: 4 },
  { name: "Labor Day", type: "first-monday", month: 8 },
  { name: "Thanksgiving", type: "fourth-thursday", month: 10 },
  { name: "Christmas Day", month: 11, day: 25 },
];

function getHolidayDate(holiday: typeof HOLIDAY_DEFINITIONS[0], year: number): Date | null {
  if (holiday.day !== undefined) {
    return new Date(year, holiday.month, holiday.day);
  }
  
  // Calculate floating holidays
  const firstDay = new Date(year, holiday.month, 1);
  const dayOfWeek = firstDay.getDay();
  
  if (holiday.type === "first-monday") {
    const daysUntilMonday = (1 - dayOfWeek + 7) % 7;
    return new Date(year, holiday.month, 1 + daysUntilMonday);
  }
  
  if (holiday.type === "third-monday") {
    const daysUntilMonday = (1 - dayOfWeek + 7) % 7;
    return new Date(year, holiday.month, 1 + daysUntilMonday + 14);
  }
  
  if (holiday.type === "fourth-thursday") {
    const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
    return new Date(year, holiday.month, 1 + daysUntilThursday + 21);
  }
  
  if (holiday.type === "last-monday") {
    const lastDay = new Date(year, holiday.month + 1, 0);
    const lastDayOfWeek = lastDay.getDay();
    const daysSinceMonday = (lastDayOfWeek - 1 + 7) % 7;
    return new Date(year, holiday.month, lastDay.getDate() - daysSinceMonday);
  }
  
  return null;
}

export function HolidayTracker() {
  const { 
    providers, 
    slots, 
    holidayAssignments, 
    addHolidayAssignment, 
    removeHolidayAssignment,
    getProviderHolidayCount 
  } = useScheduleStore();
  
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedHoliday, setSelectedHoliday] = useState<string | null>(null);

  // Calculate holidays for the selected year
  const holidays = useMemo(() => {
    return HOLIDAY_DEFINITIONS.map(h => {
      const date = getHolidayDate(h, selectedYear);
      if (!date) return null;
      
      const dateStr = format(date, "yyyy-MM-dd");
      const assignment = holidayAssignments.find(a => a.date === dateStr);
      const slot = slots.find(s => s.date === dateStr);
      
      return {
        name: h.name,
        date: dateStr,
        displayDate: format(date, "MMMM d, yyyy"),
        dayOfWeek: format(date, "EEEE"),
        assignment,
        slot,
      };
    }).filter(Boolean);
  }, [selectedYear, holidayAssignments, slots]);

  // Calculate provider holiday counts for fairness
  const providerHolidayCounts = useMemo(() => {
    return providers.map(p => ({
      provider: p,
      count: getProviderHolidayCount(p.id, selectedYear),
    })).sort((a, b) => a.count - b.count);
  }, [providers, selectedYear, getProviderHolidayCount]);

  const handleAssign = (holidayName: string, date: string, providerId: string, shiftType: ShiftType) => {
    addHolidayAssignment({
      holidayName,
      date,
      providerId,
      shiftType,
    });
  };

  const getAssignmentStatus = (holidayName: string, date: string) => {
    const assignment = holidayAssignments.find(
      a => a.holidayName === holidayName && a.date === date
    );
    if (assignment) {
      return {
        assigned: true,
        provider: providers.find(p => p.id === assignment.providerId),
        shiftType: assignment.shiftType,
      };
    }
    return { assigned: false };
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="satin-panel p-6 bg-white/60 rounded-[2rem] border border-slate-200/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-primary/5 rounded-2xl text-primary">
            <Gift className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-serif text-slate-900">Holiday Tracker</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              Ensure equitable holiday distribution
            </p>
          </div>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYear(y => y - 1)}
            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-slate-700 w-20 text-center">{selectedYear}</span>
          <button
            onClick={() => setSelectedYear(y => y + 1)}
            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Fairness Summary */}
      <div className="mb-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-200/60">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
          Holiday Load Distribution
        </h3>
        <div className="flex flex-wrap gap-2">
          {providerHolidayCounts.map(({ provider, count }) => (
            <div
              key={provider.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold ${
                count === 0
                  ? "bg-success/10 text-success"
                  : count === 1
                  ? "bg-primary/10 text-primary"
                  : count >= 2
                  ? "bg-warning/10 text-warning"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              <User className="w-3 h-3" />
              {provider.name}
              <span className="bg-white/50 px-1.5 py-0.5 rounded-full">{count}</span>
            </div>
          ))}
        </div>
        {providerHolidayCounts.some(({ count }) => count === 0) && (
          <div className="flex items-center gap-2 mt-3 text-[10px] text-success">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Consider assigning holidays to providers with 0 assignments</span>
          </div>
        )}
      </div>

      {/* Holidays List */}
      <div className="space-y-3">
        {holidays.map((holiday) => {
          if (!holiday) return null;
          const status = getAssignmentStatus(holiday.name, holiday.date);
          const isExpanded = selectedHoliday === holiday.name;

          return (
            <motion.div
              key={holiday.name}
              layout
              className={`p-4 rounded-2xl border transition-all ${
                status.assigned
                  ? "bg-success/5 border-success/20"
                  : "bg-white/40 border-slate-200/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-xl ${
                    status.assigned ? "bg-success/10 text-success" : "bg-slate-100 text-slate-400"
                  }`}>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{holiday.name}</h4>
                    <p className="text-[10px] text-slate-500">
                      {holiday.displayDate} · {holiday.dayOfWeek}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {status.assigned ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-success">
                        {status.provider?.name}
                      </span>
                      <span className="text-[9px] text-slate-400 uppercase">
                        ({status.shiftType})
                      </span>
                      <button
                        onClick={() => removeHolidayAssignment(holiday.name, holiday.date)}
                        className="p-1.5 text-slate-400 hover:text-error hover:bg-error/10 rounded-lg transition-all"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedHoliday(isExpanded ? null : holiday.name)}
                      className="px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-primary-dark transition-all"
                    >
                      Assign
                    </button>
                  )}
                </div>
              </div>

              {/* Assignment Form */}
              {isExpanded && !status.assigned && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 pt-4 border-t border-slate-100"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                    Select Provider (sorted by fewest holidays)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {providerHolidayCounts.map(({ provider, count }) => (
                      <button
                        key={provider.id}
                        onClick={() => {
                          handleAssign(holiday.name, holiday.date, provider.id, "DAY");
                          setSelectedHoliday(null);
                        }}
                        disabled={provider.schedulingRestrictions?.noWeekends && holiday.dayOfWeek === "Saturday" || holiday.dayOfWeek === "Sunday"}
                        className={`flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                          count === 0
                            ? "bg-success/5 hover:bg-success/10 border border-success/20"
                            : "bg-slate-50 hover:bg-white border border-slate-200/60 hover:shadow-md"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-700">{provider.name}</p>
                          {provider.schedulingRestrictions?.noWeekends && (
                            <p className="text-[8px] text-warning">No weekends</p>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          count === 0
                            ? "bg-success text-white"
                            : "bg-slate-200 text-slate-600"
                        }`}>
                          {count} holidays
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-[10px] text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success/20" />
          <span>0 holidays (priority)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary/20" />
          <span>1 holiday</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-warning/20" />
          <span>2+ holidays</span>
        </div>
      </div>
    </motion.div>
  );
}
