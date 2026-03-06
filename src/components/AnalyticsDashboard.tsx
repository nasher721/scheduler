import { useScheduleStore, getProviderCounts, getProviderCredentialSummary } from "../store";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, ShieldAlert, History, Calendar as CalendarIcon, User, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ExportCenter } from "./ExportCenter";

export function AnalyticsDashboard() {
    const { slots, providers, auditLog, customRules } = useScheduleStore();

    const counts = useMemo(() => getProviderCounts(slots, providers), [slots, providers]);


    const credentialRisk = useMemo(() => {
        return providers.reduce((acc, provider) => {
            const summary = getProviderCredentialSummary(provider);
            if (summary.hasExpiredCredentials) acc.expired += 1;
            if (summary.hasExpiringSoonCredentials) acc.expiringSoon += 1;
            return acc;
        }, { expired: 0, expiringSoon: 0 });
    }, [providers]);

    const coverageGaps = useMemo(() => {
        return slots
            .filter(s => !s.providerId && s.priority === "CRITICAL")
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 5);
    }, [slots]);

    return (
        <div className="w-full flex flex-col gap-6">
            {/* Print-only Institutional Header */}
            <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-6">
                <h1 className="text-4xl font-serif text-slate-900 tracking-tight">Institutional Neurology Schedule</h1>
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-500 mt-2">Clinical Operations & Equity Report</p>
                <div className="flex justify-between mt-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>Generated: {format(new Date(), "MMMM dd, yyyy HH:mm")}</span>
                    <span>System: NICU Precision Scheduler v2.0</span>
                </div>
            </div>

            <div className="no-print">
                <ExportCenter />
            </div>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="satin-panel p-5 border-slate-200/40 flex items-center justify-between gap-4"
            >
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Credential Risk Watch</h3>
                    <p className="text-xs text-slate-500 mt-1">Providers needing credential follow-up.</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-error-muted text-error">Expired: {credentialRisk.expired}</span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning">Expiring ≤30d: {credentialRisk.expiringSoon}</span>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

                {/* Equity Overview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="satin-panel p-8 flex flex-col items-start gap-6 border-slate-200/40"
                >
                    <div className="flex items-center justify-between w-full border-b border-slate-100 pb-5">
                        <div>
                            <h2 className="text-2xl font-serif text-slate-900 tracking-tight">Equity Metrics</h2>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">Provider Distribution Analysis</p>
                        </div>
                        <div className="px-3 py-1 bg-slate-50 border border-slate-200/60 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            Real-time Sync
                        </div>
                    </div>
                    <div className="w-full overflow-hidden rounded-2xl border border-slate-200/40 bg-white/40 shadow-inner">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-200/60 text-slate-400 font-bold uppercase tracking-widest">
                                    <th className="px-5 py-4">Provider Entity</th>
                                    <th className="px-5 py-4 text-center">Load</th>
                                    <th className="px-5 py-4 text-center">Target</th>
                                    <th className="px-5 py-4 text-center">Variance</th>
                                    <th className="px-5 py-4 text-right">Off-Hours</th>
                                </tr>
                            </thead>
                            <tbody>
                                {providers.map((p) => {
                                    const c = counts[p.id];
                                    if (!c) return null;

                                    const cTotal = c.weekDays + c.weekendDays + c.weekNights + c.weekendNights;
                                    const totalTarget = p.targetWeekDays + p.targetWeekendDays + p.targetWeekNights;
                                    const variance = cTotal - totalTarget;

                                    return (
                                        <tr key={p.id} className="border-b border-slate-100/60 last:border-0 hover:bg-white/60 transition-colors group">
                                            <td className="px-5 py-4 font-bold text-slate-700">{p.name}</td>
                                            <td className="px-5 py-4 text-center font-bold text-slate-600">
                                                {cTotal}
                                            </td>
                                            <td className="px-5 py-4 text-center text-slate-400 font-medium">{totalTarget}</td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-center">
                                                    <div className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider ${variance > 0 ? "bg-warning-muted/50 text-warning border border-warning/10" :
                                                        variance < 0 ? "bg-success-muted/50 text-success border border-success/10" :
                                                            "bg-slate-100 text-slate-400 border border-slate-200/50"
                                                        }`}>
                                                        {variance > 0 ? <TrendingUp className="w-2.5 h-2.5" /> :
                                                            variance < 0 ? <TrendingDown className="w-2.5 h-2.5" /> :
                                                                <Minus className="w-2.5 h-2.5" />}
                                                        {Math.abs(variance)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold text-slate-600">W:{c.weekendDays + c.weekendNights}</span>
                                                    <span className="text-[9px] text-slate-400 font-medium tracking-tight">N:{c.weekNights + c.weekendNights}</span>
                                                </div>
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="satin-panel p-8 flex flex-col items-start gap-6 border-slate-200/40 overflow-hidden"
                >
                    <div className="flex items-center justify-between w-full border-b border-slate-100 pb-5">
                        <div className="relative">
                            <h2 className="text-2xl font-serif text-slate-900 tracking-tight">Fatigue Indicators</h2>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-error mt-1">Safety Risk Monitoring</p>
                        </div>
                        <div className="p-2.5 bg-error/5 border border-error/10 rounded-xl text-error">
                            <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
                        </div>
                    </div>

                    <div className="w-full flex flex-col gap-3">
                        {providers.map((p) => {
                            const c = counts[p.id];
                            if (!c) return null;

                            const cTotal = c.weekDays + c.weekendDays + c.weekNights + c.weekendNights;
                            const overageShifts = cTotal > (p.targetWeekDays + p.targetWeekendDays + p.targetWeekNights) ?
                                cTotal - (p.targetWeekDays + p.targetWeekendDays + p.targetWeekNights) : 0;
                            const overageNights = (c.weekNights + c.weekendNights) > p.targetWeekNights ?
                                (c.weekNights + c.weekendNights) - p.targetWeekNights : 0;

                            if (overageShifts === 0 && overageNights === 0) return null;

                            return (
                                <div key={p.id} className="relative group p-5 rounded-2xl border border-error/10 bg-error-muted/30 overflow-hidden transition-all hover:bg-error-muted/50">
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white/80 shadow-xs flex items-center justify-center text-error">
                                                <TrendingUp className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 leading-none">{p.name}</p>
                                                <p className="text-[10px] font-bold text-error uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                                    Critical Threshold Warning
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-col gap-2 relative z-10">
                                        {overageShifts > 0 && (
                                            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/50 border border-white/80 text-[11px] font-medium text-slate-600 shadow-xs">
                                                <span className="w-1.5 h-1.5 rounded-full bg-error" />
                                                <span>Significant Load: <strong>+{overageShifts} shifts</strong> over contract target.</span>
                                            </div>
                                        )}
                                        {overageNights > 0 && (
                                            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/50 border border-white/80 text-[11px] font-medium text-slate-600 shadow-xs">
                                                <span className="w-1.5 h-1.5 rounded-full bg-error" />
                                                <span>Circadian Strain: <strong>+{overageNights} excessive nights</strong>.</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Abstract background flare */}
                                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-error/10 rounded-full blur-3xl" />
                                </div>
                            );
                        })}

                        {providers.every((p) => {
                            const c = counts[p.id];
                            if (!c) return true;

                            const cTotal = c.weekDays + c.weekendDays + c.weekNights + c.weekendNights;
                            return cTotal <= (p.targetWeekDays + p.targetWeekendDays + p.targetWeekNights) &&
                                (c.weekNights + c.weekendNights) <= p.targetWeekNights;
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="satin-panel p-8 flex flex-col items-start gap-6 border-slate-200/40"
                >
                    <div className="flex items-center justify-between w-full border-b border-slate-100 pb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 border border-slate-200/60 rounded-xl text-slate-400">
                                <History className="w-5 h-5 stroke-[2.5]" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-serif text-slate-900 tracking-tight">System Ledger</h2>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">Audit Log & State Changes</p>
                            </div>
                        </div>
                    </div>
                    <div className="w-full flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {auditLog.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 italic font-serif text-lg">No recent activity detected.</div>
                        ) : (
                            auditLog.map((entry) => (
                                <div key={entry.id} className="group p-4 rounded-xl border border-slate-100/60 bg-white/40 hover:bg-white/80 transition-all hover:border-slate-300/50 hover:shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest ${entry.action === "ASSIGN" ? "bg-primary/5 text-primary border border-primary/10" :
                                            entry.action === "UNASSIGN" ? "bg-slate-100 text-slate-500 border border-slate-200/50" :
                                                entry.action === "AUTO_ASSIGN" ? "bg-indigo-50 text-indigo-500 border border-indigo-100" :
                                                    "bg-warning/5 text-warning border border-warning/10"
                                            }`}>
                                            {entry.action}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                            {format(parseISO(entry.timestamp), "HH:mm · MMM dd")}
                                        </span>
                                    </div>
                                    <p className="text-[13px] text-slate-700 font-medium leading-relaxed">{entry.details}</p>
                                    <div className="flex items-center gap-4 text-[10px] text-slate-400 mt-3 border-t border-slate-50 pt-2 font-bold uppercase tracking-wider">
                                        <span className="flex items-center gap-1.5"><User className="w-3 h-3" /> {entry.user}</span>
                                        {entry.slotId && <span className="flex items-center gap-1.5"><CalendarIcon className="w-3 h-3" /> {entry.slotId.split('-').slice(0, 2).join(' ')}</span>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* Coverage & Conflict Intelligence */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="satin-panel p-8 flex flex-col items-start gap-6 border-slate-200/40"
                >
                    <div className="flex items-center justify-between w-full border-b border-slate-100 pb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-50 border border-amber-200/60 rounded-xl text-amber-500">
                                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-serif text-slate-900 tracking-tight">Coverage Intel</h2>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-warning mt-1">Gap & Conflict Detection</p>
                            </div>
                        </div>
                    </div>

                    <div className="w-full flex flex-col gap-6">
                        <div className="p-6 rounded-2xl border border-warning/10 bg-warning-muted/30">
                            <h3 className="text-[10px] font-bold text-warning uppercase tracking-[0.2em] mb-4">Critical Deployment Gaps</h3>
                            {coverageGaps.length === 0 ? (
                                <div className="flex items-center gap-3 text-success font-bold text-[11px] uppercase tracking-widest">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>All critical postions are deployed.</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {coverageGaps.map((gap, idx) => (
                                        <div key={idx} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/60 border border-white shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                                                <span className="text-[11px] font-bold text-slate-700">{gap.requiredSkill} · {gap.location}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                {format(parseISO(gap.date), "EEE dd MMM")} · {gap.type}
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
