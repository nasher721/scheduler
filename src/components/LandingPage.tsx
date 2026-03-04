import { Shield, ArrowRight, BrainCircuit, Users, Calendar, Zap, LayoutGrid } from 'lucide-react';
import { motion } from 'framer-motion';

interface LandingPageProps {
    onLogin: () => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-700 font-sans">
            {/* Inline styles for complex SVG keyframe animations */}
            <style>{`
        @keyframes camera-pan {
          0%, 15% { transform: scale(2.2) translate(-3%, -18%); }
          30%, 75% { transform: scale(0.95) translate(0%, 5%); }
          90%, 100% { transform: scale(2.2) translate(-3%, -18%); }
        }
        @keyframes helicopter-flight {
          0%, 25% { transform: translate(1400px, -50px) rotate(-15deg); }
          35% { transform: translate(550px, 150px) rotate(0deg); }
          42%, 70% { transform: translate(550px, 275px) rotate(0deg); }
          78% { transform: translate(550px, 150px) rotate(15deg); }
          90%, 100% { transform: translate(-300px, 0px) rotate(15deg); }
        }

        @keyframes rotor-spin {
          0% { transform: scaleX(1); opacity: 1; }
          25% { opacity: 0.5; }
          50% { transform: scaleX(0.05); opacity: 0.8; }
          75% { opacity: 0.5; }
          100% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes arm-intubate {
          0%, 100% { transform: rotate(0deg); }
          5%, 10% { transform: rotate(-15deg); }
        }

        @keyframes arm-evd {
          0%, 100% { transform: rotate(0deg); }
          5%, 10% { transform: rotate(15deg); }
        }

        @keyframes monitor-pulse-green {
          0% { stroke-dashoffset: 60; }
          100% { stroke-dashoffset: 0; }
        }

        @keyframes monitor-pulse-blue {
          0% { stroke-dashoffset: 50; }
          100% { stroke-dashoffset: 0; }
        }

        @keyframes evd-drip {
          0%, 100% { transform: translateY(0); opacity: 0; }
          50% { opacity: 1; }
          90% { transform: translateY(15px); opacity: 0; }
        }

        @keyframes heli-shadow {
          0%, 30% { transform: scale(0.2); opacity: 0; }
          42%, 70% { transform: scale(1); opacity: 0.6; }
          82%, 100% { transform: scale(0.2); opacity: 0; }
        }

        .animate-camera {
          animation: camera-pan 16s ease-in-out infinite;
          transform-origin: center center;
        }

        .animate-helicopter {
          animation: helicopter-flight 16s ease-in-out infinite;
        }

        .animate-rotor {
          animation: rotor-spin 0.1s linear infinite;
        }

        .animate-arm-int {
          animation: arm-intubate 16s ease-in-out infinite;
        }

        .animate-arm-evd {
          animation: arm-evd 16s ease-in-out infinite;
        }

        .animate-wave-green {
          stroke-dasharray: 60;
          animation: monitor-pulse-green 1.5s linear infinite;
        }

        .animate-wave-blue {
          stroke-dasharray: 50;
          animation: monitor-pulse-blue 2s linear infinite;
        }

        .animate-drip {
          animation: evd-drip 2s linear infinite;
        }

        .animate-room-hud {
          animation: room-hud-fade 16s ease-in-out infinite;
        }

        .animate-heli-hud {
          animation: heli-hud-fade 16s ease-in-out infinite;
        }

        .animate-heli-shadow {
          animation: heli-shadow 16s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>

            {/* Navigation - Clean, clinical style matching the app */}
            <nav className="absolute top-0 w-full p-6 z-50 flex justify-between items-center border-b border-slate-200/60 bg-white/80 backdrop-blur-sm">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-[1px] bg-primary opacity-40" />
                        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-500">Department of Neurology</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <BrainCircuit className="w-6 h-6 text-primary" />
                        <span className="text-xl font-bold tracking-tight text-slate-900">
                            Neuro <span className="font-serif italic text-primary">ICU</span> <span className="text-slate-400 font-extralight">Scheduling</span>
                        </span>
                    </div>
                </div>
                <button
                    onClick={onLogin}
                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm"
                >
                    Staff Login
                </button>
            </nav>

            {/* Hero Section */}
            <main className="relative pt-40 pb-20 lg:pt-52 lg:pb-32 overflow-hidden flex flex-col lg:flex-row items-center justify-between px-6 lg:px-12 max-w-7xl mx-auto gap-12">

                {/* Left Content */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full lg:w-5/12 z-10 space-y-8"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Internal Scheduling System
                    </div>

                    <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight text-slate-900">
                        High-fidelity orchestration for{" "}
                        <span className="font-serif italic text-primary">
                            neurocritical care
                        </span>
                    </h1>

                    <p className="text-base text-slate-500 leading-relaxed max-w-lg">
                        Intelligent scheduling platform for Neuro ICU staffing. Manage shift coverage, 
                        coordinate urgent procedures, and optimize provider assignments with 
                        AI-assisted constraint resolution.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <button
                            onClick={onLogin}
                            className="flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-semibold shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 hover:scale-[1.02] transition-all"
                        >
                            Access Scheduler <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200/60">
                        <div className="space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-slate-600" />
                            </div>
                            <p className="font-semibold text-slate-900 text-sm">Staff Management</p>
                            <p className="text-xs text-slate-400">Provider profiles & credentials</p>
                        </div>
                        <div className="space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-slate-600" />
                            </div>
                            <p className="font-semibold text-slate-900 text-sm">Shift Coverage</p>
                            <p className="text-xs text-slate-400">Real-time assignment tracking</p>
                        </div>
                        <div className="space-y-2">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-slate-600" />
                            </div>
                            <p className="font-semibold text-slate-900 text-sm">AI Optimization</p>
                            <p className="text-xs text-slate-400">Constraint-based scheduling</p>
                        </div>
                    </div>
                </motion.div>

                {/* Right Content - SVG Animation */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full lg:w-7/12 relative aspect-video lg:aspect-square bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex items-center justify-center"
                >

                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0f172a 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-tr from-transparent via-slate-50/30 to-transparent"></div>

                    <svg viewBox="0 0 1200 800" className="w-full h-full z-10" preserveAspectRatio="xMidYMid slice">
                        <defs>
                            <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                            <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                            <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f8fafc" />
                                <stop offset="100%" stopColor="#e2e8f0" />
                            </linearGradient>
                            <linearGradient id="building-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f1f5f9" />
                                <stop offset="100%" stopColor="#e2e8f0" />
                            </linearGradient>
                            <filter id="glass-blur">
                                <feGaussianBlur stdDeviation="2" />
                                <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" />
                            </filter>
                        </defs>

                        {/* Deep Background */}
                        <rect width="1200" height="800" fill="url(#sky-grad)" />

                        {/* Subtle pattern */}
                        <g fill="#94a3b8" opacity="0.1">
                            <circle cx="150" cy="100" r="1.5" />
                            <circle cx="300" cy="250" r="1" />
                            <circle cx="800" cy="120" r="2" />
                            <circle cx="1000" cy="300" r="1.5" />
                            <circle cx="1100" cy="150" r="1" />
                            <circle cx="600" cy="80" r="1" />
                        </g>

                        {/* === CAMERA RIG (Scales and Translates) === */}
                        <g className="animate-camera">

                            {/* Background Cityscape/Trees */}
                            <rect x="0" y="550" width="1200" height="250" fill="#f1f5f9" />
                            <path d="M100 550 L150 500 L200 550 Z" fill="#e2e8f0" />
                            <path d="M900 550 L980 470 L1100 550 Z" fill="#e2e8f0" />

                            {/* HOSPITAL BUILDING */}
                            <g id="hospital" transform="translate(300, 300)">
                                {/* Main Building Block */}
                                <rect x="0" y="0" width="600" height="350" fill="url(#building-grad)" stroke="#cbd5e1" strokeWidth="4" />

                                {/* Roof/Helipad */}
                                <rect x="-10" y="0" width="620" height="8" fill="#94a3b8" />
                                <rect x="200" y="-12" width="200" height="12" fill="#64748b" />
                                <circle cx="300" cy="-6" r="40" fill="#f1f5f9" stroke="#ef4444" strokeWidth="2" opacity="0.6" transform="scale(1, 0.3)" />
                                <text x="300" y="-2" fill="#ef4444" fontSize="14" textAnchor="middle" fontWeight="bold" opacity="0.8">H</text>

                                {/* Dynamic Helicopter Shadow on Helipad */}
                                <ellipse cx="300" cy="-6" rx="35" ry="10" fill="#000" className="animate-heli-shadow" />

                                {/* Helicopter Lights */}
                                <circle cx="210" cy="-15" r="3" fill="#3b82f6" className="animate-ping" />
                                <circle cx="390" cy="-15" r="3" fill="#ef4444" className="animate-ping" />

                                {/* --- ROOM 1: INTUBATION (Left) --- */}
                                <g id="room-intubation" transform="translate(20, 20)">
                                    {/* Room Interior */}
                                    <rect x="0" y="0" width="270" height="180" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
                                    <rect x="10" y="10" width="250" height="160" fill="#ffffff" />
                                    {/* Window */}
                                    <rect x="20" y="20" width="60" height="80" fill="#e2e8f0" opacity="0.5" />

                                    {/* Vent/Monitor */}
                                    <rect x="20" y="40" width="50" height="40" fill="#f1f5f9" rx="4" stroke="#cbd5e1" />
                                    <path d="M25 60 L35 60 L40 50 L45 70 L50 60 L65 60" stroke="#10b981" strokeWidth="2" fill="none" filter="url(#glow-green)" className="animate-wave-green" />
                                    <rect x="35" y="80" width="20" height="60" fill="#cbd5e1" />

                                    {/* Bed */}
                                    <rect x="50" y="130" width="160" height="15" fill="#94a3b8" rx="4" />
                                    <rect x="50" y="145" width="160" height="5" fill="#cbd5e1" />
                                    <line x1="70" y1="150" x2="70" y2="165" stroke="#94a3b8" strokeWidth="4" />
                                    <line x1="190" y1="150" x2="190" y2="165" stroke="#94a3b8" strokeWidth="4" />

                                    {/* Patient */}
                                    <rect x="65" y="115" width="110" height="15" fill="#e2e8f0" rx="5" />
                                    <circle cx="190" cy="115" r="14" fill="#fca5a5" />

                                    {/* Intubation Tube Context */}
                                    <path d="M190 110 Q195 90 205 90" stroke="#bae6fd" strokeWidth="2" fill="none" opacity="0.8" />

                                    {/* Doctor (Intubating from head of bed) */}
                                    <rect x="210" y="60" width="25" height="105" fill="#0ea5e9" rx="6" />
                                    <circle cx="222" cy="45" r="14" fill="#fca5a5" />
                                    <rect x="215" y="45" width="14" height="8" fill="#e0f2fe" opacity="0.9" />
                                    <g className="animate-arm-int" style={{ transformOrigin: '215px 75px' }}>
                                        <path d="M215 75 Q200 90 190 105" stroke="#0ea5e9" strokeWidth="8" strokeLinecap="round" fill="none" />
                                        <circle cx="190" cy="105" r="4" fill="#fca5a5" />
                                        <line x1="190" y1="105" x2="185" y2="112" stroke="#cbd5e1" strokeWidth="3" />
                                    </g>

                                    {/* Room Label */}
                                    <text x="135" y="15" fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold">ICU BAY 1 - RESPIRATORY</text>
                                </g>

                                {/* --- ROOM 2: EVD PLACEMENT (Right) --- */}
                                <g id="room-evd" transform="translate(310, 20)">
                                    {/* Room Interior */}
                                    <rect x="0" y="0" width="270" height="180" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
                                    <rect x="10" y="10" width="250" height="160" fill="#ffffff" />

                                    {/* Window */}
                                    <rect x="190" y="20" width="60" height="80" fill="#e2e8f0" opacity="0.5" />

                                    {/* ICP Monitor */}
                                    <rect x="200" y="40" width="50" height="40" fill="#f1f5f9" rx="4" stroke="#cbd5e1" />
                                    <path d="M205 60 Q215 50 220 60 T235 60 T245 60" stroke="#3b82f6" strokeWidth="2" fill="none" filter="url(#glow-blue)" className="animate-wave-blue" />
                                    <rect x="215" y="80" width="20" height="60" fill="#cbd5e1" />

                                    {/* Bed */}
                                    <rect x="60" y="130" width="160" height="15" fill="#94a3b8" rx="4" />
                                    <rect x="60" y="145" width="160" height="5" fill="#cbd5e1" />
                                    <line x1="80" y1="150" x2="80" y2="165" stroke="#94a3b8" strokeWidth="4" />
                                    <line x1="200" y1="150" x2="200" y2="165" stroke="#94a3b8" strokeWidth="4" />

                                    {/* EVD Stand & Rig */}
                                    <rect x="35" y="50" width="4" height="100" fill="#cbd5e1" />
                                    <line x1="25" y1="150" x2="45" y2="150" stroke="#cbd5e1" strokeWidth="4" />
                                    <rect x="30" y="70" width="14" height="25" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
                                    <circle cx="37" cy="75" r="2" fill="#ef4444" className="animate-drip" />

                                    {/* Patient */}
                                    <rect x="95" y="115" width="110" height="15" fill="#e2e8f0" rx="5" />
                                    <circle cx="80" cy="115" r="14" fill="#fca5a5" />
                                    <path d="M80 105 Q60 80 44 80" stroke="#ef4444" strokeWidth="1.5" fill="none" />

                                    {/* Surgeon (Placing EVD) */}
                                    <rect x="45" y="60" width="25" height="105" fill="#14b8a6" rx="6" />
                                    <circle cx="57" cy="45" r="14" fill="#fca5a5" />
                                    <circle cx="57" cy="45" r="15" fill="#ccfbf1" opacity="0.6" />
                                    <rect x="50" y="45" width="14" height="8" fill="#fff" opacity="0.9" />
                                    <g className="animate-arm-evd" style={{ transformOrigin: '55px 75px' }}>
                                        <path d="M55 75 Q65 90 75 100" stroke="#14b8a6" strokeWidth="8" strokeLinecap="round" fill="none" />
                                        <circle cx="75" cy="100" r="4" fill="#fca5a5" />
                                        <line x1="75" y1="100" x2="80" y2="105" stroke="#cbd5e1" strokeWidth="2" />
                                    </g>

                                    {/* Room Label */}
                                    <text x="135" y="15" fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold">ICU BAY 2 - NEURO</text>
                                </g>

                                {/* Additional lower floors */}
                                <rect x="20" y="220" width="270" height="110" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
                                <rect x="310" y="220" width="270" height="110" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />

                                <rect x="40" y="240" width="60" height="40" fill="#e2e8f0" />
                                <rect x="120" y="240" width="60" height="40" fill="#e2e8f0" />
                                <rect x="200" y="240" width="60" height="40" fill="#e2e8f0" />

                                <rect x="330" y="240" width="60" height="40" fill="#e2e8f0" />
                                <rect x="410" y="240" width="60" height="40" fill="#e2e8f0" />
                                <rect x="490" y="240" width="60" height="40" fill="#e2e8f0" />
                            </g>

                            {/* === HELICOPTER (Inside camera rig) === */}
                            <g className="animate-helicopter">
                                {/* Helicopter Body */}
                                <path d="M-40 -10 Q-60 -10 -70 0 L-70 10 Q-60 20 -40 20 L40 20 Q60 20 70 10 Q80 0 60 -10 Z" fill="#ef4444" />
                                <path d="M-20 -10 L20 -10 L30 5 L-30 5 Z" fill="#f1f5f9" />
                                <path d="M-10 -10 L0 -10 L5 5 L-15 5 Z" fill="#38bdf8" opacity="0.8" />

                                {/* Tail */}
                                <path d="M60 0 L110 -5 L120 -15 L125 0 L110 10 Z" fill="#ef4444" />
                                <rect x="115" y="-12" width="4" height="20" fill="#94a3b8" />

                                {/* Tail Rotor (Spinning) */}
                                <ellipse cx="117" cy="-2" rx="2" ry="12" fill="#cbd5e1" className="animate-rotor" style={{ transformOrigin: '117px -2px' }} />
                                <ellipse cx="117" cy="-2" rx="2" ry="12" fill="#cbd5e1" opacity="0.5" transform="rotate(45 117 -2)" className="animate-rotor" style={{ transformOrigin: '117px -2px' }} />

                                {/* Main Rotor Hub */}
                                <rect x="-10" y="-20" width="8" height="10" fill="#64748b" />

                                {/* Main Rotor (Spinning with motion blur effect) */}
                                <g className="animate-rotor" style={{ transformOrigin: '-6px -20px' }}>
                                    <ellipse cx="-6" cy="-20" rx="75" ry="2" fill="#cbd5e1" />
                                    <ellipse cx="-6" cy="-20" rx="75" ry="2" fill="#cbd5e1" opacity="0.4" transform="rotate(15 -6 -20)" />
                                    <ellipse cx="-6" cy="-20" rx="75" ry="2" fill="#cbd5e1" opacity="0.4" transform="rotate(-15 -6 -20)" />
                                </g>

                                {/* Landing Gear */}
                                <line x1="-30" y1="20" x2="-40" y2="35" stroke="#94a3b8" strokeWidth="3" />
                                <line x1="20" y1="20" x2="30" y2="35" stroke="#94a3b8" strokeWidth="3" />
                                <line x1="-50" y1="35" x2="40" y2="35" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />

                                {/* Medical Cross Symbol */}
                                <rect x="-15" y="8" width="10" height="4" fill="#fff" />
                                <rect x="-12" y="5" width="4" height="10" fill="#fff" />
                            </g>

                        </g>
                    </svg>
                </motion.div>
            </main>

            {/* Feature Section - Internal Tool Focus */}
            <section className="border-t border-slate-200 bg-white relative z-10">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-6 border border-slate-200">
                            <LayoutGrid className="w-6 h-6 text-slate-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-3">Multi-View Calendar</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            Week and month views with drag-and-drop assignment. Excel-style grid for bulk operations.
                        </p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-6 border border-slate-200">
                            <BrainCircuit className="w-6 h-6 text-slate-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-3">AI-Assisted Scheduling</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            Constraint-based auto-assignment with conflict detection and optimization recommendations.
                        </p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-6 border border-slate-200">
                            <Shield className="w-6 h-6 text-slate-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-3">Compliance & Safety</h3>
                        <p className="text-slate-500 text-sm leading-relaxed">
                            Skill-aware assignments, fatigue monitoring, and role-based access control for clinical safety.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-200 bg-slate-50 relative z-10">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-500">
                            Neuro ICU Scheduling System
                        </span>
                    </div>
                    <p className="text-xs text-slate-400">
                        Internal Use Only • Department of Neurology
                    </p>
                </div>
            </footer>
        </div>
    );
}
