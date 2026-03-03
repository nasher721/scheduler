import { useState } from "react";
import { useScheduleStore } from "../store";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, User, UserPlus } from "lucide-react";
import { Register } from "./Register";
import { AdminRegister } from "./AdminRegister";

export function Login() {
    const [view, setView] = useState<"login" | "register" | "admin_register">("login");
    const [email, setEmail] = useState("");
    const login = useScheduleStore((state) => state.login);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim()) {
            login(email.trim());
        }
    };

    return (
        <AnimatePresence mode="wait">
            {view === "login" ? (
                <motion.div
                    key="login"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="min-h-screen flex items-center justify-center p-6 relative z-10"
                >
                    <div className="w-full max-w-md">
                        <div className="satin-panel p-10 flex flex-col gap-8">
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
                                    <Lock className="w-8 h-8 text-primary" />
                                </div>
                                <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-none">
                                    Neuro <span className="text-primary italic font-serif">ICU</span> Staffing
                                </h1>
                                <p className="text-sm font-medium text-slate-500">
                                    Clinical orchestrator for neurovascular critical care.
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
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] uppercase tracking-widest py-4 rounded-xl transition-all shadow-md mt-2 flex items-center justify-center gap-2 active:scale-95"
                                >
                                    Sign In
                                </button>
                            </form>

                            <div className="flex flex-col gap-4 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setView("register")}
                                    className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-widest py-4 rounded-xl transition-all hover:bg-slate-50 flex items-center justify-center gap-2"
                                    aria-label="Join the Provider Roster"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Join the Provider Roster
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setView("admin_register")}
                                    className="text-[10px] font-bold text-slate-300 hover:text-slate-500 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mt-4"
                                >
                                    <Lock className="w-3.5 h-3.5" />
                                    Administrative Portal
                                </button>
                            </div>

                            <div className="text-center pt-4 border-t border-slate-100 italic">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-300">
                                    Demo Access: adams@hospital.org (Admin)
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            ) : view === "register" ? (
                <motion.div
                    key="register"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                >
                    <Register onBackToLogin={() => setView("login")} />
                </motion.div>
            ) : (
                <motion.div
                    key="admin_register"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                >
                    <AdminRegister onBackToLogin={() => setView("login")} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
