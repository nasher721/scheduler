import { useShallow } from 'zustand/react/shallow';
import { CalendarDays, ChevronLeft, ChevronRight, List, Rows3, Table2, TimerReset, BarChart3, CalendarIcon, Clock4, Search, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { useScheduleStore, type CalendarPresentationMode, type ShiftTypeFilter } from "@/store";
import { useScheduleViewport } from "./useScheduleViewport";
import { cn } from "@/lib/utils";

const CALENDAR_MODES: { mode: CalendarPresentationMode; icon: React.ReactNode; label: string }[] = [
  { mode: "grid", icon: <Rows3 className="w-3.5 h-3.5" />, label: "Grid" },
  { mode: "list", icon: <List className="w-3.5 h-3.5" />, label: "List" },
  { mode: "bar", icon: <BarChart3 className="w-3.5 h-3.5" />, label: "Bar" },
  { mode: "week", icon: <CalendarDays className="w-3.5 h-3.5" />, label: "Week" },
  { mode: "month", icon: <CalendarIcon className="w-3.5 h-3.5" />, label: "Month" },
  { mode: "timeline", icon: <Clock4 className="w-3.5 h-3.5" />, label: "Timeline" },
];

function hasActiveFilters(viewport: {
  shiftTypeFilter: ShiftTypeFilter;
  showConflictsOnly: boolean;
  showUnfilledOnly: boolean;
  providerSearchTerm: string;
}): boolean {
  return (
    viewport.shiftTypeFilter !== "all" ||
    viewport.showConflictsOnly ||
    viewport.showUnfilledOnly ||
    viewport.providerSearchTerm !== ""
  );
}

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
  const { setScheduleSurfaceView, setCalendarPresentationMode } = useScheduleStore(useShallow((s) => ({ setScheduleSurfaceView: s.setScheduleSurfaceView, setCalendarPresentationMode: s.setCalendarPresentationMode })));

  const activeFilters = hasActiveFilters({
    shiftTypeFilter: scheduleViewport.shiftTypeFilter,
    showConflictsOnly: scheduleViewport.showConflictsOnly,
    showUnfilledOnly: scheduleViewport.showUnfilledOnly,
    providerSearchTerm: scheduleViewport.providerSearchTerm,
  });

  return (
    <section className="satin-panel mb-3 rounded-xl border border-border/80 p-2.5 shadow-xs" aria-label="Schedule View Controls">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-lg border border-border/60">
            <button
              onClick={() => setScheduleSurfaceView("calendar")}
              className={cn(
                "nav-chip px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                scheduleViewport.surfaceView === "calendar"
                  ? "bg-surface text-foreground shadow-xs border border-border/60"
                  : "text-foreground-muted hover:text-foreground"
              )}
              aria-pressed={scheduleViewport.surfaceView === "calendar"}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Calendar
            </button>
            <button
              onClick={() => setScheduleSurfaceView("excel")}
              className={cn(
                "nav-chip px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                scheduleViewport.surfaceView === "excel"
                  ? "bg-surface text-foreground shadow-xs border border-border/60"
                  : "text-foreground-muted hover:text-foreground"
              )}
              aria-pressed={scheduleViewport.surfaceView === "excel"}
            >
              <Table2 className="w-3.5 h-3.5" />
              Table
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => shiftWeekOffset(-1)} className="command-icon h-8 w-8" aria-label="Previous week">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1.5 bg-surface rounded-lg text-xs font-semibold text-foreground border border-border/70 shadow-xs tabular-nums">
              {format(weekDates[0], "MMM d")} – {format(weekDates[6], "MMM d, yyyy")}
            </div>
            <button onClick={() => shiftWeekOffset(1)} className="command-icon h-8 w-8" aria-label="Next week">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto">
          {scheduleViewport.surfaceView === "calendar" && (
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-secondary/60 p-1 border border-border/60 scrollbar-hide" role="group" aria-label="Calendar presentation modes">
              {CALENDAR_MODES.map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setCalendarPresentationMode(mode)}
                  className={cn(
                    "nav-chip px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all",
                    scheduleViewport.calendarPresentationMode === mode
                      ? "bg-surface text-foreground shadow-xs border border-border/60 font-semibold"
                      : "text-foreground-muted hover:text-foreground"
                  )}
                  title={label}
                  aria-pressed={scheduleViewport.calendarPresentationMode === mode}
                  role="radio"
                  aria-checked={scheduleViewport.calendarPresentationMode === mode}
                >
                  {icon}
                  <span className="hidden sm:inline ml-1">{label}</span>
                </button>
              ))}
            </div>
          )}

          <select
            aria-label="Shift type filter"
            value={scheduleViewport.shiftTypeFilter}
            onChange={(event) => setShiftTypeFilter(event.target.value as ShiftTypeFilter)}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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

          <label className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer hover:bg-secondary/40 transition-colors">
            <input
              type="checkbox"
              checked={scheduleViewport.showConflictsOnly}
              onChange={(event) => setShowConflictsOnly(event.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
              aria-label="Show conflicts only"
            />
            Conflicts
          </label>

          <label className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground cursor-pointer hover:bg-secondary/40 transition-colors">
            <input
              type="checkbox"
              checked={scheduleViewport.showUnfilledOnly}
              onChange={(event) => setShowUnfilledOnly(event.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
              aria-label="Show unfilled shifts only"
            />
            Unfilled
          </label>

          <div className="relative flex-1 sm:w-44 sm:flex-initial">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" aria-hidden="true" />
            <input
              type="text"
              value={scheduleViewport.providerSearchTerm}
              onChange={(event) => setProviderSearchTerm(event.target.value)}
              placeholder="Filter provider..."
              className="w-full rounded-lg border border-border bg-surface pl-8 pr-2.5 py-1.5 text-xs font-medium text-foreground placeholder:text-foreground-muted focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              aria-label="Filter providers by name"
            />
          </div>

          <button
            onClick={resetScheduleViewportFilters}
            className="command-button text-xs py-1.5 px-2 text-foreground-muted hover:text-foreground"
            title="Reset filters"
          >
            <TimerReset className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {activeFilters && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-xs font-medium text-primary">
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Active filters</span>
              <button
                onClick={resetScheduleViewportFilters}
                className="p-0.5 hover:bg-primary/10 rounded transition-colors"
                aria-label="Clear all filters"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
