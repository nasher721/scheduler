import { BarChart3, ShieldAlert, Workflow, ArrowRightLeft, Gift, AlertOctagon, Bell, Brain, FileText } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export type ViewMode = "schedule" | "analytics" | "rules" | "strategy" | "swaps" | "holidays" | "conflicts" | "notifications" | "predictive" | "templates";

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="satin-panel p-1.5 flex items-center gap-1.5 border-slate-200/50 overflow-x-auto scrollbar-hide">
      <button
        onClick={() => onChange("schedule")}
        className={`nav-chip ${view === "schedule" ? "nav-chip-active" : "text-slate-600 hover:text-slate-800"}
          }`}
      >
        {view === "schedule" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <span className="relative z-10">Schedule</span>
      </button>

      <button
        onClick={() => onChange("analytics")}
        className={`nav-chip ${view === "analytics" ? "nav-chip-active" : "text-slate-600 hover:text-slate-800"}
          }`}
      >
        {view === "analytics" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <BarChart3 className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Insights</span>
      </button>

      <button
        onClick={() => onChange("rules")}
        className={`nav-chip ${view === "rules" ? "nav-chip-active" : "text-slate-600 hover:text-slate-800"}
          }`}
      >
        {view === "rules" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <ShieldAlert className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Governance</span>
      </button>
    
      <button
        onClick={() => onChange("strategy")}
        className={`nav-chip ${view === "strategy" ? "nav-chip-active" : "text-slate-600 hover:text-slate-800"}
          }`}
      >
        {view === "strategy" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Workflow className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Strategy</span>
      </button>

      <button
        onClick={() => onChange("swaps")}
        className={`nav-chip ${view === "swaps" ? "nav-chip-active" : "text-slate-600 hover:text-slate-800"}
          }`}
      >
        {view === "swaps" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <ArrowRightLeft className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Swaps</span>
      </button>

      <button
        onClick={() => onChange("holidays")}
        className={`nav-chip ${view === "holidays" ? "nav-chip-active" : "text-slate-600 hover:text-slate-800"}
          }`}
      >
        {view === "holidays" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Gift className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Holidays</span>
      </button>

      <button
        onClick={() => onChange("conflicts")}
        className={`nav-chip ${view === "conflicts" ? "text-error" : ""}
          }`}
      >
        {view === "conflicts" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <AlertOctagon className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Command</span>
      </button>

      <button
        onClick={() => onChange("notifications")}
        className={`nav-chip ${view === "notifications" ? "nav-chip-active" : "text-slate-600 hover:text-slate-800"}
          }`}
      >
        {view === "notifications" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Bell className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Alerts</span>
      </button>

      <button
        onClick={() => onChange("predictive")}
        className={`nav-chip ${view === "predictive" ? "nav-chip-active" : "text-slate-600 hover:text-slate-800"}
          }`}
      >
        {view === "predictive" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Brain className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">ML Insights</span>
      </button>

      <button
        onClick={() => onChange("templates")}
        className={`nav-chip ${view === "templates" ? "nav-chip-active" : "text-slate-600 hover:text-slate-800"}
          }`}
      >
        {view === "templates" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <FileText className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Templates</span>
      </button>
</div>
  );
}
