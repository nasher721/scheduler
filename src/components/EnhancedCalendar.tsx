import { useState, useMemo } from "react";
import { useScheduleStore, type ShiftSlot, type Provider, type Conflict, type CalendarPresentationMode, type ShiftType } from "../store";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { format, parseISO, isToday, isWeekend } from "date-fns";
import { 
  GripVertical, 
  Sun, 
  Moon, 
  AlertTriangle, 
  Sparkles, 
  MapPin, 
  Activity, 
  Stethoscope,
  Calendar as CalendarIcon,
  Clock,
  User,
  Bot
} from 'lucide-react';
import { motion } from 'framer-motion';
import { InlineSuggestions } from './InlineSuggestions';
import { useScheduleViewport } from './schedule/useScheduleViewport';

export type CalendarViewMode = Exclude<CalendarPresentationMode, "month">;

const shiftConfig: Record<ShiftType, { 
  label: string; 
  icon: React.ReactNode; 
  colorClass: string; 
  bgClass: string;
  borderClass: string;
  gradient: string;
}> = {
  DAY: {
    label: 'Day',
    icon: <Sun className="w-3.5 h-3.5" />,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    gradient: 'from-emerald-400 to-teal-500'
  },
  NIGHT: {
    label: 'Night',
    icon: <Moon className="w-3.5 h-3.5" />,
    colorClass: 'text-indigo-600',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200',
    gradient: 'from-indigo-400 to-purple-500'
  },
  NMET: {
    label: 'NMET',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    gradient: 'from-amber-400 to-orange-500'
  },
  JEOPARDY: {
    label: 'Jeopardy',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    colorClass: 'text-rose-600',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
    gradient: 'from-rose-400 to-pink-500'
  },
  RECOVERY: {
    label: 'Recovery',
    icon: <Activity className="w-3.5 h-3.5" />,
    colorClass: 'text-teal-600',
    bgClass: 'bg-teal-50',
    borderClass: 'border-teal-200',
    gradient: 'from-teal-400 to-cyan-500'
  },
  CONSULTS: {
    label: 'Consults',
    icon: <Stethoscope className="w-3.5 h-3.5" />,
    colorClass: 'text-sky-600',
    bgClass: 'bg-sky-50',
    borderClass: 'border-sky-200',
    gradient: 'from-sky-400 to-blue-500'
  },
  VACATION: {
    label: 'Vacation',
    icon: <Clock className="w-3.5 h-3.5" />,
    colorClass: 'text-slate-500',
    bgClass: 'bg-slate-100',
    borderClass: 'border-slate-200',
    gradient: 'from-slate-400 to-gray-500'
  },
};

// Provider Avatar with initials
function ProviderAvatar({ provider, size = "md", showConflict = false }: { 
  provider?: Provider; 
  size?: "sm" | "md" | "lg";
  showConflict?: boolean;
}) {
  if (!provider) return null;
  
  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm"
  };

  return (
    <div className={`relative ${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-sm ${showConflict ? 'ring-2 ring-error' : ''}`}>
      {provider.name.charAt(0).toUpperCase()}
      {showConflict && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-error rounded-full flex items-center justify-center">
          <AlertTriangle className="w-2 h-2 text-white" />
        </div>
      )}
    </div>
  );
}

// Enhanced Slot Card
function SlotCard({ 
  slot, 
  provider, 
  hasConflict,
  viewMode,
  onClick
}: { 
  slot: ShiftSlot; 
  provider?: Provider; 
  hasConflict?: boolean;
  viewMode: CalendarPresentationMode;
  onClick?: (e: React.MouseEvent, slot: ShiftSlot, provider?: Provider) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slot.id,
    data: { slotId: slot.id }
  });

  const config = shiftConfig[slot.type];

  if (viewMode === "grid") {
    return (
      <motion.div
        ref={setNodeRef}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02, y: -2 }}
        onClick={(e) => onClick?.(e, slot, provider)}
        className={`relative p-3 rounded-2xl border-2 transition-all cursor-pointer ${
          isOver ? 'border-primary bg-primary/5 scale-105' : ''
        } ${
          provider 
            ? `${config.bgClass} ${config.borderClass}` 
            : 'bg-white border-slate-200 hover:border-slate-300'
        } ${hasConflict ? 'ring-2 ring-error/50' : ''}`}
      >
        {/* Shift Type Badge */}
        <div className="flex items-center justify-between mb-2">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bgClass}`}>
            {config.icon}
            <span className={`text-[10px] font-bold uppercase tracking-wider ${config.colorClass}`}>
              {config.label}
            </span>
          </div>
          {slot.priority === 'CRITICAL' && !provider && (
            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[9px] font-bold rounded-full">
              Critical
            </span>
          )}
        </div>

        {/* Provider or Empty */}
        <div className="flex items-center gap-2">
          {provider ? (
            <>
              <ProviderAvatar provider={provider} size="sm" showConflict={hasConflict} />
              <span className="text-sm font-medium text-slate-700 truncate">{provider.name}</span>
            </>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                <User className="w-3 h-3" />
              </div>
              <span className="text-xs italic">Unassigned</span>
            </div>
          )}
        </div>

        {/* Location */}
        {slot.location && (
          <div className="flex items-center gap-1 mt-2 text-[9px] text-slate-500">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{slot.location}</span>
          </div>
        )}
      </motion.div>
    );
  }

  // List view
  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        isOver ? 'border-primary bg-primary/5' : 'bg-white border-slate-200'
      } ${hasConflict ? 'ring-1 ring-error' : ''}`}
    >
      <div className={`p-2 rounded-lg ${config.bgClass} ${config.colorClass}`}>
        {config.icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${config.colorClass}`}>{config.label}</span>
          <span className="text-[10px] text-slate-400">{slot.location}</span>
        </div>
        {provider ? (
          <div className="flex items-center gap-2 mt-1">
            <ProviderAvatar provider={provider} size="sm" showConflict={hasConflict} />
            <span className="text-sm font-medium text-slate-700">{provider.name}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">Drop provider here</span>
        )}
      </div>

      {slot.priority === 'CRITICAL' && !provider && (
        <span className="px-2 py-1 bg-rose-100 text-rose-600 text-[9px] font-bold rounded-full">
          Critical
        </span>
      )}
    </motion.div>
  );
}

// Timeline View
function TimelineView({ 
  slots, 
  providers, 
  conflicts 
}: { 
  slots: ShiftSlot[]; 
  providers: Provider[];
  conflicts: Conflict[];
}) {
  const dates = Array.from(new Set(slots.map(s => s.date))).sort();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header */}
        <div className="flex border-b border-slate-200">
          <div className="w-20 p-2 bg-slate-50 text-xs font-bold text-slate-500">Time</div>
          {dates.map(date => (
            <div key={date} className="flex-1 p-2 bg-slate-50 text-xs font-bold text-slate-700 text-center border-l border-slate-200">
              {format(parseISO(date), "EEE M/d")}
            </div>
          ))}
        </div>

        {/* Timeline Rows */}
        {hours.map(hour => (
          <div key={hour} className="flex border-b border-slate-100">
            <div className="w-20 p-2 text-[10px] text-slate-400 flex items-center">
              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
            </div>
            {dates.map(date => {
              const slot = slots.find(s => s.date === date && (
                (s.type === "NIGHT" && hour >= 19) || 
                (s.type === "NIGHT" && hour < 7) ||
                (s.type === "DAY" && hour >= 7 && hour < 19)
              ));
              
              if (!slot) return <div key={`${date}-${hour}`} className="flex-1 border-l border-slate-100" />;
              
              const provider = providers.find(p => p.id === slot.providerId);
              const hasConflict = conflicts.some(c => c.slotId === slot.id && !c.resolvedAt);
              const config = shiftConfig[slot.type];

              return (
                <div key={`${date}-${hour}`} className={`flex-1 border-l border-slate-100 p-1 ${slot.providerId ? config.bgClass : ''}`}>
                  {slot.providerId && provider && (
                    <div className="flex items-center gap-1">
                      <ProviderAvatar provider={provider} size="sm" showConflict={hasConflict} />
                      <span className="text-[10px] truncate">{provider.name.split(" ")[0]}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EnhancedCalendar() {
  const { slots, providers, conflicts, setSelectedDate, setSelectedProviderId } = useScheduleStore();
  const { scheduleViewport, weekDates } = useScheduleViewport();
  
  // Inline suggestions state
  const [selectedSlot, setSelectedSlot] = useState<ShiftSlot | null>(null);
  const [suggestionsPosition, setSuggestionsPosition] = useState({ x: 0, y: 0 });
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter slots for current week
  const weekSlots = useMemo(() => {
    const dateStrs = weekDates.map(d => format(d, "yyyy-MM-dd"));
    return slots.filter(s => {
      if (!dateStrs.includes(s.date)) return false;
      if (scheduleViewport.shiftTypeFilter !== "all" && s.type !== scheduleViewport.shiftTypeFilter) return false;
      if (scheduleViewport.showConflictsOnly) {
        return conflicts.some(c => c.slotId === s.id && !c.resolvedAt);
      }
      if (scheduleViewport.showUnfilledOnly && s.providerId) return false;
      if (scheduleViewport.providerSearchTerm) {
        const provider = providers.find((p) => p.id === s.providerId);
        if (!provider) return false;
        return provider.name.toLowerCase().includes(scheduleViewport.providerSearchTerm.toLowerCase());
      }
      return true;
    });
  }, [slots, weekDates, scheduleViewport.shiftTypeFilter, scheduleViewport.showConflictsOnly, scheduleViewport.showUnfilledOnly, scheduleViewport.providerSearchTerm, conflicts, providers]);

  const datesWithSlots = useMemo(() => {
    return weekDates.filter(date => 
      weekSlots.some(s => s.date === format(date, "yyyy-MM-dd"))
    );
  }, [weekDates, weekSlots]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="satin-panel bg-white/60 rounded-[2rem] border border-slate-200/40 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-primary/5 rounded-2xl text-primary">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-serif text-slate-900">Calendar</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                {weekSlots.length} shifts this week
              </p>
            </div>
          </div>

          {/* AI Assistant Button */}
          <button
            onClick={() => useScheduleStore.getState().toggleCopilot()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:shadow-lg hover:scale-105 transition-all"
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-3">Calendar filters and week controls are managed from the shared schedule toolbar above.</p>
      </div>

      {/* Calendar Content */}
      <div className="p-6 overflow-auto max-h-[calc(100vh-350px)]">
        {scheduleViewport.calendarPresentationMode === "timeline" ? (
          <TimelineView slots={weekSlots} providers={providers} conflicts={conflicts} />
        ) : (
          <div className="space-y-6">
            {datesWithSlots.map((date, idx) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const daySlots = weekSlots.filter(s => s.date === dateStr);
              const isWeekendDay = isWeekend(date);
              const isTodayDay = isToday(date);

              return (
                <motion.div
                  key={dateStr}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  {/* Date Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg ${
                      isTodayDay 
                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg' 
                        : isWeekendDay 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-slate-100 text-slate-700'
                    }`}>
                      {format(date, "d")}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">
                        {format(date, "EEEE, MMMM d")}
                      </h3>
                      {(isTodayDay || isWeekendDay) && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          isTodayDay ? 'text-primary' : 'text-amber-600'
                        }`}>
                          {isTodayDay && 'Today'}
                          {isTodayDay && isWeekendDay && ' • '}
                          {isWeekendDay && 'Weekend'}
                        </span>
                      )}
                    </div>
                    <div className="ml-auto text-xs text-slate-400">
                      {daySlots.filter(s => s.providerId).length} / {daySlots.length} filled
                    </div>
                  </div>

                  {/* Slots */}
                  <div className={scheduleViewport.calendarPresentationMode === "grid" 
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" 
                    : "space-y-2"
                  }>
                    {daySlots.map((slot) => {
                      const provider = providers.find(p => p.id === slot.providerId);
                      const hasConflict = conflicts.some(c => c.slotId === slot.id && !c.resolvedAt);
                      
                      return (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          provider={provider}
                          hasConflict={hasConflict}
                          viewMode={scheduleViewport.calendarPresentationMode}
                          onClick={(e, slot, provider) => {
                            e.stopPropagation();
                            setSelectedDate(slot.date);
                            setSelectedProviderId(provider?.id || null);
                            setSelectedSlot(slot);
                            setSuggestionsPosition({ x: e.clientX, y: e.clientY });
                            setShowSuggestions(true);
                          }}
                        />
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inline AI Suggestions */}
      {selectedSlot && (
        <InlineSuggestions
          slot={selectedSlot}
          provider={providers.find(p => p.id === selectedSlot.providerId)}
          isOpen={showSuggestions}
          onClose={() => {
            setShowSuggestions(false);
            setSelectedSlot(null);
          }}
          position={suggestionsPosition}
        />
      )}
    </motion.div>
  );
}

export function DraggableProvider({ id, name }: { id: string; name: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `provider-drag-${id}`,
    data: { providerId: id }
  });

  return (
    <motion.div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 50 : undefined
      }}
      {...listeners}
      {...attributes}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`flex items-center gap-2 group cursor-grab active:cursor-grabbing font-medium
        ${isDragging ? 'opacity-50' : 'hover:text-blue-600'} transition-colors`}
    >
      <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
      <span className="truncate">{name}</span>
    </motion.div>
  );
}
