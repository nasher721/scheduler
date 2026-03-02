import { useState } from "react";
import { useScheduleStore, getProviderCounts, TimeOffType } from "../store";
import { Users, Plus, Trash2, GripVertical, Sparkles, Clock, Calendar, Moon, Sun, X, Check } from "lucide-react";
import { DraggableProvider } from "./Calendar";
import { motion, AnimatePresence } from "framer-motion";

function TimeOffForm({ onAdd }: { onAdd: (date: string, type: TimeOffType) => void }) {
  const [date, setDate] = useState("");
  const [type, setType] = useState<TimeOffType>("PTO");

  return (
    <div className="flex gap-2">
      <input
        type="date"
        className="input-base text-sm flex-1"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        title="Date"
        aria-label="Date"
      />
      <select
        className="input-base text-sm w-24 px-1"
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
        className="btn btn-primary btn-sm px-3"
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
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className="text-[11px] font-medium text-slate-500">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xs font-semibold tabular-nums ${isOver ? "text-rose-500" : isComplete ? "text-emerald-500" : "text-slate-700"
            }`}>
            {current}
          </span>
          <span className="text-[10px] text-slate-400">/</span>
          <span className="text-[10px] text-slate-400 tabular-nums">{target}</span>
        </div>
      </div>
      <div className="progress-bar">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          className={`progress-bar-fill ${isOver ? "progress-bar-fill-error" : isComplete ? "progress-bar-fill-success" : "progress-bar-fill-primary"
            }`}
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
      className="glass-panel-heavy p-5 flex flex-col gap-5 w-full max-w-sm h-fit sticky top-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Staff Roster</h2>
            <p className="text-xs text-slate-500">{providers.length} providers</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAdding(true)}
          title="Add Staff"
          className="p-2.5 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors group"
        >
          <Plus className="w-5 h-5 text-blue-600 group-hover:rotate-90 transition-transform duration-300" />
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
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  className="input-base flex-1 text-sm"
                  placeholder="Enter physician name..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={() => { setIsAdding(false); setNewName(""); }}
                  className="btn btn-ghost btn-sm text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  className="btn btn-primary btn-sm text-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  Add Provider
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
                className="provider-card group"
              >
                {/* Header Row */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-slate-100 rounded-lg transition-colors">
                      <GripVertical className="w-4 h-4 text-slate-400" />
                    </div>
                    <DraggableProvider id={p.id} name={p.name} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${progress >= 100 ? "bg-emerald-100 text-emerald-700" : progress >= 50 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                      }`}>
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
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Calendar className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeProvider(p.id)}
                      title="Remove Staff"
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <ProgressBar
                    icon={<Sun className="w-3 h-3 text-amber-500" />}
                    label="Week Day"
                    target={p.targetWeekDays}
                    current={providerCount?.weekDays || 0}
                  />
                  <ProgressBar
                    icon={<Calendar className="w-3 h-3 text-purple-500" />}
                    label="Weekend Day"
                    target={p.targetWeekendDays}
                    current={providerCount?.weekendDays || 0}
                  />
                  <ProgressBar
                    icon={<Moon className="w-3 h-3 text-indigo-500" />}
                    label="Week Night"
                    target={p.targetWeekNights}
                    current={providerCount?.weekNights || 0}
                  />
                  <ProgressBar
                    icon={<Moon className="w-3 h-3 text-rose-500" />}
                    label="Weekend Night"
                    target={p.targetWeekendNights}
                    current={providerCount?.weekendNights || 0}
                  />
                </div>

                {/* Expand/Collapse Toggle */}
                <motion.button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 py-2 border-t border-slate-100 mt-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  {isExpanded ? "Less Options" : "More Options"}
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-[10px]"
                  >
                    ▾
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
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Wk Day Target</span>
                            <input
                              type="number"
                              min={0}
                              className="input-base input-number text-sm"
                              value={p.targetWeekDays}
                              onChange={(e) => updateProvider(p.id, { targetWeekDays: Number(e.target.value) || 0 })}
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Wknd Day Target</span>
                            <input
                              type="number"
                              min={0}
                              className="input-base input-number text-sm"
                              value={p.targetWeekendDays}
                              onChange={(e) => updateProvider(p.id, { targetWeekendDays: Number(e.target.value) || 0 })}
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Wk Night Target</span>
                            <input
                              type="number"
                              min={0}
                              className="input-base input-number text-sm"
                              value={p.targetWeekNights}
                              onChange={(e) => updateProvider(p.id, { targetWeekNights: Number(e.target.value) || 0 })}
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Wknd Night Target</span>
                            <input
                              type="number"
                              min={0}
                              className="input-base input-number text-sm"
                              value={p.targetWeekendNights}
                              onChange={(e) => updateProvider(p.id, { targetWeekendNights: Number(e.target.value) || 0 })}
                            />
                          </label>
                        </div>

                        {/* Fatigue Settings */}
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Max Consec. Nights
                            </span>
                            <input
                              type="number"
                              min={1}
                              className="input-base input-number text-sm"
                              value={p.maxConsecutiveNights}
                              onChange={(e) => updateProvider(p.id, { maxConsecutiveNights: Math.max(1, Number(e.target.value) || 1) })}
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Recovery Days</span>
                            <input
                              type="number"
                              min={0}
                              className="input-base input-number text-sm"
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
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Time Off / Unavailable Dates</span>
                          <div className="flex flex-wrap gap-2 mb-1">
                            {p.timeOffRequests.map((req, i) => (
                              <div key={i} className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-medium border border-slate-200">
                                <span className={
                                  req.type === "PTO" ? "text-emerald-500" :
                                    req.type === "CME" ? "text-blue-500" :
                                      req.type === "SICK" ? "text-rose-500" : "text-amber-500"
                                }>{req.type}</span>
                                <span>{req.date}</span>
                                <button
                                  title="Remove request"
                                  aria-label="Remove request"
                                  onClick={() => {
                                    const newReqs = [...p.timeOffRequests];
                                    newReqs.splice(i, 1);
                                    updateProvider(p.id, { timeOffRequests: newReqs });
                                  }}
                                  className="hover:text-rose-500 ml-1 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
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
