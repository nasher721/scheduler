import { LayoutGrid, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";

export type ViewMode = "grid" | "calendar";

interface ViewToggleProps {
    view: ViewMode;
    onChange: (view: ViewMode) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
    return (
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 backdrop-blur-md rounded-xl border border-slate-200/60 shadow-inner">
            <button
                onClick={() => onChange("grid")}
                className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors z-10 ${view === "grid" ? "text-blue-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    }`}
            >
                {view === "grid" && (
                    <motion.div
                        layoutId="view-toggle-bg"
                        className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/50 z-[-1]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                )}
                <LayoutGrid className="w-4 h-4" />
                Classic Grid
            </button>

            <button
                onClick={() => onChange("calendar")}
                className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors z-10 ${view === "calendar" ? "text-blue-700" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    }`}
            >
                {view === "calendar" && (
                    <motion.div
                        layoutId="view-toggle-bg"
                        className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200/50 z-[-1]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                )}
                <CalendarDays className="w-4 h-4" />
                Monthly Calendar
            </button>
        </div>
    );
}
