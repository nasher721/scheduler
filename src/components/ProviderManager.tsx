import { useState } from "react";
import { useScheduleStore, getProviderCounts, TimeOffType } from "../store";
import { Users, Plus, Trash2, GripVertical, Sparkles, Clock, Calendar, Moon, Sun, X } from "lucide-react";
import { DraggableProvider } from "./Calendar";
import { motion, AnimatePresence } from "framer-motion";

function TimeOffForm({ onAdd }: { onAdd: (date: string, type: TimeOffType) => void }) {
  const [date, setDate] = useState("");
  const [type, setType] = useState<TimeOffType>("PTO");

  return (
    <div className="flex gap-2">
      <input
        type="date"
        className="flex-1 bg-white/50 border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        title="Date"
        aria-label="Date"
      />
      <select
        className="w-24 bg-white/50 border border-slate-200/60 rounded-xl px-2 py-2 text-xs font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        value={type}
        onChange={(e) => setType(e.target.value as TimeOffType)}
        title="Time Off Type"
        aria-label="Time Off Type"
      >
        <option value="PTO">PTO</option>
        <option value="CME">CME</option>
        <option value="SICK">SICK</option>
        <option value="UNAVAILABLE">Other</option>
      </select>
      <button
        onClick={() => {
          if (date) {
            onAdd(date, type);
            setDate("");
          }
        }}
        className="bg-primary text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
      >
        Add
      </button>
    </div>
  );
}

function ProgressBar({ target, current, label, icon }: { target: number; current: number; label: string; icon?: React.ReactNode }) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isOver = current > target;
  const isComplete = current === target && target > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="opacity-70">{icon}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[10px] font-bold tabular-nums ${isOver ? "text-error" : isComplete ? "text-success" : "text-slate-600"}`}>
            {current}
          </span>
          <span className="text-[9px] font-bold text-slate-300">/</span>
          <span className="text-[9px] font-bold text-slate-300 tabular-nums">{target}</span>
        </div>
      </div>
      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className={`h-full rounded-full ${isOver ? "bg-error" : isComplete ? "bg-success" : "bg-primary"
            } ${percentage < 100 ? "opacity-40" : "opacity-100"}`}
        />
      </div>
    </div>
  );
}

const parseCsv = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function ProviderManager() {
  const { providers, addProvider, removeProvider, slots, updateProvider } = useScheduleStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const counts = getProviderCounts(slots, providers);

  const handleAdd = () => {
    if (!newName.trim()) return;
    addProvider({
      name: newName.trim(),
      targetWeekDays: 10,
      targetWeekendDays: 4,
      targetWeekNights: 3,
      targetWeekendNights: 2,
      timeOffRequests: [],
      preferredDates: [],
      skills: ["NEURO_CRITICAL"],
      maxConsecutiveNights: 2,
      minDaysOffAfterNight: 1,
    });
    setNewName("");
    setIsAdding(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      className="satin-panel p-6 flex flex-col gap-6 w-full max-w-sm h-fit sticky top-6 bg-white/60 rounded-[2rem] border-slate-200/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-primary/5 rounded-2xl text-primary">
            <Users className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-serif text-slate-900 leading-tight">Clinical Staff</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{providers.length} Active Profiles</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAdding(true)}
          title="Add Staff"
          className="p-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
        </motion.button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: "auto", opacity: 1, marginBottom: 8 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-200/60 mb-6 group transition-all hover:bg-white hover:shadow-md">
              <div className="flex gap-3">
                <input
                  autoFocus
                  type="text"
                  className="w-full bg-white border border-slate-200/60 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-300"
                  placeholder="Enter medical signature..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => { setIsAdding(false); setNewName(""); }}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Discard
                </button>
                <button
                  onClick={handleAdd}
                  className="bg-primary text-white px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
                >
                  Initialize Profile
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Provider Cards */}
      <div className="flex flex-col gap-3 -mx-1 px-1 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {providers.length === 0 && !isAdding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No providers yet</p>
              <p className="text-xs text-slate-400 mt-1">Click the + button to add staff</p>
            </motion.div>
          )}

          {providers.map((p, index) => {
            const isExpanded = expandedId === p.id;
            const providerCount = counts[p.id];
            const totalAssigned = providerCount
              ? providerCount.weekDays + providerCount.weekendDays + providerCount.weekNights + providerCount.weekendNights
              : 0;
            const totalTarget = p.targetWeekDays + p.targetWeekendDays + p.targetWeekNights + p.targetWeekendNights;
            const progress = totalTarget > 0 ? Math.round((totalAssigned / totalTarget) * 100) : 0;

            return (
              <motion.div
                layout
                layoutId={p.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                key={p.id}
                className="provider-card group relative bg-white/40 border border-slate-200/40 rounded-2xl p-4 transition-all hover:bg-white hover:border-slate-300/50 hover:shadow-xl hover:shadow-slate-200/30"
              >
                {/* Header Row */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="cursor-grab active:cursor-grabbing p-1.5 -ml-1 text-slate-200 group-hover:text-slate-400 transition-colors">
                      <GripVertical className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <DraggableProvider id={p.id} name={p.name} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${progress >= 100 ? "bg-success-muted text-success" : progress >= 50 ? "bg-primary-muted text-primary" : "bg-slate-100 text-slate-500"}`}>
                      {progress}%
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        import("../lib/icalUtils").then((m) => m.generateProviderICal(p, slots));
                      }}
                      title="Export Schedule to iCal"
                      className="opacity-0 group-hover:opacity-100 p-2 text-primary hover:bg-primary-muted rounded-xl transition-all"
                    >
                      <Calendar className="w-4 h-4 stroke-[2.5]" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeProvider(p.id)}
                      title="Remove Staff"
                      className="opacity-0 group-hover:opacity-100 p-2 text-error hover:bg-error-muted rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4 stroke-[2.5]" />
                    </motion.button>
                  </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <ProgressBar
                    icon={<Sun className="w-2.5 h-2.5 text-warning" />}
                    label="Wk Day"
                    target={p.targetWeekDays}
                    current={providerCount?.weekDays || 0}
                  />
                  <ProgressBar
                    icon={<Calendar className="w-2.5 h-2.5 text-primary" />}
                    label="Wknd Day"
                    target={p.targetWeekendDays}
                    current={providerCount?.weekendDays || 0}
                  />
                  <ProgressBar
                    icon={<Moon className="w-2.5 h-2.5 text-slate-400" />}
                    label="Wk Night"
                    target={p.targetWeekNights}
                    current={providerCount?.weekNights || 0}
                  />
                  <ProgressBar
                    icon={<Moon className="w-2.5 h-2.5 text-error" />}
                    label="Wknd Night"
                    target={p.targetWeekendNights}
                    current={providerCount?.weekendNights || 0}
                  />
                </div>

                {/* Expand/Collapse Toggle */}
                <motion.button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary py-3 border-t border-slate-100/50 mt-2 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isExpanded ? "Collapse Details" : "Refine Parameters"}
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                  </motion.span>
                </motion.button>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 space-y-3 border-t border-slate-100 mt-2">
                        {/* Target Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                          <label className="flex flex-col gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Deploy Wk Day</span>
                            <input
                              type="number"
                              min={0}
                              className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                              value={p.targetWeekDays}
                              onChange={(e) => updateProvider(p.id, { targetWeekDays: Number(e.target.value) || 0 })}
                            />
                          </label>
                          <label className="flex flex-col gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Deploy Wknd Day</span>
                            <input
                              type="number"
                              min={0}
                              className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                              value={p.targetWeekendDays}
                              onChange={(e) => updateProvider(p.id, { targetWeekendDays: Number(e.target.value) || 0 })}
                            />
                          </label>
                          <label className="flex flex-col gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Deploy Wk Night</span>
                            <input
                              type="number"
                              min={0}
                              className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                              value={p.targetWeekNights}
                              onChange={(e) => updateProvider(p.id, { targetWeekNights: Number(e.target.value) || 0 })}
                            />
                          </label>
                          <label className="flex flex-col gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Deploy Wknd Night</span>
                            <input
                              type="number"
                              min={0}
                              className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                              value={p.targetWeekendNights}
                              onChange={(e) => updateProvider(p.id, { targetWeekendNights: Number(e.target.value) || 0 })}
                            />
                          </label>
                        </div>

                        {/* Fatigue Settings */}
                        <div className="grid grid-cols-2 gap-4">
                          <label className="flex flex-col gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              Max Duty Cycle
                            </span>
                            <input
                              type="number"
                              min={1}
                              className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                              value={p.maxConsecutiveNights}
                              onChange={(e) => updateProvider(p.id, { maxConsecutiveNights: Math.max(1, Number(e.target.value) || 1) })}
                            />
                          </label>
                          <label className="flex flex-col gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Recovery Window</span>
                            <input
                              type="number"
                              min={0}
                              className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                              value={p.minDaysOffAfterNight}
                              onChange={(e) => updateProvider(p.id, { minDaysOffAfterNight: Math.max(0, Number(e.target.value) || 0) })}
                            />
                          </label>
                        </div>

                        {/* Skills */}
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Skills (comma-separated)</span>
                          <input
                            type="text"
                            className="input-base text-sm"
                            value={p.skills.join(", ")}
                            onChange={(e) => updateProvider(p.id, { skills: parseCsv(e.target.value) })}
                          />
                        </label>

                        {/* Preferred Dates */}
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Preferred Dates (YYYY-MM-DD)</span>
                          <input
                            type="text"
                            className="input-base text-sm"
                            placeholder="e.g., 2024-01-15, 2024-01-16"
                            value={p.preferredDates.join(", ")}
                            onChange={(e) => updateProvider(p.id, { preferredDates: parseCsv(e.target.value) })}
                          />
                        </label>

                        {/* Time-Off Requests */}
                        <div className="flex flex-col gap-3 pt-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Tactical Exclusions</span>
                          <div className="flex flex-wrap gap-2">
                            {p.timeOffRequests.map((req, i) => {
                              const borderColors: Record<string, string> = {
                                PTO: '#10b981',
                                CME: '#3b82f6',
                                SICK: '#f43f5e'
                              };
                              return (
                                <div key={i} className="flex items-center gap-2 bg-white border border-slate-200/60 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border-l-4 transition-all hover:shadow-sm" style={{ borderLeftColor: borderColors[req.type] || '#f59e0b' }}>
                                  <span className={
                                    req.type === "PTO" ? "text-emerald-500" :
                                      req.type === "CME" ? "text-blue-500" :
                                        req.type === "SICK" ? "text-rose-500" : "text-amber-500"
                                  }>{req.type}</span>
                                  <span className="text-slate-600 font-mono tracking-tight">{req.date}</span>
                                  <button
                                    title="Remove request"
                                    aria-label="Remove request"
                                    onClick={() => {
                                      const newReqs = [...p.timeOffRequests];
                                      newReqs.splice(i, 1);
                                      updateProvider(p.id, { timeOffRequests: newReqs });
                                    }}
                                    className="text-slate-300 hover:text-error ml-1.5 transition-colors"
                                  >
                                    <X className="w-3 h-3 stroke-[3]" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <TimeOffForm
                            onAdd={(date, type) => {
                              updateProvider(p.id, {
                                timeOffRequests: [...p.timeOffRequests, { date, type }]
                              });
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
