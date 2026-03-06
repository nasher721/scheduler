import { useState } from "react";
import { useScheduleStore } from "../store";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Sparkles, UserPlus, User, Mail, Shield, Target } from "lucide-react";

interface RegisterProps {
    onBackToLogin: () => void;
}

export function Register({ onBackToLogin }: RegisterProps) {
    const register = useScheduleStore((state) => state.register);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        role: "CLINICIAN" as "ADMIN" | "SCHEDULER" | "CLINICIAN",
        targetWeekDays: 10,
        targetWeekendDays: 4,
        targetWeekNights: 5,
        targetWeekendNights: 5,
        skills: ["NEURO_CRITICAL"] as string[],
        timeOffRequests: [],
        preferredDates: [],
        maxConsecutiveNights: 3,
        minDaysOffAfterNight: 1,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.name && formData.email) {
            register(formData);
        }
    };

    const setNumericField = (
        field: "targetWeekDays" | "targetWeekendDays" | "targetWeekNights",
        value: string,
    ) => {
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) return;
        setFormData({ ...formData, [field]: Math.max(0, parsed) });
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-xl"
            >
                <div className="satin-panel p-10 flex flex-col gap-10">
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                            <UserPlus className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl font-bold tracking-tight text-slate-900 leading-none">
                            Register <span className="font-serif italic text-primary">Provider</span>
                        </h1>
                        <p className="text-sm font-medium text-slate-500 max-w-xs">
                            Join the Neuro ICU staffing ecosystem. All profiles are securely audited.
                        </p>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">
                            <Sparkles className="h-3.5 w-3.5" />
                            Setup takes under a minute
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Basic Info */}
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                                        Full Name
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Dr. John Carter"
                                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                        <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                                        Clinical Email
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="jcarter@hospital.org"
                                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                        <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label htmlFor="role" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">
                                        Primary Role
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="role"
                                            value={formData.role}
                                            aria-label="Primary Role"
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value as "ADMIN" | "SCHEDULER" | "CLINICIAN" })}
                                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none transition-all"
                                        >
                                            <option value="CLINICIAN">Clinician</option>
                                            <option value="SCHEDULER">Chief Scheduler</option>
                                            <option value="ADMIN">Medical Director (Admin)</option>
                                        </select>
                                        <Shield className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>
                            </div>

                            {/* Targets */}
                            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5" /> Shift Targets (Monthly)
                                </span>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="targetWeekDays" className="text-[9px] font-bold text-slate-500 uppercase">FTE Weeks (Mon-Fri)</label>
                                        <input
                                            id="targetWeekDays"
                                            type="number"
                                            min={0}
                                            value={formData.targetWeekDays}
                                            onChange={(e) => setNumericField("targetWeekDays", e.target.value)}
                                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="targetWeekendDays" className="text-[9px] font-bold text-slate-500 uppercase">FTE Weekends (Sat-Sun)</label>
                                        <input
                                            id="targetWeekendDays"
                                            type="number"
                                            min={0}
                                            value={formData.targetWeekendDays}
                                            onChange={(e) => setNumericField("targetWeekendDays", e.target.value)}
                                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label htmlFor="targetWeekNights" className="text-[9px] font-bold text-slate-500 uppercase">FTE Nights</label>
                                        <input
                                            id="targetWeekNights"
                                            type="number"
                                            min={0}
                                            value={formData.targetWeekNights}
                                            onChange={(e) => { setNumericField("targetWeekNights", e.target.value); const parsed = Number.parseInt(e.target.value, 10); if (!Number.isNaN(parsed)) setFormData((prev) => ({ ...prev, targetWeekendNights: Math.max(0, parsed) })); }}
                                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold w-full"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Recovery</label>
                                        <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] text-slate-500">Nights auto-block recovery days and do not add FTE.</div>
                                    </div>
                                </div>

                                <ul className="space-y-2 pt-1">
                                    <li className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        Targets can be adjusted later in provider settings.
                                    </li>
                                    <li className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        Scheduler/Admin roles gain planning permissions.
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 mt-2">
                            <button
                                type="submit"
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] uppercase tracking-[0.2em] py-4 rounded-xl transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 active:scale-[0.98]"
                            >
                                Create Provider Profile
                            </button>

                            <button
                                type="button"
                                onClick={onBackToLogin}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors inline-flex items-center justify-center gap-2"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Already have an account? Sign In
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
