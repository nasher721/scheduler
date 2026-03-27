import { useState } from "react";
import { useScheduleStore, getProviderCounts, type TimeOffType, getProviderCredentialSummary } from "../store";
import { Users, Plus, Trash2, GripVertical, Sparkles, Clock, Calendar, Moon, Sun, X } from "lucide-react";
import { DraggableProvider } from "./Calendar";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getAvatarColor, getInitials, maskPlaceholderEmail } from "@/lib/utils";

function TimeOffForm({ onAdd }: { onAdd: (date: string, type: TimeOffType) => void }) {
  const [date, setDate] = useState("");
  const [type, setType] = useState<TimeOffType>("PTO");

  return (
    <div className="flex gap-2">
      <input
        type="date"
        className="flex-1 input-base rounded-lg py-2 text-sm"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        title="Date"
        aria-label="Date"
      />
      <select
        className="w-24 input-base rounded-lg py-2 text-sm appearance-none"
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
        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
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
          <span className="text-xs font-medium text-foreground-muted">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xs font-semibold tabular-nums ${isOver ? "text-error" : isComplete ? "text-success" : "text-foreground"}`}>
            {current}
          </span>
          <span className="text-xs text-foreground-muted">/</span>
          <span className="text-xs text-foreground-muted tabular-nums">{target}</span>
        </div>
      </div>
      <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
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
  const [newEmail, setNewEmail] = useState("");
  const [nameError, setNameError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const counts = getProviderCounts(slots, providers);

  const handleAdd = () => {
    if (!newName.trim()) {
      setNameError(true);
      return;
    }
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
      credentials: [],
      email: newEmail.trim() || undefined,
    });
    setNewName("");
    setNewEmail("");
    setNameError(false);
    setIsAdding(false);
  };

  const handleDiscard = () => {
    setIsAdding(false);
    setNewName("");
    setNewEmail("");
    setNameError(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="stone-panel border-l-4 border-l-primary p-5 flex flex-col gap-5 w-full h-fit sticky top-6"
    >
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <Users className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Clinical staff</h2>
            <p className="text-xs text-foreground-muted mt-0.5">{providers.length} providers</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsAdding(true)}
          title="Add provider"
          aria-label="Add provider"
          className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
        </motion.button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: "auto", opacity: 1, marginBottom: 8 }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-secondary/30 rounded-xl border border-border mb-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <input
                    autoFocus
                    type="text"
                    className={cn("input-base rounded-lg py-2.5", nameError && "border-error focus:ring-error/20 animate-[shake_0.3s_ease]")}
                    placeholder="Name (required)"
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); if (nameError) setNameError(false); }}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  />
                  {nameError && (
                    <p className="text-xs font-medium text-error px-1">Name is required.</p>
                  )}
                </div>
                <input
                  type="email"
                  className="input-base rounded-lg py-2.5"
                  placeholder="Email (optional)"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleDiscard(); }}
                  className="px-3 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Add provider
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex max-h-[min(70vh,calc(100dvh-240px))] flex-col gap-3 overflow-y-auto scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {providers.length === 0 && !isAdding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <div className="w-14 h-14 mx-auto mb-3 bg-secondary/50 rounded-xl flex items-center justify-center">
                <Users className="w-7 h-7 text-foreground-muted" />
              </div>
              <p className="text-sm text-foreground-muted">No providers yet</p>
              <p className="text-xs text-foreground-muted/80 mt-1">Click + to add staff</p>
            </motion.div>
          )}

          {providers.map((p, index) => {
            const isExpanded = expandedId === p.id;
            const providerCount = counts[p.id];
            const totalAssigned = providerCount
              ? providerCount.weekDays + providerCount.weekendDays + providerCount.weekNights + providerCount.weekendNights
              : 0;
            const totalTarget = p.targetWeekDays + p.targetWeekendDays + p.targetWeekNights;
            const progress = totalTarget > 0 ? Math.round((totalAssigned / totalTarget) * 100) : 0;

            return (
              <motion.div
                layout
                layoutId={p.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.98 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
                key={p.id}
                className="provider-card group relative bg-surface border border-border rounded-xl p-4 transition-all hover:border-primary/20 hover:shadow-md"
              >
                {/* Header Row */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="cursor-grab active:cursor-grabbing p-1.5 -ml-1 text-slate-200 group-hover:text-slate-400 transition-colors">
                      <GripVertical className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0",
                        getAvatarColor(p.name)
                      )}
                    >
                      {getInitials(p.name)}
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <DraggableProvider id={p.id} name={p.name} />
                      {p.email ? <p className="text-xs text-slate-400 mt-1">{maskPlaceholderEmail(p.email)}</p> : null}
                      {(() => {
                        const credentialSummary = getProviderCredentialSummary(p);
                        if (credentialSummary.hasExpiredCredentials) {
                          return <p className="text-[9px] font-bold uppercase tracking-wider text-error mt-1">Credential expired</p>;
                        }
                        if (credentialSummary.hasExpiringSoonCredentials) {
                          return <p className="text-[9px] font-bold uppercase tracking-wider text-warning mt-1">Credential expiring soon</p>;
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${progress >= 100 ? "bg-success/10 text-success" : progress >= 50 ? "bg-primary/10 text-primary" : "bg-secondary text-foreground-muted"}`}>
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

                {/* FTE Targets Summary */}
                <p className="text-[10px] font-mono text-slate-400 mb-3 px-0.5">
                  Wk Day: {p.targetWeekDays} | Wknd: {p.targetWeekendDays} | Nights: {p.targetWeekNights}
                </p>

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
                    label="FTE Nights"
                    target={p.targetWeekNights}
                    current={(providerCount?.weekNights || 0) + (providerCount?.weekendNights || 0)}
                  />
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-medium text-slate-500">Recovery</span>
                  </div>
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
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">FTE Weeks (Mon-Fri)</span>
                            <input
                              type="number"
                              min={0}
                              className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                              value={p.targetWeekDays}
                              onChange={(e) => updateProvider(p.id, { targetWeekDays: Number(e.target.value) || 0 })}
                            />
                          </label>
                          <label className="flex flex-col gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">FTE Weekends (Sat-Sun)</span>
                            <input
                              type="number"
                              min={0}
                              className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                              value={p.targetWeekendDays}
                              onChange={(e) => updateProvider(p.id, { targetWeekendDays: Number(e.target.value) || 0 })}
                            />
                          </label>
                          <label className="flex flex-col gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">FTE Nights</span>
                            <input
                              type="number"
                              min={0}
                              className="w-full bg-white border border-slate-200/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                              value={p.targetWeekNights}
                              onChange={(e) => { const nights = Number(e.target.value) || 0; updateProvider(p.id, { targetWeekNights: nights, targetWeekendNights: nights }); }}
                            />
                          </label>
                          <div className="flex flex-col gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 px-1">Night Recovery</span>
                            <div className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-[10px] font-medium text-slate-600">
                              Recovery days are excluded from service/FTE totals.
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Recovery Rule</p>
                          <p className="mt-1 text-[10px] text-slate-500">Mon-Wed nights → Thu/Fri off. Thu-Sun nights → next week recovery.</p>
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

                        <label className="flex flex-col gap-1.5">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Email for Schedule Updates</span>
                          <input
                            type="email"
                            className="input-base text-sm"
                            placeholder="physician@hospital.org"
                            value={p.email || ""}
                            onChange={(e) => updateProvider(p.id, { email: e.target.value.trim() || undefined })}
                          />
                        </label>

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
                            {p.timeOffRequests.map((req, i) => (
                              <div key={i} className={`flex items-center gap-2 bg-white border border-slate-200/60 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border-l-4 transition-all hover:shadow-sm ${req.type === "PTO" ? "border-l-emerald-500" :
                                req.type === "CME" ? "border-l-blue-500" :
                                  req.type === "SICK" ? "border-l-rose-500" : "border-l-amber-500"
                                }`}>
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
