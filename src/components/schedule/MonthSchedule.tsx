import { useEffect, useRef, useState } from 'react';
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { X } from 'lucide-react';
import type { Provider, ShiftSlot } from '@/store';
import { cn } from '@/lib/utils';

export function MonthSchedule({ slots, providers, anchor, onEdit }: { slots: ShiftSlot[]; providers: Provider[]; anchor: Date; onEdit: (slot: ShiftSlot) => void }) {
  const [day, setDay] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const names = new Map(providers.map((provider) => [provider.id, provider.name]));
  const dates = eachDayOfInterval({ start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }) });
  useEffect(() => {
    if (!day) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDay(null);
      if (event.key === 'Tab') {
        const buttons = dialog.current?.querySelectorAll('button');
        if (!buttons?.length) return;
        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
        if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [day]);
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border/80 bg-surface shadow-sm" tabIndex={0} role="region" aria-label="Monthly schedule">
        <div className="grid min-w-[700px] grid-cols-7">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, index) => <div key={label} className={cn('border-b border-border/80 py-3 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-foreground-secondary', index > 4 && 'bg-secondary/20')}>{label}</div>)}
          {dates.map((date) => {
            const iso = format(date, 'yyyy-MM-dd');
            const shifts = slots.filter((slot) => slot.date === iso);
            const assigned = shifts.filter((slot) => slot.providerId).length;
            return <button type="button" key={iso} onClick={() => setDay(iso)} aria-label={`${format(date, 'EEEE, MMMM d')}, ${assigned} of ${shifts.length} shifts assigned. View day roster`} className={cn('group min-h-40 border-b border-r border-border/70 p-3 text-left align-top transition-colors hover:bg-primary/5 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary', date.getDay() === 0 || date.getDay() === 6 ? 'bg-secondary/10' : 'bg-surface', !isSameMonth(date, anchor) && 'bg-secondary/30 text-foreground-secondary')}>
              <span className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-full text-base font-bold', isToday(date) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground group-hover:bg-primary/10')}>{format(date, 'd')}</span>
              {shifts.length > 0 ? <><span className="mb-2 block text-[11px] font-medium text-foreground-secondary">{assigned}/{shifts.length} assigned</span><span className="space-y-1.5">{shifts.slice(0, 2).map((slot) => <span key={slot.id} className={cn('block rounded-md border px-1.5 py-1 text-xs leading-snug', slot.type === 'NIGHT' ? 'border-violet-200/70 bg-violet-50/80 text-violet-950 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100' : 'border-primary/15 bg-primary/[0.06]')}><strong className="font-semibold">{slot.serviceLocation}</strong> · {slot.providerId ? names.get(slot.providerId) || 'Unknown physician' : 'Open'}</span>)}</span>{shifts.length > 2 && <span className="mt-1.5 block text-xs font-bold text-primary">+{shifts.length - 2} more</span>}</> : <span className="text-xs text-foreground-muted">No shifts</span>}
            </button>;
          })}
        </div>
      </div>
      {day && <div className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/40 p-4"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="month-roster-title" className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/80 bg-surface p-5 shadow-2xl"><div className="mb-4 flex items-center justify-between gap-3"><h3 id="month-roster-title" className="text-lg font-bold">{format(new Date(`${day}T12:00:00`), 'EEEE, MMMM d')}</h3><button type="button" onClick={() => setDay(null)} aria-label="Close day roster" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-secondary"><X className="h-5 w-5" /></button></div><p className="mb-3 text-sm text-foreground-secondary">Select a service to edit its assignment.</p><div className="space-y-2">{slots.filter((slot) => slot.date === day).map((slot) => <button key={slot.id} type="button" onClick={() => { setDay(null); onEdit(slot); }} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-border/80 p-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="font-semibold">{slot.serviceLocation}</span><span>{slot.providerId ? names.get(slot.providerId) || 'Unknown physician' : 'Assign open shift'}</span></button>)}{!slots.some((slot) => slot.date === day) && <p className="py-4 text-sm text-foreground-secondary">No shifts scheduled for this day.</p>}</div></div></div>}
    </>
  );
}
