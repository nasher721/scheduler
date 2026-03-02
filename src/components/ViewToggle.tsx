import { LayoutGrid, CalendarDays, BarChart3, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export type ViewMode = "grid" | "calendar" | "analytics" | "rules";

interface ViewToggleProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="toggle-container">
      <button
        onClick={() => onChange("grid")}
        className={`toggle-button ${view === "grid" ? "active" : ""}`}
      >
        {view === "grid" && (
          <motion.div
            layoutId="view-toggle-bg"
            className="toggle-indicator"
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        <LayoutGrid className="w-4 h-4 relative z-10" />
        <span className="relative z-10">Classic Grid</span>
      </button>

      <button
        onClick={() => onChange("calendar")}
        className={`toggle-button ${view === "calendar" ? "active" : ""}`}
      >
        {view === "calendar" && (
          <motion.div
            layoutId="view-toggle-bg"
            className="toggle-indicator"
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        <CalendarDays className="w-4 h-4 relative z-10" />
        <span className="relative z-10">Monthly Calendar</span>
      </button>

      <button
        onClick={() => onChange("analytics")}
        className={`toggle-button ${view === "analytics" ? "active" : ""}`}
      >
        {view === "analytics" && (
          <motion.div
            layoutId="view-toggle-bg"
            className="toggle-indicator"
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        <BarChart3 className="w-4 h-4 relative z-10" />
        <span className="relative z-10">Analytics</span>
      </button>

      <button
        onClick={() => onChange("rules")}
        className={`toggle-button ${view === "rules" ? "active" : ""}`}
      >
        {view === "rules" && (
          <motion.div
            layoutId="view-toggle-bg"
            className="toggle-indicator"
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        <ShieldAlert className="w-4 h-4 relative z-10" />
        <span className="relative z-10">Rules</span>
      </button>
    </div>
  );
}
