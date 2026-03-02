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
        <div className="flex-1 overflow-auto p-2">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-br from-slate-800 to-slate-600 bg-clip-text text-transparent">
                            Scheduling Guardrails
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium">Build custom rules and constraints for the auto-fill engine.</p>
                    </div>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 active:scale-[0.98] transition-all"
                    >
                        {isAdding ? 'Cancel' : (
                            <>
                                <Plus className="w-5 h-5" />
                                <span>Create Rule</span>
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
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="glass-panel-heavy p-6 rounded-2xl border-indigo-100/50 mb-6">
                                <h3 className="text-lg font-bold text-slate-800 mb-5">Configure New Rule</h3>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                    <div className="md:col-span-4">
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Rule Type</label>
                                        <div className="relative">
                                            <select
                                                className="w-full form-input appearance-none bg-white font-medium"
                                                value={newRuleType}
                                                onChange={(e) => setNewRuleType(e.target.value as CustomRuleType)}
                                                title="Rule Type"
                                                aria-label="Rule Type"
                                            >
                                                <option value="AVOID_PAIRING">Avoid Pairing</option>
                                                <option value="MAX_SHIFTS_PER_WEEK">Max Shifts Per Week</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-8 flex items-end">
                                        {newRuleType === 'AVOID_PAIRING' && (
                                            <div className="flex items-center w-full gap-4 relative">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Provider A</label>
                                                    <select className="w-full form-input bg-white" value={newProviderA} onChange={(e) => setNewProviderA(e.target.value)} title="Provider A" aria-label="Provider A">
                                                        <option value="">Select Provide A...</option>
                                                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="px-2 pt-6 text-slate-400 font-medium italic select-none text-sm">cannot work with</div>
                                                <div className="flex-1">
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Provider B</label>
                                                    <select className="w-full form-input bg-white" value={newProviderB} onChange={(e) => setNewProviderB(e.target.value)} title="Provider B" aria-label="Provider B">
                                                        <option value="">Select Provide B...</option>
                                                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        {newRuleType === 'MAX_SHIFTS_PER_WEEK' && (
                                            <div className="flex items-center w-full gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Target Provider</label>
                                                    <select className="w-full form-input bg-white" value={newProviderId} onChange={(e) => setNewProviderId(e.target.value)} title="Target Provider" aria-label="Target Provider">
                                                        <option value="">Select Provider...</option>
                                                        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </select>
                                                </div>
                                                <div className="w-48">
                                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Max limit (7-day window)</label>
                                                    <input
                                                        type="number"
                                                        className="w-full form-input bg-white"
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

                                <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
                                    <button onClick={() => setIsAdding(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddRule}
                                        disabled={
                                            (newRuleType === 'AVOID_PAIRING' && (!newProviderA || !newProviderB || newProviderA === newProviderB)) ||
                                            (newRuleType === 'MAX_SHIFTS_PER_WEEK' && (!newProviderId || newMaxShifts < 1))
                                        }
                                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none transition-all"
                                    >
                                        Save Guardrail
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Existing Rules List */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800">Custom Engine Rules</h3>

                    {customRules.length === 0 ? (
                        <div className="glass-panel-heavy py-16 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-white/40 rounded-full border border-white/60 flex items-center justify-center mb-4 text-slate-400">
                                <AlertCircle className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 mb-1">No Custom Rules Configured</h3>
                            <p className="text-slate-500 max-w-sm">The auto-fill engine is currently running entirely on default constraints and provider targets.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <AnimatePresence>
                                {customRules.map((rule) => (
                                    <motion.div
                                        key={rule.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="glass-panel-heavy p-5 flex items-start gap-4 group"
                                    >
                                        <div className={`p-2.5 rounded-xl shrink-0 ${rule.type === 'AVOID_PAIRING' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {rule.type === 'AVOID_PAIRING' ? <Users className="w-5 h-5" /> : <CalendarClock className="w-5 h-5" />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                                                {rule.type === 'AVOID_PAIRING' ? 'Constraint: Avoid Pairing' : 'Constraint: Workload Limit'}
                                            </div>
                                            <div className="font-medium text-slate-700 leading-snug">
                                                {rule.type === 'AVOID_PAIRING' && (
                                                    <>
                                                        <span className="font-bold text-slate-900">{getProviderName(rule.providerA)}</span> cannot be scheduled on the same day as <span className="font-bold text-slate-900">{getProviderName(rule.providerB)}</span>.
                                                    </>
                                                )}
                                                {rule.type === 'MAX_SHIFTS_PER_WEEK' && (
                                                    <>
                                                        Limit <span className="font-bold text-slate-900">{getProviderName(rule.providerId)}</span> to a maximum of <span className="font-bold text-slate-900">{rule.maxShifts} shifts</span> in any rolling 7-day window.
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => removeCustomRule(rule.id)}
                                            className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
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
