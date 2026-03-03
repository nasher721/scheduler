import { useState } from "react";
import { useScheduleStore } from "../store";
import { motion } from "framer-motion";
import { ShieldCheck, User, Mail, Landmark, Key, Eye, EyeOff } from "lucide-react";

interface AdminRegisterProps {
    onBackToLogin: () => void;
}

export function AdminRegister({ onBackToLogin }: AdminRegisterProps) {
    const register = useScheduleStore((state) => state.register);
    const [showKey, setShowKey] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        role: "ADMIN" as "ADMIN" | "SCHEDULER",
        accessKey: "",
        department: "NEURO_ICU",
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.name && formData.email) {
            // For demo, we just accept any admin registration, 
            // but we "verify" the role as ADMIN or SCHEDULER.
            register({
                name: formData.name,
                email: formData.email,
                role: formData.role,
                targetWeekDays: 0, // Admins typically don't have shift targets unless they also practice
                targetWeekendDays: 0,
                targetWeekNights: 0,
                targetWeekendNights: 0,
                skills: ["ADMINISTRATIVE", "SCHEDULING"],
                timeOffRequests: [],
                preferredDates: [],
                maxConsecutiveNights: 0,
                minDaysOffAfterNight: 0,
            });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-2xl"
            >
                <div className="satin-panel p-12 overflow-hidden relative">
                    {/* Background accent */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />

                    <div className="relative flex flex-col gap-10">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center shadow-2xl shadow-slate-900/20">
                                <ShieldCheck className="w-10 h-10 text-white" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <h1 className="text-4xl font-bold tracking-tight text-slate-900 uppercase">
                                    Administrative <span className="text-primary font-serif italic normal-case">Portal</span>
                                </h1>
                                <p className="text-sm font-medium text-slate-500 max-w-md mx-auto">
                                    Elevate your profile to Scheduling Administrator or Medical Director to manage site-wide clinical operations.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Identity */}
                                <div className="flex flex-col gap-5">
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">
                                        System Identity
                                    </h2>

                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="adminName" className="text-[10px] font-bold text-slate-500 ml-1">Official Name</label>
                                        <div className="relative">
                                            <input
                                                id="adminName"
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="e.g. Dr. Meredith Grey"
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                            <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="adminEmail" className="text-[10px] font-bold text-slate-500 ml-1">Clinical Email</label>
                                        <div className="relative">
                                            <input
                                                id="adminEmail"
                                                type="email"
                                                required
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="director@hospital.org"
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                            <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                        </div>
                                    </div>
                                </div>

                                {/* Authority */}
                                <div className="flex flex-col gap-5">
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b border-slate-100 pb-2">
                                        Administrative Authority
                                    </h2>

                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="adminRole" className="text-[10px] font-bold text-slate-500 ml-1">Designated Role</label>
                                        <div className="relative">
                                            <select
                                                id="adminRole"
                                                value={formData.role}
                                                onChange={(e) => setFormData({ ...formData, role: e.target.value as "ADMIN" | "SCHEDULER" })}
                                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none transition-all"
                                            >
                                                <option value="ADMIN">Medical Director (Full Admin)</option>
                                                <option value="SCHEDULER">Chief Scheduler (Read/Write)</option>
                                            </select>
                                            <Landmark className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label htmlFor="accessKey" className="text-[10px] font-bold text-slate-500 ml-1">Department Access Key</label>
                                        <div className="relative">
                                            <input
                                                id="accessKey"
                                                type={showKey ? "text" : "password"}
                                                required
                                                value={formData.accessKey}
                                                onChange={(e) => setFormData({ ...formData, accessKey: e.target.value })}
                                                placeholder="••••••••••••"
                                                className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                                            />
                                            <Key className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                            <button
                                                type="button"
                                                onClick={() => setShowKey(!showKey)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-col gap-5">
                                <button
                                    type="submit"
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] uppercase tracking-[0.3em] py-5 rounded-xl transition-all shadow-2xl shadow-slate-900/40 active:scale-[0.99] flex items-center justify-center gap-3"
                                >
                                    Authorize System Access
                                </button>

                                <div className="flex justify-between items-center px-2">
                                    <button
                                        type="button"
                                        onClick={onBackToLogin}
                                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                                    >
                                        Return to Secure Login
                                    </button>
                                    <span className="text-[9px] font-medium text-slate-300">
                                        Protected by NeuroVault™ Auth
                                    </span>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
