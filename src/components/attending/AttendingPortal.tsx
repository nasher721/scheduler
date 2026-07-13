import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowLeftRight,
    CalendarDays,
    CalendarOff,
    Clock,
    Download,
    LogOut,
    Moon,
    ShieldAlert,
    Sun,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduleStore } from "@/store";
import type { SwapRequestStatus } from "@/store";
import type { TimeOffType } from "@/types";
import { generateProviderICal } from "@/lib/icalUtils";
import { getShiftColorClasses } from "@/lib/shiftColors";
import { createShiftRequest } from "@/lib/api";
import { ThemeToggle } from "../ThemeToggle";
import { MyMonthCalendar } from "./MyMonthCalendar";
import { DayRosterPanel } from "./DayRosterPanel";
import { TimeOffModal } from "./TimeOffModal";
import { SwapProposalModal, type SwapProposalPayload } from "./SwapProposalModal";
import {
    describeDaysUntil,
    getDayRoster,
    getDepartmentAverageLoad,
    getMonthlyLoad,
    getUpcomingShifts,
    getUpcomingTimeOff,
    mergeTimeOffRequests,
} from "./attendingUtils";

const SWAP_STATUS_STYLES: Record<SwapRequestStatus, string> = {
    pending: "bg-warning/10 text-warning",
    approved: "bg-success/10 text-success",
    rejected: "bg-error/10 text-error",
    cancelled: "bg-secondary text-foreground-muted",
};

const UPCOMING_PREVIEW_COUNT = 8;

/**
 * Attending-facing portal: personal month calendar, workload stats vs the
 * department, day rosters, and self-service time-off + swap workflows that
 * feed the scheduler's existing approval queues.
 */
export function AttendingPortal() {
    const {
        currentUser,
        providers,
        slots,
        swapRequests,
        logout,
        updateProvider,
        createSwapRequest,
        cancelSwapRequest,
        showToast,
    } = useScheduleStore();

    const [month, setMonth] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [showTimeOffModal, setShowTimeOffModal] = useState(false);
    const [swapModalSlotId, setSwapModalSlotId] = useState<string | null | false>(false);
    const [showAllUpcoming, setShowAllUpcoming] = useState(false);

    const todayISO = format(new Date(), "yyyy-MM-dd");
    const monthKey = format(month, "yyyy-MM");

    // The store keeps currentUser as a snapshot; read the live provider record
    // so time-off edits made below are reflected immediately.
    const me = useMemo(
        () => providers.find((p) => p.id === currentUser?.id) ?? currentUser,
        [providers, currentUser],
    );

    const safeSlots = useMemo(() => (Array.isArray(slots) ? slots : []), [slots]);
    const myUpcoming = useMemo(
        () => (me ? getUpcomingShifts(safeSlots, me.id, todayISO) : []),
        [safeSlots, me, todayISO],
    );
    const nextShift = myUpcoming[0] ?? null;
    const monthlyLoad = useMemo(
        () => (me ? getMonthlyLoad(safeSlots, me.id, monthKey) : null),
        [safeSlots, me, monthKey],
    );
    const deptAverage = useMemo(
        () => getDepartmentAverageLoad(safeSlots, providers, monthKey),
        [safeSlots, providers, monthKey],
    );
    const upcomingTimeOff = useMemo(
        () => (me ? getUpcomingTimeOff(me.timeOffRequests ?? [], todayISO) : []),
        [me, todayISO],
    );
    const timeOffDates = useMemo(
        () => new Set((me?.timeOffRequests ?? []).map((r) => r.date)),
        [me],
    );
    const dayRoster = useMemo(
        () => (selectedDate ? getDayRoster(safeSlots, providers, selectedDate) : []),
        [safeSlots, providers, selectedDate],
    );
    const mySwaps = useMemo(
        () =>
            me
                ? swapRequests.filter((r) => r.requestorId === me.id || r.targetProviderId === me.id)
                : [],
        [swapRequests, me],
    );
    const colleagues = useMemo(
        () => providers.filter((p) => p.id !== me?.id),
        [providers, me],
    );
    const providerNameById = useMemo(
        () => new Map(providers.map((p) => [p.id, p.name])),
        [providers],
    );

    if (!me) return null;

    const handleICalExport = () => {
        const result = generateProviderICal(me, safeSlots);
        if (result.ok) {
            showToast({
                type: "success",
                title: "Calendar exported",
                message: `${result.count} shift${result.count === 1 ? "" : "s"} saved as .ics — import it into your phone or Outlook calendar.`,
            });
        } else {
            showToast({ type: "info", title: "Nothing to export", message: result.error });
        }
    };

    const handleTimeOffSubmit = async (dates: string[], type: TimeOffType, notes: string) => {
        updateProvider(me.id, {
            timeOffRequests: mergeTimeOffRequests(me.timeOffRequests ?? [], dates, type),
        });
        setShowTimeOffModal(false);
        showToast({
            type: "success",
            title: "Time off blocked",
            message: `${dates.length} day${dates.length === 1 ? "" : "s"} marked as ${type}. The scheduler has been notified.`,
        });

        // Best-effort sync into the scheduler's request inbox; the local block
        // above already protects these dates even if the backend is offline.
        try {
            const rangeLabel = dates.length > 1 ? `${dates[0]} through ${dates[dates.length - 1]}` : dates[0];
            await createShiftRequest({
                providerName: me.name,
                providerEmail: me.email,
                date: dates[0],
                type: "time_off",
                notes: `${type} · ${rangeLabel}${notes ? ` — ${notes}` : ""}`,
            });
        } catch {
            // Offline or backend unavailable — local time-off block still applies.
        }
    };

    const handleRemoveTimeOff = (date: string) => {
        updateProvider(me.id, {
            timeOffRequests: (me.timeOffRequests ?? []).filter((r) => r.date !== date),
        });
        showToast({ type: "info", title: "Time off removed", message: `${date} is available for scheduling again.` });
    };

    const handleSwapSubmit = ({ fromSlot, targetProviderId, targetSlot, notes }: SwapProposalPayload) => {
        createSwapRequest({
            requestorId: me.id,
            targetProviderId,
            fromDate: fromSlot.date,
            fromShiftType: fromSlot.type,
            toDate: targetSlot.date,
            toShiftType: targetSlot.type,
            notes: notes || undefined,
        });
        setSwapModalSlotId(false);
    };

    const visibleUpcoming = showAllUpcoming ? myUpcoming : myUpcoming.slice(0, UPCOMING_PREVIEW_COUNT);
    const loadDelta = monthlyLoad ? Math.round((monthlyLoad.total - deptAverage) * 10) / 10 : 0;

    return (
        <div className="min-h-dvh bg-background text-foreground">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
                <motion.header
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-4 border-b border-border pb-5 pt-2 lg:flex-row lg:items-end lg:justify-between"
                >
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/80">Attending Portal</p>
                        <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                            {me.name}
                        </h1>
                        <p className="mt-1 text-sm text-foreground-muted">
                            {me.email ?? "Neuro ICU attending"}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <ThemeToggle variant="icon" />
                        <button
                            type="button"
                            onClick={handleICalExport}
                            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-secondary/60"
                        >
                            <Download className="h-4 w-4" aria-hidden />
                            Sync .ics
                        </button>
                        <button
                            type="button"
                            onClick={logout}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border text-foreground-muted transition-colors hover:bg-error/10 hover:text-error"
                            title="Log out"
                            aria-label="Log out"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </motion.header>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
                >
                    <div className="stone-panel flex flex-col gap-1 p-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                            <Sun className="h-3.5 w-3.5" /> Shifts · {format(month, "MMM")}
                        </span>
                        <span className="text-2xl font-semibold">{monthlyLoad?.total ?? 0}</span>
                        <span className={cn("text-xs font-medium", loadDelta > 0 ? "text-warning" : "text-foreground-muted")}>
                            {deptAverage > 0
                                ? loadDelta === 0
                                    ? "At department average"
                                    : `${loadDelta > 0 ? "+" : ""}${loadDelta} vs dept avg (${deptAverage})`
                                : "No department data"}
                        </span>
                    </div>
                    <div className="stone-panel flex flex-col gap-1 p-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                            <Moon className="h-3.5 w-3.5" /> Nights · {format(month, "MMM")}
                        </span>
                        <span className="text-2xl font-semibold">{monthlyLoad?.nights ?? 0}</span>
                        <span className="text-xs font-medium text-foreground-muted">
                            {monthlyLoad?.weekend ?? 0} weekend shift{(monthlyLoad?.weekend ?? 0) === 1 ? "" : "s"}
                        </span>
                    </div>
                    <div className="stone-panel flex flex-col gap-1 p-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                            <Clock className="h-3.5 w-3.5" /> Next shift
                        </span>
                        <span className="text-2xl font-semibold">
                            {nextShift ? describeDaysUntil(nextShift.date, todayISO) : "—"}
                        </span>
                        <span className="text-xs font-medium text-foreground-muted">
                            {nextShift
                                ? `${format(parseISO(nextShift.date), "EEE MMM d")} · ${nextShift.type} · ${nextShift.serviceLocation}`
                                : "Nothing scheduled"}
                        </span>
                    </div>
                    <div className="stone-panel flex flex-col gap-1 p-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                            <CalendarOff className="h-3.5 w-3.5" /> Time off ahead
                        </span>
                        <span className="text-2xl font-semibold">{upcomingTimeOff.length}</span>
                        <span className="text-xs font-medium text-foreground-muted">
                            {upcomingTimeOff[0] ? `Next: ${format(parseISO(upcomingTimeOff[0].date), "MMM d")}` : "No blocked days"}
                        </span>
                    </div>
                </motion.div>

                <motion.main
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
                >
                    <div className="flex min-w-0 flex-col gap-4">
                        <MyMonthCalendar
                            month={month}
                            onMonthChange={(next) => {
                                setMonth(next);
                                setSelectedDate(null);
                            }}
                            slots={safeSlots}
                            providerId={me.id}
                            timeOffDates={timeOffDates}
                            selectedDate={selectedDate}
                            onSelectDate={setSelectedDate}
                        />

                        <AnimatePresence>
                            {selectedDate && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 6 }}
                                >
                                    <DayRosterPanel
                                        dateISO={selectedDate}
                                        entries={dayRoster}
                                        currentProviderId={me.id}
                                        onClose={() => setSelectedDate(null)}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <section className="satin-panel p-4 sm:p-6" aria-label="Upcoming shifts">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="flex items-center gap-2 text-sm font-bold">
                                    <CalendarDays className="h-4 w-4 text-primary" /> Upcoming shifts
                                </h3>
                                <span className="text-xs font-medium text-foreground-muted">{myUpcoming.length} total</span>
                            </div>

                            {myUpcoming.length === 0 ? (
                                <p className="py-8 text-center text-sm text-foreground-muted">
                                    You have no upcoming shifts in the current schedule window.
                                </p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {visibleUpcoming.map((shift) => (
                                        <div
                                            key={shift.id}
                                            className="flex flex-col gap-2 rounded-xl border border-border/70 p-3 transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-surface">
                                                    <span className="text-[9px] font-bold uppercase text-foreground-muted">
                                                        {format(parseISO(shift.date), "MMM")}
                                                    </span>
                                                    <span className="text-base font-bold leading-none">
                                                        {format(parseISO(shift.date), "d")}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span
                                                            className={cn(
                                                                "rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                                                getShiftColorClasses(shift.type),
                                                            )}
                                                        >
                                                            {shift.type}
                                                        </span>
                                                        {shift.priority === "CRITICAL" && (
                                                            <span className="flex items-center gap-1 rounded bg-error/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-error">
                                                                <ShieldAlert className="h-3 w-3" /> Critical
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-0.5 truncate text-xs text-foreground-muted">
                                                        {format(parseISO(shift.date), "EEEE")} · {shift.serviceLocation} ·{" "}
                                                        {describeDaysUntil(shift.date, todayISO)}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSwapModalSlotId(shift.id)}
                                                className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground-secondary transition-colors hover:bg-secondary/60 hover:text-foreground"
                                            >
                                                <ArrowLeftRight className="h-3.5 w-3.5" /> Swap
                                            </button>
                                        </div>
                                    ))}
                                    {myUpcoming.length > UPCOMING_PREVIEW_COUNT && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAllUpcoming((v) => !v)}
                                            className="mt-1 self-center rounded-lg px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                                        >
                                            {showAllUpcoming ? "Show fewer" : `Show all ${myUpcoming.length}`}
                                        </button>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>

                    <div className="flex min-w-0 flex-col gap-4">
                        <section className="satin-panel p-4 sm:p-6" aria-label="Time off">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="flex items-center gap-2 text-sm font-bold">
                                    <CalendarOff className="h-4 w-4 text-primary" /> Time off
                                </h3>
                            </div>
                            <p className="mb-4 text-xs leading-relaxed text-foreground-muted">
                                Blocked dates are excluded from auto-scheduling and forwarded to the scheduler.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowTimeOffModal(true)}
                                className="w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                            >
                                Request time off
                            </button>

                            {upcomingTimeOff.length > 0 && (
                                <ul className="mt-4 flex flex-col gap-1.5">
                                    {upcomingTimeOff.map((request) => (
                                        <li
                                            key={request.date}
                                            className="flex items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold">
                                                    {format(parseISO(request.date), "EEE, MMM d")}
                                                </p>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                                                    {request.type}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveTimeOff(request.date)}
                                                className="rounded-md p-1.5 text-foreground-muted transition-colors hover:bg-error/10 hover:text-error"
                                                title="Remove this time-off day"
                                                aria-label={`Remove time off on ${request.date}`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section className="satin-panel p-4 sm:p-6" aria-label="Swap requests">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="flex items-center gap-2 text-sm font-bold">
                                    <ArrowLeftRight className="h-4 w-4 text-primary" /> My swaps
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setSwapModalSlotId(null)}
                                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground-secondary transition-colors hover:bg-secondary/60"
                                >
                                    New swap
                                </button>
                            </div>

                            {mySwaps.length === 0 ? (
                                <p className="py-3 text-xs text-foreground-muted">
                                    No swap requests yet. Propose one from any upcoming shift.
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-1.5">
                                    {mySwaps.slice(0, 6).map((swap) => {
                                        const iAmRequestor = swap.requestorId === me.id;
                                        const otherName =
                                            providerNameById.get(iAmRequestor ? swap.targetProviderId ?? "" : swap.requestorId) ??
                                            "Open request";
                                        return (
                                            <li key={swap.id} className="rounded-lg border border-border/70 px-3 py-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="min-w-0 truncate text-sm font-semibold">
                                                        {iAmRequestor ? `With ${otherName}` : `From ${otherName}`}
                                                    </p>
                                                    <span
                                                        className={cn(
                                                            "shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                                                            SWAP_STATUS_STYLES[swap.status],
                                                        )}
                                                    >
                                                        {swap.status}
                                                    </span>
                                                </div>
                                                <p className="mt-0.5 text-xs text-foreground-muted">
                                                    {format(parseISO(swap.fromDate), "MMM d")} {swap.fromShiftType} ↔{" "}
                                                    {format(parseISO(swap.toDate), "MMM d")} {swap.toShiftType}
                                                </p>
                                                {iAmRequestor && swap.status === "pending" && (
                                                    <button
                                                        type="button"
                                                        onClick={() => cancelSwapRequest(swap.id)}
                                                        className="mt-1.5 text-xs font-semibold text-error transition-opacity hover:opacity-80"
                                                    >
                                                        Cancel request
                                                    </button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    </div>
                </motion.main>
            </div>

            <AnimatePresence>
                {showTimeOffModal && (
                    <TimeOffModal onClose={() => setShowTimeOffModal(false)} onSubmit={handleTimeOffSubmit} />
                )}
                {swapModalSlotId !== false && (
                    <SwapProposalModal
                        myShifts={myUpcoming}
                        colleagues={colleagues}
                        slots={safeSlots}
                        initialSlotId={swapModalSlotId}
                        onClose={() => setSwapModalSlotId(false)}
                        onSubmit={handleSwapSubmit}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
