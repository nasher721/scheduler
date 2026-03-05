import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScheduleStore } from "../store";
import { format, parseISO } from "date-fns";
import { 
  ClipboardList, 
  ChevronDown, 
  Save, 
  Trash2,
  Clock
} from "lucide-react";

interface DayHandoffCardProps {
  date: Date;
  isExpanded?: boolean;
}

export function DayHandoffCard({ date, isExpanded: defaultExpanded = false }: DayHandoffCardProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const { dayHandoffs, setDayHandoff, clearDayHandoff } = useScheduleStore();
  
  const handoff = dayHandoffs.find(h => h.date === dateStr);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(handoff?.notes || "");

  const handleSave = () => {
    setDayHandoff(dateStr, notes);
    setIsEditing(false);
  };

  const handleClear = () => {
    clearDayHandoff(dateStr);
    setNotes("");
    setIsEditing(false);
  };

  const hasNotes = Boolean(handoff?.notes);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border transition-all ${
        hasNotes 
          ? 'bg-amber-50/80 border-amber-200' 
          : 'bg-slate-50/50 border-slate-200/50'
      }`}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${hasNotes ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-semibold text-slate-700">
              Daily Handoff
            </span>
            {hasNotes && (
              <span className="ml-2 text-xs text-amber-600 font-medium">
                • Has notes
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && hasNotes && (
            <span className="text-xs text-slate-400 truncate max-w-[150px]">
              {handoff?.notes.substring(0, 30)}...
            </span>
          )}
          <ChevronDown 
            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          />
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter daily handoff notes... (e.g., 'New admission in G20', 'Dr. Smith covering for Dr. Jones')"
                    className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 resize-none"
                    rows={4}
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {handoff ? `Updated ${format(parseISO(handoff.updatedAt), "MMM d, h:mm a")}` : "New note"}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasNotes && (
                        <button
                          onClick={handleClear}
                          className="flex items-center gap-1 px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Clear
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setNotes(handoff?.notes || "");
                          setIsEditing(false);
                        }}
                        className="px-3 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={!notes.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {hasNotes ? (
                    <div 
                      onClick={() => setIsEditing(true)}
                      className="p-3 bg-white rounded-lg border border-amber-100 text-sm text-slate-700 cursor-pointer hover:border-amber-300 transition-colors"
                    >
                      <p className="whitespace-pre-wrap">{handoff?.notes}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="w-full p-4 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-amber-300 hover:text-amber-500 transition-colors"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <ClipboardList className="w-5 h-5" />
                        <span className="text-sm">Click to add daily handoff notes</span>
                      </div>
                    </button>
                  )}
                  
                  {hasNotes && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        Updated {format(parseISO(handoff!.updatedAt), "MMM d, h:mm a")}
                        {handoff?.updatedBy && ` by ${handoff.updatedBy}`}
                      </div>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                      >
                        Edit notes
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface DayHandoffIndicatorProps {
  date: Date;
  onClick?: () => void;
}

export function DayHandoffIndicator({ date, onClick }: DayHandoffIndicatorProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const { dayHandoffs } = useScheduleStore();
  const handoff = dayHandoffs.find(h => h.date === dateStr);

  if (!handoff?.notes) return null;

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded-full hover:bg-amber-200 transition-colors"
      title={handoff.notes}
    >
      <ClipboardList className="w-3 h-3" />
      Handoff
    </button>
  );
}
