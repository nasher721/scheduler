import { useState } from "react";
import { useScheduleStore } from "../store";
import { motion } from "framer-motion";
import { Lock, User } from "lucide-react";

export function Login() {
    const [email, setEmail] = useState("");
    const login = useScheduleStore((state) => state.login);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim()) {
            login(email.trim());
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="satin-panel p-10 flex flex-col gap-8">
                    <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                            <Lock className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                            Neuro ICU Staffing
                        </h1>
                        <p className="text-sm font-medium text-slate-500">
                            Enter your clinical email to access your schedule.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">
                                Provider Email
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="e.g. adams@hospital.org"
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                                <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!email.trim()}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm py-3 rounded-xl transition-colors disabled:opacity-50 mt-2 flex items-center justify-center gap-2 shadow-md"
                        >
                            Sign In
                        </button>
                    </form>

                    <div className="text-center">
                        <p className="text-xs text-slate-400">
                            Tested roles: adams@hospital.org (Admin), baker@hospital.org (Clinician)
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
