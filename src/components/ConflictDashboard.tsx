import { useEffect, useState } from "react";
import { useScheduleStore, type Conflict, type ConflictSeverity } from "../store";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  X, 
  Wrench, 
  User, 
  Clock,
  ShieldAlert
} from "lucide-react";
import { format, parseISO } from "date-fns";

const severityConfig: Record<ConflictSeverity, { icon: React.ReactNode; color: string; bg: string }> = {
  CRITICAL: { 
    icon: <ShieldAlert className="w-4 h-4" />, 
    color: "text-error", 
    bg: "bg-error/10 border-error/20" 
  },
  WARNING: { 
    icon: <AlertTriangle className="w-4 h-4" />, 
    color: "text-warning", 
    bg: "bg-warning/10 border-warning/20" 
  },
  INFO: { 
    icon: <Info className="w-4 h-4" />, 
    color: "text-primary", 
    bg: "bg-primary/10 border-primary/20" 
  },
};

const conflictTypeLabels: Record<string, string> = {
  OVERLOAD_FTE: "FTE Overload",
  CONSECUTIVE_NIGHTS: "Consecutive Nights",
  SKILL_MISMATCH: "Skill Mismatch",
  CREDENTIAL_EXPIRING: "Credential Expiring",
  CREDENTIAL_EXPIRED: "Credential Expired",
  FATIGUE_EXPOSURE: "Fatigue Risk",
  UNFILLED_CRITICAL: "Unfilled Critical",
  TIME_OFF_CONFLICT: "Time-Off Conflict",
};

function ConflictCard({ conflict }: { conflict: Conflict }) {
  const { acknowledgeConflict, resolveConflict, ignoreConflict, providers } = useScheduleStore();
  const config = severityConfig[conflict.severity];
  const provider = providers.find(p => p.id === conflict.providerId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`p-4 rounded-2xl border ${config.bg} transition-all ${
        conflict.acknowledged ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl ${config.color} bg-white/50`}>
          {config.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-800">{conflict.title}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{conflictTypeLabels[conflict.type]}</p>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${config.color} bg-white/50`}>
                {conflict.severity}
              </span>
              {conflict.autoResolvable && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full text-success bg-success/10">
                  Auto-Fix
                </span>
              )}
            </div>
          </div>
          
          <p className="text-xs text-slate-600 mt-2">{conflict.description}</p>
          
          {provider && (
            <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
              <User className="w-3 h-3" />
              <span>{provider.name}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
            <Clock className="w-3 h-3" />
            <span>Detected {format(parseISO(conflict.detectedAt), "MMM d, h:mm a")}</span>
          </div>

          {/* Suggested Actions */}
          <div className="mt-3 pt-3 border-t border-slate-200/50">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Suggested Actions
            </p>
            <div className="flex flex-wrap gap-2">
              {conflict.suggestedActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => resolveConflict(conflict.id, action.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                    action.type === 'AUTO_FIX'
                      ? "bg-success text-white hover:bg-success-dark"
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  {action.type === 'AUTO_FIX' && <Wrench className="w-3 h-3" />}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-1">
          {!conflict.acknowledged && (
            <button
              onClick={() => acknowledgeConflict(conflict.id)}
              className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
              title="Acknowledge"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => ignoreConflict(conflict.id)}
            className="p-1.5 text-slate-400 hover:text-error hover:bg-error/10 rounded-lg transition-all"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function ConflictDashboard() {
  const { conflicts, detectConflicts, slots, providers, resolveConflict } = useScheduleStore();
  const [filter, setFilter] = useState<"all" | ConflictSeverity>("all");
  const [lastScan, setLastScan] = useState<Date | null>(null);

  // Auto-detect conflicts on mount and periodically
  useEffect(() => {
    detectConflicts();
    setLastScan(new Date());
    
    const interval = setInterval(() => {
      detectConflicts();
      setLastScan(new Date());
    }, 30000); // Scan every 30 seconds
    
    return () => clearInterval(interval);
  }, [detectConflicts, slots, providers]);

  const filteredConflicts = conflicts.filter(c => {
    if (filter === "all") return true;
    return c.severity === filter;
  });

  const stats = {
    critical: conflicts.filter(c => c.severity === "CRITICAL").length,
    warning: conflicts.filter(c => c.severity === "WARNING").length,
    info: conflicts.filter(c => c.severity === "INFO").length,
    unresolved: conflicts.filter(c => !c.resolvedAt).length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="satin-panel p-6 bg-white/60 rounded-[2rem] border border-slate-200/40"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-error/5 rounded-2xl text-error">
            <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-serif text-slate-900">Command Center</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              {stats.unresolved} Active Issues
              {lastScan && ` · Scanned ${format(lastScan, "h:mm:ss a")}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => { detectConflicts(); setLastScan(new Date()); }}
          className="px-4 py-2 bg-primary/5 text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all"
        >
          Rescan
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="p-4 bg-error/5 rounded-2xl border border-error/10">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-error" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-error">Critical</span>
          </div>
          <p className="text-2xl font-bold text-error">{stats.critical}</p>
        </div>
        <div className="p-4 bg-warning/5 rounded-2xl border border-warning/10">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-warning">Warning</span>
          </div>
          <p className="text-2xl font-bold text-warning">{stats.warning}</p>
        </div>
        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-4 h-4 text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-primary">Info</span>
          </div>
          <p className="text-2xl font-bold text-primary">{stats.info}</p>
        </div>
        <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-slate-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-slate-700">{conflicts.length}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "CRITICAL", "WARNING", "INFO"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
              filter === f 
                ? f === "CRITICAL" ? "bg-error text-white" :
                  f === "WARNING" ? "bg-warning text-white" :
                  f === "INFO" ? "bg-primary text-white" :
                  "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {f === "all" ? "All Issues" : f}
            {f === "all" && conflicts.length > 0 && (
              <span className="ml-2 bg-white/20 px-1.5 py-0.5 rounded-full">{conflicts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Conflicts List */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {filteredConflicts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 mx-auto mb-4 bg-success/10 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-success" />
              </div>
              <p className="text-lg font-bold text-slate-700">No Conflicts Detected</p>
              <p className="text-sm text-slate-400 mt-1">Schedule is running smoothly</p>
            </motion.div>
          ) : (
            filteredConflicts.map((conflict) => (
              <ConflictCard key={conflict.id} conflict={conflict} />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Auto-Resolve All Button */}
      {conflicts.some(c => c.autoResolvable && !c.resolvedAt) && (
        <div className="mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={() => {
              conflicts
                .filter(c => c.autoResolvable && !c.resolvedAt)
                .forEach(c => {
                  const autoAction = c.suggestedActions.find(a => a.type === 'AUTO_FIX');
                  if (autoAction) resolveConflict(c.id, autoAction.id);
                });
            }}
            className="w-full py-3 bg-success text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-success-dark transition-all flex items-center justify-center gap-2"
          >
            <Wrench className="w-4 h-4" />
            Auto-Resolve {conflicts.filter(c => c.autoResolvable && !c.resolvedAt).length} Issues
          </button>
        </div>
      )}
    </motion.div>
  );
}
