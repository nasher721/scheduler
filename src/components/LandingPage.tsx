import React, { useState, useEffect } from 'react';
import { Activity, Shield, Clock, ArrowRight, BrainCircuit, HeartPulse, Lock, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScheduleStore } from '../store';

// Custom Helicopter Icon
const HelicopterIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M3 15h14l3-3-3-3H3v6z" />
        <path d="M12 9V6" />
        <path d="M7 6h10" />
        <path d="M12 15v3" />
        <path d="M9 18h6" />
    </svg>
);

interface LandingPageProps {
    onLogin: () => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
    const isAdminHash = window.location.hash === '#admin';
    const [showLoginOverlay, setShowLoginOverlay] = useState(isAdminHash);
    const [email, setEmail] = useState('');
    const login = useScheduleStore((state) => state.login);

    useEffect(() => {
        // If admin hash, login overlay is already shown via useState initializer
        if (isAdminHash) return;

        // Trigger login overlay around 22 seconds into the 24s animation cycle
        const timer = setTimeout(() => {
            setShowLoginOverlay(true);
        }, 21000);

        return () => clearTimeout(timer);
    }, [isAdminHash]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email.trim()) {
            login(email.trim().toLowerCase());
        }
    };

    return (
        <div className="min-h-dvh bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30 overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
            <style>{`
        @keyframes camera-pan {
          0%, 15% { transform: scale(2.2) translate(-3%, -18%); }
          25%, 55% { transform: scale(0.95) translate(0%, 5%); }
          65%, 72% { transform: scale(2.2) translate(-3%, -18%); }
          78%, 95% { transform: scale(15) translate(21.6%, 5%); } /* Zoom into left monitor */
          100% { transform: scale(2.2) translate(-3%, -18%); }
        }
        
        @keyframes helicopter-flight {
          0%, 25% { transform: translate(1400px, -50px) rotate(-15deg); }
          35% { transform: translate(550px, 150px) rotate(0deg); }
          42%, 58% { transform: translate(550px, 275px) rotate(0deg); }
          65% { transform: translate(550px, 150px) rotate(15deg); }
          80%, 100% { transform: translate(-300px, 0px) rotate(15deg); }
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
          3%, 6% { transform: rotate(-15deg); }
          67%, 70% { transform: rotate(-15deg); }
        }

        @keyframes arm-evd {
          0%, 100% { transform: rotate(0deg); }
          3%, 6% { transform: rotate(15deg); }
          67%, 70% { transform: rotate(15deg); }
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
          42%, 58% { transform: scale(1); opacity: 0.6; }
          65%, 100% { transform: scale(0.2); opacity: 0; }
        }

        @keyframes room-hud-fade {
          0%, 15% { opacity: 1; transform: translateY(0) scale(1); }
          22%, 58% { opacity: 0; transform: translateY(-10px) scale(0.95); }
          65%, 72% { opacity: 1; transform: translateY(0) scale(1); }
          75%, 100% { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }

        @keyframes heli-hud-fade {
          0%, 35% { opacity: 0; transform: translateY(10px); }
          42%, 58% { opacity: 1; transform: translateY(0); }
          65%, 100% { opacity: 0; transform: translateY(-10px); }
        }

        @keyframes monitor-reveal {
          0%, 76% { opacity: 0; pointer-events: none; }
          78%, 95% { opacity: 1; pointer-events: auto; }
          100% { opacity: 0; pointer-events: none; }
        }

        @keyframes draw-heartbeat {
          0%, 78% { stroke-dashoffset: 3000; fill: transparent; opacity: 0; }
          79% { stroke-dashoffset: 3000; fill: transparent; opacity: 1; }
          86% { stroke-dashoffset: 0; fill: transparent; opacity: 1; filter: drop-shadow(0px 0px 0px rgba(16,185,129,0)); }
          88%, 95% { stroke-dashoffset: 0; fill: #10b981; opacity: 1; filter: drop-shadow(0px 0px 10px rgba(16,185,129,0.8)); }
          100% { opacity: 0; stroke-dashoffset: 0; fill: transparent; }
        }

        .animate-camera {
          animation: camera-pan 24s ease-in-out infinite;
          transform-origin: center center;
        }

        .animate-helicopter {
          animation: helicopter-flight 24s ease-in-out infinite;
        }

        .animate-rotor {
          animation: rotor-spin 0.1s linear infinite;
        }

        .animate-arm-int {
          animation: arm-intubate 24s ease-in-out infinite;
        }

        .animate-arm-evd {
          animation: arm-evd 24s ease-in-out infinite;
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
          animation: room-hud-fade 24s ease-in-out infinite;
        }

        .animate-heli-hud {
          animation: heli-hud-fade 24s ease-in-out infinite;
        }

        .animate-heli-shadow {
          animation: heli-shadow 24s ease-in-out infinite;
          transform-origin: center;
        }

        .animate-monitor-reveal {
          animation: monitor-reveal 24s ease-in-out infinite;
        }

        .animate-draw-heartbeat {
          animation: draw-heartbeat 24s ease-in-out infinite;
          stroke-dasharray: 3000;
        }
      `}</style>

            {/* Navigation */}
            <nav className="absolute top-0 w-full z-50 flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:flex-nowrap sm:px-6 sm:py-6">
                <div className="flex min-w-0 items-center gap-2">
                    <BrainCircuit className="h-8 w-8 shrink-0 text-cyan-400" aria-hidden />
                    <span className="truncate text-lg font-bold tracking-tight text-white sm:text-xl">
                        Neuro<span className="text-cyan-400">Sync</span>
                    </span>
                </div>
                <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                    <a href="#" className="hover:text-cyan-400 transition-colors">Features</a>
                    <a href="#" className="hover:text-cyan-400 transition-colors">Integration</a>
                    <a href="#" className="hover:text-cyan-400 transition-colors">Security</a>
                </div>
                <button
                    type="button"
                    onClick={onLogin}
                    className="min-h-[44px] shrink-0 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-400 transition-all active:bg-cyan-500/20 sm:px-5 sm:hover:bg-cyan-500 sm:hover:text-slate-900"
                >
                    Provider Login
                </button>
            </nav>

            {/* Hero Section */}
            <main className="relative flex max-w-7xl flex-col items-center justify-between gap-10 overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:flex-row lg:gap-12 lg:px-12 lg:pb-32 lg:pt-48">

                {/* Ambient background glow */}
                <div className="absolute top-1/4 left-10 w-96 h-96 bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

                {/* Left Content */}
                <div className="w-full lg:w-5/12 z-10 space-y-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-xs font-semibold text-cyan-400">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                        </span>
                        Live Hospital Connectivity
                    </div>

                    <h1 className="text-3xl font-extrabold uppercase italic leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                        Command the <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                            Neuro ICU.
                        </span>
                    </h1>

                    <p className="text-lg text-slate-400 leading-relaxed max-w-xl">
                        The intelligent scheduling and coordination platform built specifically for Neurocritical Care. Seamlessly manage urgent EVD placements, simultaneous intubations, and incoming trauma flight logistics in real-time.
                    </p>

                    <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:gap-4">
                        <button
                            type="button"
                            onClick={() => setShowLoginOverlay(true)}
                            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.99] sm:px-8 sm:py-4 sm:hover:scale-105 sm:hover:shadow-cyan-500/40"
                        >
                            Start Scheduling <ArrowRight className="h-5 w-5" aria-hidden />
                        </button>
                        <button
                            type="button"
                            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-6 py-3.5 font-semibold text-white transition-all active:bg-slate-700 sm:px-8 sm:py-4 sm:hover:bg-slate-700"
                        >
                            Watch Demo
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-800/50">
                        <div className="space-y-1">
                            <Activity className="w-6 h-6 text-emerald-400" />
                            <p className="font-semibold text-white">Real-time</p>
                            <p className="text-xs text-slate-500">Vitals Sync</p>
                        </div>
                        <div className="space-y-1">
                            <Clock className="w-6 h-6 text-blue-400" />
                            <p className="font-semibold text-white">Zero Delay</p>
                            <p className="text-xs text-slate-500">Rapid Dispatch</p>
                        </div>
                        <div className="space-y-1">
                            <Shield className="w-6 h-6 text-indigo-400" />
                            <p className="font-semibold text-white">HIPAA</p>
                            <p className="text-xs text-slate-500">Compliant</p>
                        </div>
                    </div>
                </div>

                {/* Right Content - SVG Animation */}
                <div className="w-full lg:w-7/12 relative aspect-video lg:aspect-square bg-slate-900/50 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center">

                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                    {/* Glass glare effect over the whole screen */}
                    <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent"></div>

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
                                <stop offset="0%" stopColor="#020617" />
                                <stop offset="100%" stopColor="#0f172a" />
                            </linearGradient>
                            <linearGradient id="building-grad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#1e293b" />
                                <stop offset="100%" stopColor="#0f172a" />
                            </linearGradient>
                        </defs>

                        <rect width="1200" height="800" fill="url(#sky-grad)" />

                        <g fill="#cbd5e1" opacity="0.3">
                            <circle cx="150" cy="100" r="1.5" />
                            <circle cx="300" cy="250" r="1" />
                            <circle cx="800" cy="120" r="2" />
                            <circle cx="1000" cy="300" r="1.5" />
                            <circle cx="1100" cy="150" r="1" />
                            <circle cx="600" cy="80" r="1" />
                        </g>

                        <g className="animate-camera">

                            <rect x="0" y="550" width="1200" height="250" fill="#020617" />
                            <path d="M100 550 L150 500 L200 550 Z" fill="#0f172a" />
                            <path d="M900 550 L980 470 L1100 550 Z" fill="#0f172a" />

                            <g id="hospital" transform="translate(300, 300)">
                                <rect x="0" y="0" width="600" height="350" fill="url(#building-grad)" stroke="#334155" strokeWidth="4" />

                                <rect x="-10" y="0" width="620" height="8" fill="#475569" />
                                <rect x="200" y="-12" width="200" height="12" fill="#334155" />
                                <circle cx="300" cy="-6" r="40" fill="#1e293b" stroke="#f43f5e" strokeWidth="2" opacity="0.6" transform="scale(1, 0.3)" />
                                <text x="300" y="-2" fill="#f43f5e" fontSize="14" textAnchor="middle" fontWeight="bold" opacity="0.8">H</text>

                                <ellipse cx="300" cy="-6" rx="35" ry="10" fill="#000" className="animate-heli-shadow" />

                                <circle cx="210" cy="-15" r="3" fill="#3b82f6" className="animate-ping" />
                                <circle cx="390" cy="-15" r="3" fill="#f43f5e" className="animate-ping" />

                                <g id="room-intubation" transform="translate(20, 20)">
                                    <rect x="0" y="0" width="270" height="180" fill="#020617" stroke="#1e293b" strokeWidth="2" />
                                    <rect x="10" y="10" width="250" height="160" fill="#0f172a" />
                                    <rect x="20" y="20" width="60" height="80" fill="#1e293b" opacity="0.5" />

                                    <rect x="20" y="40" width="50" height="40" fill="#000" rx="4" stroke="#334155" />
                                    <path d="M25 60 L35 60 L40 50 L45 70 L50 60 L65 60" stroke="#10b981" strokeWidth="2" fill="none" filter="url(#glow-green)" className="animate-wave-green" />
                                    <rect x="35" y="80" width="20" height="60" fill="#334155" />

                                    <rect x="50" y="130" width="160" height="15" fill="#475569" rx="4" />
                                    <rect x="50" y="145" width="160" height="5" fill="#334155" />
                                    <line x1="70" y1="150" x2="70" y2="165" stroke="#475569" strokeWidth="4" />
                                    <line x1="190" y1="150" x2="190" y2="165" stroke="#475569" strokeWidth="4" />

                                    <rect x="65" y="115" width="110" height="15" fill="#94a3b8" rx="5" />
                                    <circle cx="190" cy="115" r="14" fill="#fca5a5" />

                                    <path d="M190 110 Q195 90 205 90" stroke="#bae6fd" strokeWidth="2" fill="none" opacity="0.8" />

                                    <rect x="210" y="60" width="25" height="105" fill="#0284c7" rx="6" />
                                    <circle cx="222" cy="45" r="14" fill="#fca5a5" />
                                    <rect x="215" y="45" width="14" height="8" fill="#e0f2fe" opacity="0.9" />
                                    <g className="animate-arm-int" style={{ transformOrigin: '215px 75px' }}>
                                        <path d="M215 75 Q200 90 190 105" stroke="#0284c7" strokeWidth="8" strokeLinecap="round" fill="none" />
                                        <circle cx="190" cy="105" r="4" fill="#fca5a5" />
                                        <line x1="190" y1="105" x2="185" y2="112" stroke="#cbd5e1" strokeWidth="3" />
                                    </g>

                                    <text x="135" y="15" fill="#64748b" fontSize="10" textAnchor="middle" fontWeight="bold">ICU BAY 1 - RESPIRATORY</text>
                                </g>

                                <g id="room-evd" transform="translate(310, 20)">
                                    <rect x="0" y="0" width="270" height="180" fill="#020617" stroke="#1e293b" strokeWidth="2" />
                                    <rect x="10" y="10" width="250" height="160" fill="#0f172a" />

                                    <rect x="190" y="20" width="60" height="80" fill="#1e293b" opacity="0.5" />

                                    <rect x="200" y="40" width="50" height="40" fill="#000" rx="4" stroke="#334155" />
                                    <path d="M205 60 Q215 50 220 60 T235 60 T245 60" stroke="#3b82f6" strokeWidth="2" fill="none" filter="url(#glow-blue)" className="animate-wave-blue" />
                                    <rect x="215" y="80" width="20" height="60" fill="#334155" />

                                    <rect x="60" y="130" width="160" height="15" fill="#475569" rx="4" />
                                    <rect x="60" y="145" width="160" height="5" fill="#334155" />
                                    <line x1="80" y1="150" x2="80" y2="165" stroke="#475569" strokeWidth="4" />
                                    <line x1="200" y1="150" x2="200" y2="165" stroke="#475569" strokeWidth="4" />

                                    <rect x="35" y="50" width="4" height="100" fill="#94a3b8" />
                                    <line x1="25" y1="150" x2="45" y2="150" stroke="#94a3b8" strokeWidth="4" />
                                    <rect x="30" y="70" width="14" height="25" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
                                    <circle cx="37" cy="75" r="2" fill="#f43f5e" className="animate-drip" />

                                    <rect x="95" y="115" width="110" height="15" fill="#94a3b8" rx="5" />
                                    <circle cx="80" cy="115" r="14" fill="#fca5a5" />
                                    <path d="M80 105 Q60 80 44 80" stroke="#f43f5e" strokeWidth="1.5" fill="none" />

                                    <rect x="45" y="60" width="25" height="105" fill="#14b8a6" rx="6" />
                                    <circle cx="57" cy="45" r="14" fill="#fca5a5" />
                                    <circle cx="57" cy="45" r="15" fill="#ccfbf1" opacity="0.6" />
                                    <rect x="50" y="45" width="14" height="8" fill="#fff" opacity="0.9" />
                                    <g className="animate-arm-evd" style={{ transformOrigin: '55px 75px' }}>
                                        <path d="M55 75 Q65 90 75 100" stroke="#14b8a6" strokeWidth="8" strokeLinecap="round" fill="none" />
                                        <circle cx="75" cy="100" r="4" fill="#fca5a5" />
                                        <line x1="75" y1="100" x2="80" y2="105" stroke="#cbd5e1" strokeWidth="2" />
                                    </g>

                                    <text x="135" y="15" fill="#64748b" fontSize="10" textAnchor="middle" fontWeight="bold">ICU BAY 2 - NEURO</text>
                                </g>

                                <rect x="20" y="220" width="270" height="110" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
                                <rect x="310" y="220" width="270" height="110" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />

                                <rect x="40" y="240" width="60" height="40" fill="#1e293b" />
                                <rect x="120" y="240" width="60" height="40" fill="#1e293b" />
                                <rect x="200" y="240" width="60" height="40" fill="#1e293b" />

                                <rect x="330" y="240" width="60" height="40" fill="#1e293b" />
                                <rect x="410" y="240" width="60" height="40" fill="#1e293b" />
                                <rect x="490" y="240" width="60" height="40" fill="#1e293b" />

                                <g className="animate-room-hud">
                                    <g transform="translate(100, 20)">
                                        <rect x="0" y="0" width="125" height="40" fill="#020617" opacity="0.85" rx="4" stroke="#10b981" strokeWidth="1" />
                                        <text x="8" y="15" fill="#10b981" fontSize="9" fontWeight="bold" letterSpacing="1">AIRWAY ALERT</text>
                                        <text x="8" y="30" fill="#94a3b8" fontSize="10">SpO2: <tspan fill="#fca5a5" className="animate-pulse">88%</tspan> → <tspan fill="#4ade80">95%</tspan></text>
                                    </g>
                                    <g transform="translate(390, 20)">
                                        <rect x="0" y="0" width="125" height="40" fill="#020617" opacity="0.85" rx="4" stroke="#3b82f6" strokeWidth="1" />
                                        <text x="8" y="15" fill="#38bdf8" fontSize="9" fontWeight="bold" letterSpacing="1">PROC: EVD PREP</text>
                                        <text x="8" y="30" fill="#94a3b8" fontSize="10">ICP: <tspan fill="#fca5a5" className="animate-pulse">24</tspan> → <tspan fill="#38bdf8">12 mmHg</tspan></text>
                                    </g>
                                </g>
                            </g>

                            <g className="animate-helicopter">
                                <path d="M-40 -10 Q-60 -10 -70 0 L-70 10 Q-60 20 -40 20 L40 20 Q60 20 70 10 Q80 0 60 -10 Z" fill="#ef4444" />
                                <path d="M-20 -10 L20 -10 L30 5 L-30 5 Z" fill="#0f172a" />
                                <path d="M-10 -10 L0 -10 L5 5 L-15 5 Z" fill="#38bdf8" opacity="0.8" />

                                <path d="M60 0 L110 -5 L120 -15 L125 0 L110 10 Z" fill="#ef4444" />
                                <rect x="115" y="-12" width="4" height="20" fill="#94a3b8" />

                                <ellipse cx="117" cy="-2" rx="2" ry="12" fill="#cbd5e1" className="animate-rotor" style={{ transformOrigin: '117px -2px' }} />
                                <ellipse cx="117" cy="-2" rx="2" ry="12" fill="#cbd5e1" opacity="0.5" transform="rotate(45 117 -2)" className="animate-rotor" style={{ transformOrigin: '117px -2px' }} />

                                <rect x="-10" y="-20" width="8" height="10" fill="#64748b" />

                                <g className="animate-rotor" style={{ transformOrigin: '-6px -20px' }}>
                                    <ellipse cx="-6" cy="-20" rx="75" ry="2" fill="#cbd5e1" />
                                    <ellipse cx="-6" cy="-20" rx="75" ry="2" fill="#cbd5e1" opacity="0.4" transform="rotate(15 -6 -20)" />
                                    <ellipse cx="-6" cy="-20" rx="75" ry="2" fill="#cbd5e1" opacity="0.4" transform="rotate(-15 -6 -20)" />
                                </g>

                                <line x1="-30" y1="20" x2="-40" y2="35" stroke="#94a3b8" strokeWidth="3" />
                                <line x1="20" y1="20" x2="30" y2="35" stroke="#94a3b8" strokeWidth="3" />
                                <line x1="-50" y1="35" x2="40" y2="35" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />

                                <rect x="-15" y="8" width="10" height="4" fill="#fff" />
                                <rect x="-12" y="5" width="4" height="10" fill="#fff" />

                                <g className="animate-heli-hud" transform="translate(80, -40)">
                                    <path d="M-10 20 L0 10 L0 0" stroke="#f43f5e" strokeWidth="1" fill="none" opacity="0.8" />
                                    <rect x="0" y="-10" width="140" height="40" fill="#020617" opacity="0.85" rx="4" stroke="#f43f5e" strokeWidth="1" />
                                    <text x="8" y="5" fill="#f43f5e" fontSize="9" fontWeight="bold" letterSpacing="1" className="animate-pulse">MEDEVAC INBOUND</text>
                                    <text x="8" y="20" fill="#e2e8f0" fontSize="10">ETA: <tspan fill="#fbbf24">00:45</tspan> | TBI Level 1</text>
                                </g>
                            </g>

                        </g>

                        <g className="animate-monitor-reveal z-50">
                            <rect x="0" y="0" width="1200" height="800" fill="#020617" />

                            <defs>
                                <pattern id="ekg-grid-new" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <rect width="40" height="40" fill="none" stroke="#0f172a" strokeWidth="1" />
                                </pattern>
                                <pattern id="ekg-grid-large-new" width="200" height="200" patternUnits="userSpaceOnUse">
                                    <rect width="200" height="200" fill="none" stroke="#1e293b" strokeWidth="2" />
                                </pattern>
                            </defs>
                            <rect width="1200" height="800" fill="url(#ekg-grid-new)" />
                            <rect width="1200" height="800" fill="url(#ekg-grid-large-new)" />

                            <g className="animate-draw-heartbeat" stroke="#10b981" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M 0 400 L 80 400 L 110 250 L 150 600 L 200 150 L 240 450 L 270 400 L 320 400" />
                                <text x="340" y="420" fontSize="64" fontWeight="900" fontFamily="sans-serif" strokeWidth="2" letterSpacing="2">
                                    Ready to Schedule?
                                </text>
                            </g>

                        </g>
                    </svg>

                    {/* Login Overlay — rendered as real HTML, outside the SVG */}
                    <AnimatePresence>
                        {showLoginOverlay && (
                            <motion.div
                                key="login-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4 }}
                                className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-slate-950/85 p-4 backdrop-blur-xl sm:p-6"
                            >
                                <motion.div
                                    initial={{ scale: 0.9, y: 20 }}
                                    animate={{ scale: 1, y: 0 }}
                                    exit={{ scale: 0.9, y: 20 }}
                                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                    className="relative w-full max-w-md overflow-hidden rounded-3xl border border-cyan-500/20 bg-slate-900 p-6 shadow-2xl shadow-cyan-500/10 sm:p-10"
                                >
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600" />

                                    <div className="flex flex-col items-center text-center gap-4 mb-8">
                                        <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                                            <Lock className="w-10 h-10 text-cyan-400" />
                                        </div>
                                        <h2 className="text-3xl font-bold text-white tracking-tight">Access Control</h2>
                                        <p className="text-slate-400 text-sm font-medium">Please authenticate to access the NeuroSync scheduling environment.</p>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500/80 ml-1">Provider Credentials</label>
                                            <div className="relative">
                                                <input
                                                    type="email"
                                                    required
                                                    autoFocus
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="name@hospital.org"
                                                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-12 py-4 text-base font-medium text-white placeholder:text-slate-600 transition-all focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                                                />
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={!email.trim()}
                                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Enter Environment
                                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </form>

                                    <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col items-center gap-4">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                            <Sparkles className="w-3 h-3 text-cyan-400" />
                                            Secure Authorization Required
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowLoginOverlay(false)}
                                            className="text-xs text-slate-500 hover:text-white transition-colors"
                                        >
                                            Return to Animation
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            <section className="border-t border-slate-800/50 bg-slate-900/30 relative z-10 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="p-8 rounded-3xl bg-slate-800/20 border border-white/5 hover:bg-slate-800/40 transition-all group">
                        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-all">
                            <HelicopterIcon className="w-7 h-7 text-cyan-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">Trauma Boarding</h3>
                        <p className="text-slate-400 leading-relaxed text-sm">
                            Track incoming medevac flights with automated ETA sync. Prepare the bay before wheels down.
                        </p>
                    </div>
                    <div className="p-8 rounded-3xl bg-slate-800/20 border border-white/5 hover:bg-slate-800/40 transition-all group">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 border border-purple-500/20 group-hover:bg-purple-500/20 transition-all">
                            <BrainCircuit className="w-7 h-7 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">Procedure Scheduling</h3>
                        <p className="text-slate-400 leading-relaxed text-sm">
                            Coordinate sterile fields, kits, and specific neurosurgeons for complex interventions like EVDs.
                        </p>
                    </div>
                    <div className="p-8 rounded-3xl bg-slate-800/20 border border-white/5 hover:bg-slate-800/40 transition-all group">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-all">
                            <HeartPulse className="w-7 h-7 text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">Airway Management</h3>
                        <p className="text-slate-400 leading-relaxed text-sm">
                            Alert respiratory therapy and specialized airway teams instantly during patient decompensation.
                        </p>
                    </div>
                </div>
            </section>

            <footer className="border-t border-white/5 bg-slate-950 py-12 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <BrainCircuit className="w-6 h-6 text-slate-600" />
                        <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Neuro ICU Scheduling</span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium">
                        © 2026 NeuroSync Systems • Clinical Coordination Environment
                    </div>
                </div>
            </footer>
        </div>
    );
}
