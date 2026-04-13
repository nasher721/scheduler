import { useEffect, useState } from "react";
import { useScheduleStore } from "../store";
import { supabaseStatus } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Lock, Sparkles, User, UserPlus, Bug, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Register } from "./Register";
import { AdminRegister } from "./AdminRegister";
import { DEFAULT_ADMIN_CREDENTIALS, validateDefaultAdmin } from "../store";

export function Login() {
    const [view, setView] = useState<"login" | "register" | "admin_register" | "admin_login">(() => {
        if (typeof window === "undefined") return "login";
        const hash = window.location.hash;
        if (hash === "#register") return "register";
        // Note: #admin is handled by App.tsx for auto-login, not here
        return "login";
    });

    useEffect(() => {
        // Initial view handled by useState lazy initializer
    }, []);

    const updateView = (newView: "login" | "register" | "admin_register" | "admin_login") => {
        setView(newView);
        if (newView === "register") window.location.hash = "register";
        else if (newView === "admin_register") window.location.hash = "admin";
        else if (newView === "admin_login") window.location.hash = "admin-login";
        else window.location.hash = "";
    };

    const [email, setEmail] = useState("");
    const [showHint, setShowHint] = useState(false);
    const login = useScheduleStore((state) => state.login);

    const [adminEmail, setAdminEmail] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [adminLoginError, setAdminLoginError] = useState("");
    const showToast = useScheduleStore((state) => state.showToast);
    const providers = useScheduleStore((state) => state.providers);

    const handleAdminLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setAdminLoginError("");

        if (validateDefaultAdmin(adminEmail, adminPassword)) {
            const existingProvider = providers.find(
                p => p.email?.toLowerCase() === DEFAULT_ADMIN_CREDENTIALS.email.toLowerCase()
            );

            if (existingProvider) {
                if (existingProvider.role !== "ADMIN") {
                    useScheduleStore.getState().updateProvider(existingProvider.id, { role: "ADMIN" });
                }
                useScheduleStore.getState().login(DEFAULT_ADMIN_CREDENTIALS.email);
            } else {
                const adminProvider = {
                    id: crypto.randomUUID(),
                    name: DEFAULT_ADMIN_CREDENTIALS.name,
                    email: DEFAULT_ADMIN_CREDENTIALS.email,
                    role: "ADMIN" as const,
                    targetWeekDays: 0,
                    targetWeekendDays: 0,
                    targetWeekNights: 0,
                    targetWeekendNights: 0,
                    timeOffRequests: [],
                    preferredDates: [],
                    skills: ["ADMINISTRATIVE", "SCHEDULING"],
                    maxConsecutiveNights: 0,
                    minDaysOffAfterNight: 0,
                };
                useScheduleStore.getState().register(adminProvider);
            }

            showToast({
                type: "success",
                title: "Admin Access Granted",
                message: `Welcome, ${DEFAULT_ADMIN_CREDENTIALS.name}`
            });
            return;
        }

        setAdminLoginError("Invalid admin credentials");
    };

    // Check if we're in dev mode with bypass available
    const isDevMode = import.meta.env.DEV || window.location.hostname === 'localhost' || supabaseStatus.isPlaceholder;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const normalizedEmail = email.trim().toLowerCase();
        if (normalizedEmail) {
            login(normalizedEmail);
        }
    };

    const presetUsers = [
        { label: "Admin", email: "adams@hospital.org" },
        { label: "Scheduler", email: "clark@hospital.org" },
        { label: "Clinician", email: "baker@hospital.org" },
    ];

    return (
        <AnimatePresence mode="wait">
            {view === "login" ? (
                <motion.div
                    key="login"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="min-h-dvh flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 relative z-10"
                >
                    <div className="w-full max-w-md">
                        <div className="satin-panel p-6 sm:p-10 flex flex-col gap-6 sm:gap-8">
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
                                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Fast secure access
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="provider-email" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">
                                        Provider Email
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="provider-email"
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onBlur={() => setShowHint(true)}
                                            placeholder="e.g. adams@hospital.org"
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                        <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!email.trim()}
                                    className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] uppercase tracking-widest py-3.5 sm:py-4 rounded-xl transition-all shadow-md mt-2 flex items-center justify-center gap-2 active:scale-[0.99]"
                                >
                                    Sign In
                                    <ArrowRight className="h-4 w-4" />
                                </button>

                                {showHint && email.trim() && !email.includes("@") ? (
                                    <p className="text-xs text-amber-600 font-medium px-1">Use your hospital email address.</p>
                                ) : null}
                            </form>

                            <div className="flex flex-wrap items-center justify-center gap-2">
                                {presetUsers.map((user) => (
                                    <button
                                        key={user.email}
                                        type="button"
                                        onClick={() => setEmail(user.email)}
                                        className="rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                                    >
                                        {user.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col gap-4 mt-2">
                                <button
                                    type="button"
                                    onClick={() => updateView("register")}
                                    className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-widest py-4 rounded-xl transition-all hover:bg-slate-50 flex items-center justify-center gap-2"
                                    aria-label="Join the Provider Roster"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Join the Provider Roster
                                </button>

                                <button
                                    type="button"
                                    onClick={() => updateView("admin_login")}
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

                            {/* Dev Mode Indicator */}
                            {isDevMode && (
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                    <div className="flex items-center gap-2 text-amber-700">
                                        <Bug className="h-4 w-4" />
                                        <span className="text-xs font-medium">Dev Mode Active</span>
                                    </div>
                                    <p className="text-[10px] text-amber-600 mt-1">
                                        Local auth mode is enabled. Login works without remote email verification.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            ) : view === "admin_login" ? (
                <motion.div
                    key="admin_login"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="min-h-dvh flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 relative z-10"
                >
                    <div className="w-full max-w-md">
                        <div className="satin-panel p-6 sm:p-8 flex flex-col gap-6">
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center mb-2">
                                    <ShieldCheck className="w-8 h-8 text-white" />
                                </div>
                                <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-none">
                                    Admin <span className="text-primary italic font-serif">Portal</span>
                                </h1>
                                <p className="text-sm font-medium text-slate-500">
                                    Quick admin access for development and testing.
                                </p>
                                {isDevMode && (
                                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">
                                        <Bug className="h-3.5 w-3.5" />
                                        Dev Mode Only
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="admin-email" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">
                                        Admin Email
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="admin-email"
                                            type="email"
                                            required
                                            value={adminEmail}
                                            onChange={(e) => setAdminEmail(e.target.value)}
                                            placeholder="admin@neuroicu.com"
                                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                        <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label htmlFor="admin-password" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="admin-password"
                                            type={showAdminPassword ? "text" : "password"}
                                            required
                                            value={adminPassword}
                                            onChange={(e) => setAdminPassword(e.target.value)}
                                            placeholder="Enter admin password"
                                            className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        />
                                        <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                        <button
                                            type="button"
                                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {adminLoginError && (
                                    <p className="text-xs text-red-600 font-medium px-1">
                                        {adminLoginError}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={!adminEmail.trim() || !adminPassword.trim()}
                                    className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] uppercase tracking-widest py-3.5 sm:py-4 rounded-xl transition-all shadow-md mt-2 flex items-center justify-center gap-2 active:scale-[0.99]"
                                >
                                    Sign In as Admin
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </form>

                            <div className="flex flex-col gap-3 mt-2">
                                <button
                                    type="button"
                                    onClick={() => updateView("admin_register")}
                                    className="w-full bg-white border border-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-widest py-4 rounded-xl transition-all hover:bg-slate-50 flex items-center justify-center gap-2"
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    Request Admin Access
                                </button>

                                <button
                                    type="button"
                                    onClick={() => updateView("login")}
                                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                                >
                                    <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                                    Back to Provider Login
                                </button>
                            </div>

                            <div className="text-center pt-4 border-t border-slate-100">
                                <p className="text-[9px] font-medium text-slate-400">
                                    Default: {DEFAULT_ADMIN_CREDENTIALS.email}
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
                    <Register onBackToLogin={() => updateView("login")} />
                </motion.div>
            ) : (
                <motion.div
                    key="admin_register"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                >
                    <AdminRegister onBackToLogin={() => updateView("login")} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
