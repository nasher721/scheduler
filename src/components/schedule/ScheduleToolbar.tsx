import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { useScheduleStore, type CalendarPresentationMode, type ShiftTypeFilter } from "@/store";
import { useScheduleViewport } from "./useScheduleViewport";
import { cn } from "@/lib/utils";

const TYPES: { value: ShiftTypeFilter; label: string }[] = [
  { value: "all", label: "All shifts" }, { value: "DAY", label: "Day" },
  { value: "NIGHT", label: "Night" }, { value: "CONSULTS", label: "Consults" },
  { value: "JEOPARDY", label: "Jeopardy" }, { value: "NMET", label: "NMET" },
  { value: "RECOVERY", label: "Recovery" }, { value: "VACATION", label: "Vacation" },
];
const VIEWS = [{ value: "grid", label: "Week" }, { value: "month", label: "Month" }, { value: "list", label: "Agenda" }, { value: "excel", label: "Table" }] as const;

export function ScheduleToolbar() {
  const { scheduleViewport: viewport, weekDates, anchorDate, shiftWeekOffset, goToDate, setShiftTypeFilter, setShowConflictsOnly, setShowUnfilledOnly, setProviderSearchTerm, resetScheduleViewportFilters } = useScheduleViewport();
  const setSurface = useScheduleStore((state) => state.setScheduleSurfaceView);
  const setMode = useScheduleStore((state) => state.setCalendarPresentationMode);
  const active = viewport.surfaceView === "excel" ? "excel" : viewport.calendarPresentationMode;
  const isMonth = active === "month";
  const periodLabel = isMonth ? format(anchorDate, "MMMM yyyy") : format(weekDates[0], "yyyy-MM") === format(weekDates[6], "yyyy-MM") ? format(weekDates[0], "MMMM yyyy") : `${format(weekDates[0], "MMM")} – ${format(weekDates[6], "MMM yyyy")}`;
  const filtered = viewport.providerSearchTerm || viewport.shiftTypeFilter !== "all" || viewport.showUnfilledOnly || viewport.showConflictsOnly;
  const selectView = (value: CalendarPresentationMode | "excel") => {
    setSurface(value === "excel" ? "excel" : "calendar");
    if (value !== "excel") setMode(value);
  };
  const navigate = (delta: number) => isMonth ? goToDate(startOfMonth(addMonths(anchorDate, delta))) : shiftWeekOffset(delta);

  return (
    <section className="workspace-calendar-controls mb-4 space-y-4" aria-label="Schedule view controls">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-1"><h2 className="text-xl font-semibold tracking-tight tabular-nums">{periodLabel}</h2><p className="mt-0.5 text-[11px] text-foreground-muted">{isMonth ? "Monthly overview" : `${format(weekDates[0], "MMM d")} – ${format(weekDates[6], "MMM d")} · Weekly roster`}</p></div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => navigate(-1)} aria-label={isMonth ? "Previous month" : "Previous week"} className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => goToDate(new Date())} className="h-11 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-secondary">Today</button>
          <button type="button" onClick={() => navigate(1)} aria-label={isMonth ? "Next month" : "Next week"} className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="flex rounded-lg border border-border bg-secondary/60 p-1" role="group" aria-label="Calendar views">
            {VIEWS.map(({ value, label }) => <button key={value} type="button" onClick={() => selectView(value)} aria-pressed={active === value} className={cn("min-h-11 rounded-md px-3 text-[13px] font-medium transition-colors sm:px-4", active === value ? "bg-surface text-primary shadow-sm" : "text-foreground-secondary hover:bg-surface/60")}>{label}</button>)}
          </div>
          <select aria-label="More calendar views" value={["week", "bar", "timeline"].includes(active) ? active : ""} onChange={(event) => { if (event.target.value) selectView(event.target.value as CalendarPresentationMode); }} className="h-11 max-w-full rounded-md border border-border bg-surface px-3 text-sm font-medium"><option value="" disabled>More views</option><option value="week">Day cards</option><option value="bar">Workload bars</option><option value="timeline">Timeline</option></select>
          <input type="date" aria-label="Jump to date" value={format(anchorDate, "yyyy-MM-dd")} onChange={(event) => { if (event.target.value) goToDate(parseISO(event.target.value)); }} className="h-11 min-w-0 rounded-md border border-border bg-surface px-2 text-sm text-foreground-secondary" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3" aria-label="Schedule filters">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" aria-hidden="true" />
          <input type="search" value={viewport.providerSearchTerm} onChange={(event) => setProviderSearchTerm(event.target.value)} placeholder="Find a physician" aria-label="Filter providers by name" className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-3 text-sm placeholder:text-foreground-muted" />
        </div>
        <select aria-label="Shift type filter" value={viewport.shiftTypeFilter} onChange={(event) => setShiftTypeFilter(event.target.value as ShiftTypeFilter)} className="h-11 min-w-[140px] rounded-md border border-border bg-surface px-3 text-sm">{TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={viewport.showUnfilledOnly} onChange={(event) => setShowUnfilledOnly(event.target.checked)} className="h-4 w-4 accent-primary" />Open shifts</label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={viewport.showConflictsOnly} onChange={(event) => setShowConflictsOnly(event.target.checked)} className="h-4 w-4 accent-primary" />Conflicts</label>
        {filtered && <button type="button" onClick={resetScheduleViewportFilters} className="flex min-h-11 items-center gap-1 text-sm font-medium text-primary"><X className="h-4 w-4" />Clear filters</button>}
      </div>
    </section>
  );
}
