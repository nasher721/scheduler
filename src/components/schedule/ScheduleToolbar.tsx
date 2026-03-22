import { CalendarDays, ChevronLeft, ChevronRight, List, Rows3, Table2, TimerReset, BarChart3, CalendarIcon, Clock4 } from "lucide-react";
import { format } from "date-fns";
import { useScheduleStore, type CalendarPresentationMode, type ShiftTypeFilter } from "@/store";
import { useScheduleViewport } from "./useScheduleViewport";

const CALENDAR_MODES: { mode: CalendarPresentationMode; icon: React.ReactNode; label: string }[] = [
  { mode: "grid", icon: <Rows3 className="w-3.5 h-3.5" />, label: "Grid" },
  { mode: "list", icon: <List className="w-3.5 h-3.5" />, label: "List" },
  { mode: "bar", icon: <BarChart3 className="w-3.5 h-3.5" />, label: "Bar" },
  { mode: "week", icon: <CalendarDays className="w-3.5 h-3.5" />, label: "Week" },
  { mode: "month", icon: <CalendarIcon className="w-3.5 h-3.5" />, label: "Month" },
  { mode: "timeline", icon: <Clock4 className="w-3.5 h-3.5" />, label: "Timeline" },
];

export function ScheduleToolbar() {
  const {
    scheduleViewport,
    weekDates,
    shiftWeekOffset,
    setShiftTypeFilter,
    setShowConflictsOnly,
    setShowUnfilledOnly,
    setProviderSearchTerm,
    resetScheduleViewportFilters,
  } = useScheduleViewport();
  const { setScheduleSurfaceView, setCalendarPresentationMode } = useScheduleStore();

  return (
    <section className="satin-panel p-4 rounded-2xl border border-slate-200/50 mb-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Schedule Workspace</p>
          <p className="text-xs text-slate-500 mt-1">Use one control plane for both calendar and table editing.</p>
        </div>
        <p className="hidden lg:block text-[10px] text-slate-400">Shortcuts: Alt+1 Calendar, Alt+2 Table, Alt+Left/Right Week</p>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
            <button
              onClick={() => setScheduleSurfaceView("calendar")}
              className={`nav-chip px-3 py-1.5 rounded-lg ${
                scheduleViewport.surfaceView === "calendar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Calendar
            </button>
            <button
              onClick={() => setScheduleSurfaceView("excel")}
              className={`nav-chip px-3 py-1.5 rounded-lg ${
                scheduleViewport.surfaceView === "excel" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              Table
            </button>
          </div>

          <button onClick={() => shiftWeekOffset(-1)} className="soft-icon-btn" aria-label="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-3 py-1.5 bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200/60">
            {format(weekDates[0], "MMM d")} - {format(weekDates[6], "MMM d, yyyy")}
          </div>
          <button onClick={() => shiftWeekOffset(1)} className="soft-icon-btn" aria-label="Next week">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto touch-scroll rounded-xl bg-slate-100/80 p-1 scrollbar-hide [-webkit-overflow-scrolling:touch]">
            {CALENDAR_MODES.map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setCalendarPresentationMode(mode)}
                className={`nav-chip px-2.5 py-1.5 rounded-lg whitespace-nowrap ${
                  scheduleViewport.calendarPresentationMode === mode
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
                title={label}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <select
            aria-label="Shift type filter"
            value={scheduleViewport.shiftTypeFilter}
            onChange={(event) => setShiftTypeFilter(event.target.value as ShiftTypeFilter)}
            className="soft-control px-2.5 py-2 focus:ring-2 focus:ring-primary/20 min-h-[44px]"
          >
            <option value="all">All shifts</option>
            <option value="DAY">Day</option>
            <option value="NIGHT">Night</option>
            <option value="CONSULTS">Consults</option>
            <option value="JEOPARDY">Jeopardy</option>
            <option value="NMET">NMET</option>
            <option value="RECOVERY">Recovery</option>
            <option value="VACATION">Vacation</option>
          </select>

          <label className="soft-control flex items-center gap-1.5 px-2.5 py-2 cursor-pointer text-slate-600">
            <input
              type="checkbox"
              checked={scheduleViewport.showConflictsOnly}
              onChange={(event) => setShowConflictsOnly(event.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Conflicts
          </label>

          <label className="soft-control flex items-center gap-1.5 px-2.5 py-2 cursor-pointer text-slate-600">
            <input
              type="checkbox"
              checked={scheduleViewport.showUnfilledOnly}
              onChange={(event) => setShowUnfilledOnly(event.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary"
            />
            Unfilled
          </label>

          <input
            type="text"
            value={scheduleViewport.providerSearchTerm}
            onChange={(event) => setProviderSearchTerm(event.target.value)}
            placeholder="Search provider..."
            className="soft-control min-h-[44px] w-full min-w-0 max-w-full px-2.5 py-2 focus:ring-2 focus:ring-primary/20 sm:w-40 sm:min-w-[10rem]"
          />

          <button
            onClick={resetScheduleViewportFilters}
            className="px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 bg-white"
          >
            <span className="inline-flex items-center gap-1">
              <TimerReset className="w-3 h-3" />
              Reset
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
