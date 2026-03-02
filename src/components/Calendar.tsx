import { useScheduleStore, type ShiftType, type Provider } from "../store";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { format, parseISO, isToday } from "date-fns";
import { GripVertical, Sun, Moon, AlertTriangle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const shiftConfig: Record<ShiftType, { label: string; icon: React.ReactNode; colorClass: string; bgClass: string }> = {
  DAY: { 
    label: 'Day Shift', 
    icon: <Sun className="w-3.5 h-3.5" />, 
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50 border-emerald-200'
  },
  NIGHT: { 
    label: 'Night Shift', 
    icon: <Moon className="w-3.5 h-3.5" />, 
    colorClass: 'text-indigo-600',
    bgClass: 'bg-indigo-50 border-indigo-200'
  },
  NMET: { 
    label: 'NMET', 
    icon: <Sparkles className="w-3.5 h-3.5" />, 
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50 border-amber-200'
  },
  JEOPARDY: { 
    label: 'Jeopardy', 
    icon: <AlertTriangle className="w-3.5 h-3.5" />, 
    colorClass: 'text-rose-600',
    bgClass: 'bg-rose-50 border-rose-200'
  },
};

function Slot({ id, type, provider, priority }: { id: string; type: ShiftType; provider?: Provider; priority?: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { slotId: id }
  });

  const config = shiftConfig[type];

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={`shift-slot shift-slot-${type.toLowerCase()} ${isOver ? 'dragging-over' : ''}`}
    >
      {/* Shift Type Header */}
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${config.colorClass}`}>
          {config.icon}
          <span className="uppercase tracking-wider">{config.label}</span>
        </div>
        {priority === 'CRITICAL' && !provider && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 uppercase">
            Critical
          </span>
        )}
      </div>

      {/* Provider or Empty State */}
      {provider ? (
        <motion.div
          layoutId={`assigned-${id}`}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-xl border border-slate-200/60 shadow-sm"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
            {provider.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-slate-700 truncate">{provider.name}</span>
        </motion.div>
      ) : (
        <div className="flex items-center justify-center h-10 rounded-lg border-2 border-dashed border-slate-200/80">
          <span className="text-xs text-slate-400 font-medium">Drop provider here</span>
        </div>
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

export function Calendar() {
  const { slots, providers } = useScheduleStore();

  // Group slots by date
  const dates = Array.from(new Set(slots.map(s => s.date))).sort();

  return (
    <div className="flex-1 glass-panel-heavy overflow-hidden flex flex-col">
      <div className="overflow-x-auto p-6 scrollbar-hide">
        <div className="min-w-[800px] space-y-6">
          {dates.map((dateStr, idx) => {
            const daySlots = slots.filter(s => s.date === dateStr);
            const dateObj = parseISO(dateStr);
            const dayName = format(dateObj, 'EEEE');
            const isWeekend = daySlots[0]?.isWeekendLayout;
            const today = isToday(dateObj);

            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                key={dateStr}
                className="group/date"
              >
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-4 sticky top-0 z-10 py-2 bg-gradient-to-r from-white/90 via-white/95 to-transparent backdrop-blur-sm -mx-2 px-2">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg transition-all ${
                    today 
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25' 
                      : isWeekend 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-slate-100 text-slate-700'
                  }`}>
                    {format(dateObj, 'd')}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{format(dateObj, 'MMMM d, yyyy')}</h3>
                    <span className={`text-xs font-medium ${isWeekend ? 'text-amber-600' : 'text-slate-500'}`}>
                      {dayName}
                      {isWeekend && ' • Weekend'}
                      {today && ' • Today'}
                    </span>
                  </div>
                </div>

                {/* Slots Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                  {daySlots.map((slot, slotIdx) => (
                    <motion.div
                      key={slot.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 + slotIdx * 0.02 }}
                    >
                      <Slot
                        id={slot.id}
                        type={slot.type}
                        priority={slot.priority}
                        provider={providers.find(p => p.id === slot.providerId)}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
