import { LayoutGrid, CalendarDays, BarChart3, ShieldAlert, Workflow, ArrowRightLeft, Gift, AlertOctagon, Bell, Brain, FileText } from "lucide-react";
import { motion } from "framer-motion";

export type ViewMode = "grid" | "calendar" | "analytics" | "rules" | "strategy" | "swaps" | "holidays" | "conflicts" | "notifications" | "predictive" | "templates";

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="satin-panel p-1.5 flex items-center gap-1.5 border-slate-200/50">
      <button
        onClick={() => onChange("grid")}
        className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${view === "grid" ? "text-primary" : "text-slate-400 hover:text-slate-600"
          }`}
      >
        {view === "grid" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <LayoutGrid className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Tactical Grid</span>
      </button>

      <button
        onClick={() => onChange("calendar")}
        className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${view === "calendar" ? "text-primary" : "text-slate-400 hover:text-slate-600"
          }`}
      >
        {view === "calendar" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <CalendarDays className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Monthly Log</span>
      </button>

      <button
        onClick={() => onChange("analytics")}
        className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${view === "analytics" ? "text-primary" : "text-slate-400 hover:text-slate-600"
          }`}
      >
        {view === "analytics" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <BarChart3 className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Insights</span>
      </button>

      <button
        onClick={() => onChange("rules")}
        className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${view === "rules" ? "text-primary" : "text-slate-400 hover:text-slate-600"
          }`}
      >
        {view === "rules" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <ShieldAlert className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Governance</span>
      </button>
    
      <button
        onClick={() => onChange("strategy")}
        className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${view === "strategy" ? "text-primary" : "text-slate-400 hover:text-slate-600"
          }`}
      >
        {view === "strategy" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Workflow className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Strategy</span>
      </button>

      <button
        onClick={() => onChange("swaps")}
        className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${view === "swaps" ? "text-primary" : "text-slate-400 hover:text-slate-600"
          }`}
      >
        {view === "swaps" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <ArrowRightLeft className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Swaps</span>
      </button>

      <button
        onClick={() => onChange("holidays")}
        className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${view === "holidays" ? "text-primary" : "text-slate-400 hover:text-slate-600"
          }`}
      >
        {view === "holidays" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Gift className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Holidays</span>
      </button>

      <button
        onClick={() => onChange("conflicts")}
        className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${view === "conflicts" ? "text-error" : "text-slate-400 hover:text-slate-600"
          }`}
      >
        {view === "conflicts" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <AlertOctagon className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Command</span>
      </button>

      <button
        onClick={() => onChange("notifications")}
        className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${view === "notifications" ? "text-primary" : "text-slate-400 hover:text-slate-600"
          }`}
      >
        {view === "notifications" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Bell className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">Alerts</span>
      </button>

      <button
        onClick={() => onChange("predictive")}
        className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${view === "predictive" ? "text-primary" : "text-slate-400 hover:text-slate-600"
          }`}
      >
        {view === "predictive" && (
          <motion.div
            layoutId="view-toggle-indicator"
            className="absolute inset-0 bg-white shadow-sm border border-slate-200/50 rounded-xl z-0"
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
        <Brain className="w-3.5 h-3.5 relative z-10" />
        <span className="relative z-10">ML Insights</span>
      </button>

      <button
        onClick={() => onChange("templates")}
        className={`relative px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${view === "templates" ? "text-primary" : "text-slate-400 hover:text-slate-600"
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
