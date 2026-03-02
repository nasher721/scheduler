import { useScheduleStore, type ShiftType, type Provider } from "../store";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import { GripVertical } from 'lucide-react';
import { motion } from 'framer-motion';

function Slot({ id, type, provider }: { id: string, date: string, type: ShiftType, isWeekend: boolean, provider?: Provider }) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { slotId: id }
  });

  const label = type === 'DAY' ? 'Day Shift' : type === 'NIGHT' ? 'Night Shift' : type === 'NMET' ? 'NMET' : 'Jeopardy';

  const bgColor = isOver
    ? 'bg-blue-50 border-blue-400 border-2'
    : provider
      ? 'bg-white border-slate-200'
      : 'bg-slate-50/50 border-dashed border-slate-200';

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] rounded-xl p-3 flex flex-col gap-2 transition-all ${bgColor} border`}
    >
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
      {provider ? (
        <motion.div
          layoutId={`assigned-${id}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-blue-50 text-blue-700 text-sm font-medium py-1.5 px-3 rounded-lg border border-blue-100 flex items-center justify-between group"
        >
          {provider.name}
        </motion.div>
      ) : (
        <div className="text-sm text-slate-400 italic">Empty</div>
      )}
    </div>
  );
}

export function DraggableProvider({ id, name }: { id: string, name: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `provider-drag-${id}`,
    data: { providerId: id }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 group cursor-grab active:cursor-grabbing font-medium
        ${isDragging ? 'opacity-50' : 'hover:text-blue-600'}`}
    >
      <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
      {name}
    </div>
  );
}

export function Calendar() {
  const { slots, providers } = useScheduleStore();

  // Group slots by date
  const dates = Array.from(new Set(slots.map(s => s.date))).sort();

  return (
    <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col">
      <div className="overflow-x-auto p-6">
        <div className="min-w-[800px]">
          {dates.map((dateStr, idx) => {
            const daySlots = slots.filter(s => s.date === dateStr);
            const dateObj = parseISO(dateStr);
            const dayName = format(dateObj, 'EEEE');
            const isWeekend = daySlots[0]?.isWeekendLayout;

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={dateStr}
                className="mb-8 last:mb-0"
              >
                <div className="flex items-baseline gap-3 mb-4">
                  <h3 className="text-xl font-bold text-slate-800">{format(dateObj, 'MMM d, yyyy')}</h3>
                  <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${isWeekend ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {dayName}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {daySlots.map(slot => (
                    <Slot
                      key={slot.id}
                      id={slot.id}
                      date={slot.date}
                      type={slot.type}
                      isWeekend={slot.isWeekendLayout}
                      provider={providers.find(p => p.id === slot.providerId)}
                    />
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
