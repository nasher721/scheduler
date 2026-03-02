import { useScheduleStore, getProviderCounts } from "../store";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, ShieldAlert, History, Calendar as CalendarIcon, User, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";

export function AnalyticsDashboard() {
    const { slots, providers, auditLog, customRules } = useScheduleStore();

    const counts = useMemo(() => getProviderCounts(slots, providers), [slots, providers]);

    const coverageGaps = useMemo(() => {
        const gaps: Record<string, number> = {};
        slots.forEach(s => {
            if (!s.providerId && s.priority === "CRITICAL") {
                gaps[s.date] = (gaps[s.date] || 0) + 1;
            }
        });
        return Object.entries(gaps)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => b.count - a.count || b.date.localeCompare(a.date))
            .slice(0, 5);
    }, [slots]);

    return (
        <div className="w-full flex flex-col gap-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* Equity Overview */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel-heavy p-6 flex flex-col items-start gap-4"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Shift Equity Analysis</h2>
                    </div>
                    <div className="w-full overflow-x-auto rounded-xl border border-white/40 bg-white/20 backdrop-blur-sm">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                                    <th className="p-3">Provider</th>
                                    <th className="p-3">Total Shifts</th>
                                    <th className="p-3">Target</th>
                                    <th className="p-3">Variance</th>
                                    <th className="p-3">Weekends</th>
                                    <th className="p-3">Nights</th>
                                </tr>
                            </thead>
                            <tbody>
                                {providers.map((p) => {
                                    const c = counts[p.id];
                                    if (!c) return null;

                                    const cTotal = c.weekDays + c.weekendDays + c.weekNights + c.weekendNights;
                                    const totalTarget = p.targetWeekDays + p.targetWeekendDays + p.targetWeekNights + p.targetWeekendNights;
                                    const variance = cTotal - totalTarget;

                                    return (
                                        <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3 font-semibold text-slate-700">{p.name}</td>
                                            <td className="p-3">
                                                <span className="font-semibold">{cTotal}</span>
                                            </td>
                                            <td className="p-3 text-slate-500">{totalTarget}</td>
                                            <td className="p-3">
                                                <div className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full text-xs ${variance > 0 ? "bg-amber-100 text-amber-700" :
                                                    variance < 0 ? "bg-emerald-100 text-emerald-700" :
                                                        "bg-slate-100 text-slate-600"
                                                    }`}>
                                                    {variance > 0 ? <TrendingUp className="w-3 h-3" /> :
                                                        variance < 0 ? <TrendingDown className="w-3 h-3" /> :
                                                            <Minus className="w-3 h-3" />}
                                                    {Math.abs(variance)}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <span className="font-medium text-slate-600">{c.weekendDays + c.weekendNights}</span>
                                                <span className="text-slate-400 text-xs ml-1">/ {p.targetWeekendDays + p.targetWeekendNights}</span>
                                            </td>
                                            <td className="p-3">
                                                <span className="font-medium text-slate-600">{c.weekNights + c.weekendNights}</span>
                                                <span className="text-slate-400 text-xs ml-1">/ {p.targetWeekNights + p.targetWeekendNights}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* Fatigue & Burnout Risk */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="glass-panel-heavy p-6 flex flex-col items-start gap-4"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-xl font-bold bg-gradient-to-r from-rose-600 to-rose-400 bg-clip-text text-transparent">Burnout / Fatigue Risk</h2>
                    </div>

                    <div className="w-full flex flex-col gap-3">
                        {providers.map((p) => {
                            const c = counts[p.id];
                            if (!c) return null;

                            const cTotal = c.weekDays + c.weekendDays + c.weekNights + c.weekendNights;
                            const overageShifts = cTotal > (p.targetWeekDays + p.targetWeekendDays + p.targetWeekNights + p.targetWeekendNights) ?
                                cTotal - (p.targetWeekDays + p.targetWeekendDays + p.targetWeekNights + p.targetWeekendNights) : 0;
                            const overageNights = (c.weekNights + c.weekendNights) > (p.targetWeekNights + p.targetWeekendNights) ?
                                (c.weekNights + c.weekendNights) - (p.targetWeekNights + p.targetWeekendNights) : 0;

                            if (overageShifts === 0 && overageNights === 0) return null;

                            return (
                                <div key={p.id} className="flex items-start gap-3 p-4 rounded-xl border border-rose-100 bg-rose-50/50">
                                    <div className="mt-0.5 p-1.5 bg-rose-100 rounded-lg text-rose-500">
                                        <ShieldAlert className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-rose-900">{p.name}</p>
                                        <div className="text-sm text-rose-700/80 mt-1 flex flex-col gap-1">
                                            {overageShifts > 0 && <p className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> +{overageShifts} shifts over target capacity.</p>}
                                            {overageNights > 0 && <p className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> +{overageNights} excessive night shifts assigned.</p>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {providers.every((p) => {
                            const c = counts[p.id];
                            if (!c) return true;

                            const cTotal = c.weekDays + c.weekendDays + c.weekNights + c.weekendNights;
                            return cTotal <= (p.targetWeekDays + p.targetWeekendDays + p.targetWeekNights + p.targetWeekendNights) &&
                                (c.weekNights + c.weekendNights) <= (p.targetWeekNights + p.targetWeekendNights);
                        }) && (
                                <div className="w-full p-6 flex flex-col items-center justify-center text-center gap-2 border-2 border-dashed border-emerald-100 rounded-xl bg-emerald-50/30">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500">
                                        <ShieldAlert className="w-5 h-5" />
                                    </div>
                                    <p className="font-medium text-emerald-800">All Clear</p>
                                    <p className="text-sm text-emerald-600">No providers are currently exceeding their target shift limits.</p>
                                </div>
                            )}
                    </div>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Audit Log */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="glass-panel-heavy p-6 flex flex-col gap-4"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-slate-500" />
                            <h2 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Recent Activity</h2>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {auditLog.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 italic">No recent activity detected.</div>
                        ) : (
                            auditLog.map((entry) => (
                                <div key={entry.id} className="p-3 rounded-lg border border-slate-100 bg-white/50 flex flex-col gap-1 transition-all hover:border-slate-300">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${entry.action === "ASSIGN" ? "bg-blue-100 text-blue-700" :
                                            entry.action === "UNASSIGN" ? "bg-slate-100 text-slate-700" :
                                                entry.action === "AUTO_ASSIGN" ? "bg-purple-100 text-purple-700" :
                                                    "bg-amber-100 text-amber-700"
                                            }`}>
                                            {entry.action}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            {format(parseISO(entry.timestamp), "MMM dd, HH:mm")}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700 font-medium">{entry.details}</p>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {entry.user}</span>
                                        {entry.slotId && <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> Slot: {entry.slotId.split('-').slice(0, 2).join(' ')}</span>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Coverage & Conflict Intelligence */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="glass-panel-heavy p-6 flex flex-col gap-4"
                >
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <h2 className="text-xl font-bold bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">Coverage Intelligence</h2>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/30">
                            <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3">Critical Coverage Gaps</h3>
                            {coverageGaps.length === 0 ? (
                                <div className="flex items-center gap-2 text-emerald-600">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="text-sm font-medium">All critical slots are fully covered.</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {coverageGaps.map((gap) => (
                                        <div key={gap.date} className="flex items-center justify-between p-2 rounded-lg bg-white border border-amber-100">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                <span className="text-sm font-semibold text-slate-700">{format(parseISO(gap.date), "EEE, MMM dd")}</span>
                                            </div>
                                            <span className="text-xs font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg">
                                                {gap.count} Critical Slot{gap.count > 1 ? 's' : ''} Open
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Rules</p>
                                <p className="text-2xl font-bold text-slate-700 mt-1">{customRules.length}</p>
                            </div>
                            <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Assignments</p>
                                <p className="text-2xl font-bold text-slate-700 mt-1">{slots.filter(s => s.providerId).length}</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
