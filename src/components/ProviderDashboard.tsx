import { useMemo } from "react";
import { useScheduleStore } from "../store";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, Clock, Download, LogOut } from "lucide-react";
import { format, parseISO } from "date-fns";

export function ProviderDashboard() {
    const { currentUser, slots, logout } = useScheduleStore();

    const myShifts = useMemo(() => {
        if (!currentUser) return [];
        return slots
            .filter((s) => s.providerId === currentUser.id)
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [slots, currentUser]);

    const nextShift = myShifts.find((s) => s.date >= format(new Date(), "yyyy-MM-dd"));

    if (!currentUser) return null;

    return (
        <div className="min-h-dvh w-full max-w-7xl mx-auto relative z-10 flex flex-col gap-8 md:gap-10 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 md:p-8 lg:p-10">
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-6 md:gap-8"
            >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200/60 pb-6 md:pb-8">
                    <div className="flex flex-col gap-2 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-[1px] bg-primary opacity-40 shrink-0" />
                            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary/80">
                                Clinician Portal
                            </span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl tracking-tighter text-slate-900 leading-[0.95] break-words">
                            Welcome, <span className="font-serif italic text-primary">{currentUser.name}</span>
                        </h1>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                            <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold tracking-wide uppercase border border-slate-200 w-fit">
                                {currentUser.role || "CLINICIAN"}
                            </span>
                            <span className="text-sm text-slate-500 font-medium break-all">
                                {currentUser.email}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0 w-full lg:w-auto">
                        <button
                            type="button"
                            className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                        >
                            <Download className="w-4 h-4 shrink-0" aria-hidden />
                            Sync .ics
                        </button>
                        <button
                            type="button"
                            onClick={logout}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-rose-600 border border-slate-200 hover:bg-rose-50 rounded-xl transition-all"
                            title="Log Out"
                            aria-label="Log out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </motion.header>

            <motion.main
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col lg:flex-row gap-10 items-start flex-1"
            >
                <div className="w-full lg:w-1/3 flex flex-col gap-6">
                    {/* Status Panel */}
                    <div className="stone-panel p-6 sm:p-8">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Next Up
                        </h3>
                        {nextShift ? (
                            <div className="flex flex-col gap-2">
                                <span className="text-4xl font-light tracking-tight text-slate-900">
                                    {format(parseISO(nextShift.date), "MMM d")}
                                </span>
                                <span className="text-primary font-medium">
                                    {format(parseISO(nextShift.date), "EEEE")}
                                </span>
                                <div className="mt-4 flex flex-col gap-1">
                                    <span className="text-sm font-semibold text-slate-700">{nextShift.type} Shift</span>
                                    <span className="text-xs text-slate-500">Location: {nextShift.location}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 italic">No upcoming shifts scheduled.</p>
                        )}
                    </div>

                    {/* Time Off Panel */}
                    <div className="satin-panel p-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4" /> Time Off Requests
                        </h3>
                        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                            Submit PTO or unavailability for upcoming schedule blocks.
                        </p>
                        <button
                            type="button"
                            className="w-full min-h-[44px] py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold shadow-md active:bg-slate-800 sm:hover:bg-slate-800 transition-colors"
                        >
                            Request Time Off
                        </button>
                    </div>
                </div>

                <div className="w-full lg:w-2/3 flex flex-col gap-6">
                    <div className="bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-5 sm:p-8 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-900 mb-6">Upcoming Schedule</h3>

                        {myShifts.length === 0 ? (
                            <div className="py-12 text-center flex flex-col items-center gap-3">
                                <CalendarIcon className="w-8 h-8 text-slate-300" />
                                <p className="text-slate-500 text-sm font-medium">You have no assigned shifts.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {myShifts.map((shift) => (
                                    <div
                                        key={shift.id}
                                        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 active:border-blue-200 active:bg-blue-50/30 sm:hover:border-blue-100 sm:hover:bg-blue-50/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                                            <div className="flex flex-col items-center justify-center w-12 h-12 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm">
                                                <span className="text-xs font-bold text-slate-500 uppercase">{format(parseISO(shift.date), "MMM")}</span>
                                                <span className="text-lg font-bold tracking-tighter text-slate-900 leading-none">{format(parseISO(shift.date), "d")}</span>
                                            </div>
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <span className="text-sm font-bold text-slate-900">{shift.type}</span>
                                                <span className="text-xs text-slate-500 break-words">{shift.location}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-3 pl-16 sm:pl-0">
                                            {shift.priority === "CRITICAL" && (
                                                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">Critical</span>
                                            )}
                                            <button
                                                type="button"
                                                className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 active:bg-white sm:hover:bg-white sm:hover:shadow-sm transition-all"
                                                title="Propose Swap"
                                            >
                                                Swap
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </motion.main>
        </div>
    );
}
