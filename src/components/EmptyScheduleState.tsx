import { CalendarX, Sparkles, Upload } from "lucide-react";
import { motion } from "framer-motion";

interface EmptyScheduleStateProps {
  onImport: () => void;
  onAutoFill: () => void;
}

export function EmptyScheduleState({ onImport, onAutoFill }: EmptyScheduleStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl bg-secondary/30 border border-border/50"
    >
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-6">
          <CalendarX className="w-8 h-8 text-foreground-muted" />
        </div>
        
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Your schedule is empty
        </h2>
        
        <p className="text-sm text-foreground-muted mb-8 leading-relaxed">
          Import an existing schedule from a spreadsheet or let AI automatically assign shifts based on coverage needs and provider availability.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onImport}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm font-medium hover:bg-secondary/50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import Schedule
          </button>
          
          <button
            type="button"
            onClick={onAutoFill}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            Auto-Fill with AI
          </button>
        </div>
      </div>
    </motion.div>
  );
}
