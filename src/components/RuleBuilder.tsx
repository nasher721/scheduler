import { useState } from 'react';
import { useScheduleStore, type CustomRuleType } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Plus, Trash2, Users, CalendarClock, AlertCircle } from 'lucide-react';

export function RuleBuilder() {
    const { providers, customRules, addCustomRule, removeCustomRule } = useScheduleStore();
    const [isAdding, setIsAdding] = useState(false);

    const [newRuleType, setNewRuleType] = useState<CustomRuleType>('AVOID_PAIRING');
    const [newProviderA, setNewProviderA] = useState('');
    const [newProviderB, setNewProviderB] = useState('');
    const [newProviderId, setNewProviderId] = useState('');
    const [newMaxShifts, setNewMaxShifts] = useState(4);

    const handleAddRule = () => {
        if (newRuleType === 'AVOID_PAIRING') {
            if (!newProviderA || !newProviderB || newProviderA === newProviderB) return;
            addCustomRule({ type: 'AVOID_PAIRING', providerA: newProviderA, providerB: newProviderB });
        } else if (newRuleType === 'MAX_SHIFTS_PER_WEEK') {
            if (!newProviderId || newMaxShifts < 1) return;
            addCustomRule({ type: 'MAX_SHIFTS_PER_WEEK', providerId: newProviderId, maxShifts: newMaxShifts });
        }

        setIsAdding(false);
        setNewProviderA('');
        setNewProviderB('');
        setNewProviderId('');
        setNewMaxShifts(4);
    };

    const getProviderName = (id?: string) => {
        return providers.find(p => p.id === id)?.name || 'Unknown Provider';
    };

    return (
        <div className="flex-1 overflow-auto p-6">
            <div className="max-w-5xl mx-auto space-y-10">

                {/* Header section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
                    <div>
                        <h1 className="text-4xl font-serif text-slate-900 tracking-tight">
                            Scheduling Guardrails
                        </h1>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-2">Engine Constraints & logic deployment</p>
                    </div>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all duration-300 ${isAdding
                            ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            : "bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                            }`}
                    >
                        {isAdding ? 'Deactivate Session' : (
                            <>
                                <Plus className="w-4 h-4 stroke-[3]" />
                                <span>Create Guardrail</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Global Constraints Notice */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
                    <div className="mt-0.5 bg-amber-100 p-2 rounded-lg text-amber-600">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-amber-900">Active Global Guardrails</h3>
                        <p className="text-sm text-amber-700/80 mt-1 leading-relaxed">
                            The engine automatically ensures that <strong>providers do not cross-cover multiple campuses</strong> on the same date, respects their individual PTO/CME time off, and limits back-to-back nights. You do not need to build rules for these baselines.
                        </p>
                    </div>
                </div>

                {/* Add Rule Form */}
                <AnimatePresence>
                    {isAdding && (
                        <motion.div
                            initial={{ height: 0, opacity: 0, y: -20 }}
                            animate={{ height: 'auto', opacity: 1, y: 0 }}
                            exit={{ height: 0, opacity: 0, y: -20 }}
                            className="overflow-hidden"
                        >
                            <div className="satin-panel p-8 rounded-3xl border-slate-200/40 mb-8 bg-white/60">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-2 bg-primary/5 rounded-xl text-primary">
                                        <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
                                    </div>
                                    <h3 className="text-xl font-serif text-slate-900">Define Constraint</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                    <div className="md:col-span-4">
                                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5 ml-1">Logic Model</label>
                                        <div className="relative">
                                            <select
                                                className="w-full bg-slate-50/50 border border-slate-200/60 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                value={newRuleType}
                                                onChange={(e) => setNewRuleType(e.target.value as CustomRuleType)}
                                                title="Rule Type"
                                                aria-label="Rule Type"
                                            >
                                                <option value="AVOID_PAIRING">Avoid Pairing</option>
                                                <option value="MAX_SHIFTS_PER_WEEK">Max Capacity Limit</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-300">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-8 flex items-end">
                                        {newRuleType === 'AVOID_PAIRING' && (
                                            <div className="flex items-center w-full gap-5 relative">
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5 ml-1">Entity A</label>
                                                    <select className="w-full bg-slate-50/50 border border-slate-200/60 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={newProviderA} onChange={(e) => setNewProviderA(e.target.value)} title="Provider A" aria-label="Provider A">
                                                        <option value="">Select Entity...</option>
                                                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="pt-6 text-slate-300 font-serif italic text-xs whitespace-nowrap px-2">exclusive of</div>
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5 ml-1">Entity B</label>
                                                    <select className="w-full bg-slate-50/50 border border-slate-200/60 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={newProviderB} onChange={(e) => setNewProviderB(e.target.value)} title="Provider B" aria-label="Provider B">
                                                        <option value="">Select Entity...</option>
                                                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {newRuleType === 'MAX_SHIFTS_PER_WEEK' && (
                                            <div className="flex items-center w-full gap-5">
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5 ml-1">Target Entity</label>
                                                    <select className="w-full bg-slate-50/50 border border-slate-200/60 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={newProviderId} onChange={(e) => setNewProviderId(e.target.value)} title="Target Provider" aria-label="Target Provider">
                                                        <option value="">Select Provider...</option>
                                                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="w-40">
                                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5 ml-1">Unit Limit</label>
                                                    <input
                                                        type="number"
                                                        className="w-full bg-slate-50/50 border border-slate-200/60 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                                        min="1" max="14"
                                                        value={newMaxShifts}
                                                        onChange={(e) => setNewMaxShifts(parseInt(e.target.value))}
                                                        title="Max Limit"
                                                        aria-label="Max Limit"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-10 flex justify-end gap-4 pt-8 border-t border-slate-100">
                                    <button onClick={() => setIsAdding(false)} className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">
                                        Discard
                                    </button>
                                    <button
                                        onClick={handleAddRule}
                                        disabled={
                                            (newRuleType === 'AVOID_PAIRING' && (!newProviderA || !newProviderB || newProviderA === newProviderB)) ||
                                            (newRuleType === 'MAX_SHIFTS_PER_WEEK' && (!newProviderId || newMaxShifts < 1))
                                        }
                                        className="bg-primary text-white px-8 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-lg shadow-primary/20"
                                    >
                                        Execute Command
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Existing Rules List */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-serif text-slate-900">Active Directives</h3>
                        <div className="px-3 py-1 bg-slate-50 border border-slate-200/60 rounded-full text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            Live Logic Engine
                        </div>
                    </div>

                    {customRules.length === 0 ? (
                        <div className="satin-panel py-24 flex flex-col items-center justify-center text-center bg-white/40">
                            <div className="w-20 h-20 bg-slate-50 rounded-full border border-slate-100 flex items-center justify-center mb-6 text-slate-300">
                                <AlertCircle className="w-10 h-10 stroke-[1.5]" />
                            </div>
                            <h3 className="text-xl font-serif text-slate-800 mb-2">No Active Directives</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest max-w-sm">Standard clinical algorithms are currently governing deployment.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <AnimatePresence>
                                {customRules.map((rule) => (
                                    <motion.div
                                        key={rule.id}
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.98 }}
                                        className="satin-panel p-6 flex items-start gap-5 group hover:border-slate-300/50 transition-all hover:shadow-lg hover:shadow-slate-200/20"
                                    >
                                        <div className={`p-3 rounded-2xl shrink-0 ${rule.type === 'AVOID_PAIRING' ? 'bg-error-muted text-error' : 'bg-primary-muted text-primary'}`}>
                                            {rule.type === 'AVOID_PAIRING' ? <Users className="w-5 h-5" /> : <CalendarClock className="w-5 h-5" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5 flex items-center gap-2">
                                                <span className={`w-1 h-1 rounded-full ${rule.type === 'AVOID_PAIRING' ? 'bg-error' : 'bg-primary'}`} />
                                                {rule.type === 'AVOID_PAIRING' ? 'Separation Logic' : 'Workload Threshold'}
                                            </div>
                                            <div className="text-[14px] text-slate-700 leading-relaxed font-medium">
                                                {rule.type === 'AVOID_PAIRING' && (
                                                    <>
                                                        <span className="font-bold text-slate-900">{getProviderName(rule.providerA)}</span> is restricted from joint deployment with <span className="font-bold text-slate-900">{getProviderName(rule.providerB)}</span>.
                                                    </>
                                                )}
                                                {rule.type === 'MAX_SHIFTS_PER_WEEK' && (
                                                    <>
                                                        Constrain <span className="font-bold text-slate-900">{getProviderName(rule.providerId)}</span> to a maximum of <span className="font-bold text-slate-900">{rule.maxShifts} entities</span> per 7-day tactical window.
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => removeCustomRule(rule.id)}
                                            className="p-2.5 text-slate-300 hover:text-error hover:bg-error-muted rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            aria-label="Remove Rule"
                                            title="Remove Rule"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
