import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BarChart3, CalendarDays, CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Clock4, List, Rows3, Search, SlidersHorizontal, Table2 } from "lucide-react";
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

const SHIFT_TYPE_OPTIONS: { value: ShiftTypeFilter; label: string }[] = [
  { value: "all", label: "All shifts" },
  { value: "DAY", label: "Day" },
  { value: "NIGHT", label: "Night" },
  { value: "CONSULTS", label: "Consults" },
  { value: "JEOPARDY", label: "Jeopardy" },
  { value: "NMET", label: "NMET" },
  { value: "RECOVERY", label: "Recovery" },
  { value: "VACATION", label: "Vacation" },
];

function countActiveFilters(viewport: {
  shiftTypeFilter: ShiftTypeFilter;
  showConflictsOnly: boolean;
  showUnfilledOnly: boolean;
  providerSearchTerm: string;
}): number {
  return (
    (viewport.shiftTypeFilter !== "all" ? 1 : 0) +
    (viewport.showConflictsOnly ? 1 : 0) +
    (viewport.showUnfilledOnly ? 1 : 0) +
    (viewport.providerSearchTerm !== "" ? 1 : 0)
  );
}

/**
 * Three controls: where you are in time, how the schedule is drawn, and what
 * is filtered out. Layout and filters open on demand rather than sitting in
 * the way — the grid is what people came here to look at.
 */
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

  const [openMenu, setOpenMenu] = useState<"layout" | "filter" | null>(null);
  const isCalendar = scheduleViewport.surfaceView === "calendar";
  const activeFilterCount = countActiveFilters(scheduleViewport);
  const activeMode = CALENDAR_MODES.find((m) => m.mode === scheduleViewport.calendarPresentationMode) ?? CALENDAR_MODES[0];

  return (
    <section className="mb-3 flex flex-wrap items-center gap-2" aria-label="Schedule view controls">
      <div className="flex items-center gap-1">
        <button
          onClick={() => shiftWeekOffset(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground-secondary transition-colors hover:bg-secondary/70"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => shiftWeekOffset(1)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-foreground-secondary transition-colors hover:bg-secondary/70"
          aria-label="Next week"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-[15px] font-semibold tracking-tight tabular-nums">
        {format(weekDates[0], "MMM d")} – {format(weekDates[6], "MMM d, yyyy")}
      </p>

      <div className="flex-1" />

      <div className="flex items-center gap-0.5 rounded-lg bg-secondary/70 p-0.5" role="group" aria-label="Schedule surface">
        <button
          onClick={() => setScheduleSurfaceView("calendar")}
          aria-pressed={isCalendar}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
            isCalendar ? "bg-surface font-semibold text-foreground shadow-xs" : "text-foreground-tertiary hover:text-foreground",
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Calendar
        </button>
        <button
          onClick={() => setScheduleSurfaceView("excel")}
          aria-pressed={!isCalendar}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
            !isCalendar ? "bg-surface font-semibold text-foreground shadow-xs" : "text-foreground-tertiary hover:text-foreground",
          )}
        >
          <Table2 className="h-3.5 w-3.5" />
          Table
        </button>
      </div>

      {isCalendar && (
        <div className="relative">
          <button
            onClick={() => setOpenMenu((m) => (m === "layout" ? null : "layout"))}
            aria-haspopup="menu"
            aria-expanded={openMenu === "layout"}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground-secondary transition-colors hover:bg-secondary/70"
          >
            {activeMode.icon}
            {activeMode.label}
            <ChevronDown className="h-3 w-3 text-foreground-muted" />
          </button>

          {openMenu === "layout" && (
            <>
              <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpenMenu(null)} aria-label="Close layout menu" />
              <div role="menu" className="absolute right-0 z-50 mt-1.5 w-40 rounded-xl border border-border bg-surface p-1.5 shadow-lg">
                {CALENDAR_MODES.map(({ mode, icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => { setCalendarPresentationMode(mode); setOpenMenu(null); }}
                    aria-checked={scheduleViewport.calendarPresentationMode === mode}
                    role="menuitemradio"
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                      scheduleViewport.calendarPresentationMode === mode
                        ? "bg-primary/10 font-semibold text-primary"
                        : "font-medium text-foreground hover:bg-secondary/70",
                    )}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setOpenMenu((m) => (m === "filter" ? null : "filter"))}
          aria-haspopup="menu"
          aria-expanded={openMenu === "filter"}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
            activeFilterCount > 0
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border text-foreground-secondary hover:bg-secondary/70",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
          {activeFilterCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>

        {openMenu === "filter" && (
          <>
            <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpenMenu(null)} aria-label="Close filter menu" />
            <div className="absolute right-0 z-50 mt-1.5 w-64 rounded-xl border border-border bg-surface p-3 shadow-lg">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" aria-hidden="true" />
                <input
                  type="text"
                  value={scheduleViewport.providerSearchTerm}
                  onChange={(event) => setProviderSearchTerm(event.target.value)}
                  placeholder="Filter by clinician…"
                  className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-foreground-muted outline-none focus:ring-2 focus:ring-ring/30"
                  aria-label="Filter providers by name"
                />
              </div>

              <select
                aria-label="Shift type filter"
                value={scheduleViewport.shiftTypeFilter}
                onChange={(event) => setShiftTypeFilter(event.target.value as ShiftTypeFilter)}
                className="mt-2 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-ring/30"
              >
                {SHIFT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={scheduleViewport.showConflictsOnly}
                  onChange={(event) => setShowConflictsOnly(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                />
                Conflicts only
              </label>

              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={scheduleViewport.showUnfilledOnly}
                  onChange={(event) => setShowUnfilledOnly(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                />
                Unfilled only
              </label>

              {activeFilterCount > 0 && (
                <button
                  onClick={() => { resetScheduleViewportFilters(); setOpenMenu(null); }}
                  className="mt-3 w-full rounded-lg border border-border py-1.5 text-xs font-medium text-foreground-secondary transition-colors hover:bg-secondary/70"
                >
                  Clear filters
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
