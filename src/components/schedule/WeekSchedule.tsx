import { useDroppable } from '@dnd-kit/core';
import { format, isToday } from 'date-fns';
import { AlertCircle, Plus, User } from 'lucide-react';
import type { Conflict, Provider, ShiftSlot } from '@/store';
import { cn } from '@/lib/utils';

function Assignment({ slot, names, conflict, onEdit }: { slot: ShiftSlot; names: string[]; conflict: boolean; onEdit: (slot: ShiftSlot) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id });
  return (
    <button ref={setNodeRef} type="button" onClick={() => onEdit(slot)} aria-label={`${slot.serviceLocation}, ${slot.date}: ${names.join(' and ') || 'Assign open shift'}${conflict ? ', conflict needs review' : ''}`} className={cn('flex min-h-11 w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors', names.length ? slot.type === 'NIGHT' ? 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100' : 'border-primary/20 bg-primary/[0.05] text-foreground hover:border-primary/50' : 'border-dashed border-primary/50 bg-surface text-primary hover:bg-primary/5', isOver && 'ring-2 ring-primary', conflict && 'border-error ring-1 ring-error/30')}>
      {names.length ? <User className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 break-words font-medium leading-snug">{names.join(' / ') || 'Assign'}</span>
      {conflict && <AlertCircle className="ml-auto h-4 w-4 shrink-0 text-error" aria-hidden="true" />}
    </button>
  );
}

export function WeekSchedule({ slots, providers, conflicts, dates, onEdit }: { slots: ShiftSlot[]; providers: Provider[]; conflicts: Conflict[]; dates: Date[]; onEdit: (slot: ShiftSlot) => void }) {
  const providerById = new Map(providers.map((provider) => [provider.id, provider.name]));
  const conflicted = new Set(conflicts.filter((conflict) => !conflict.resolvedAt).map((conflict) => conflict.slotId));
  const order = ['G20', 'H22', 'Akron', 'Consults', 'Nights', 'AMET', 'NMET', 'Jeopardy', 'Recovery', 'Vacation'];
  const services = Array.from(new Set(slots.map((slot) => slot.serviceLocation))).sort((a, b) => {
    const ai = order.indexOf(a); const bi = order.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.localeCompare(b);
  });
  const byCell = new Map<string, ShiftSlot[]>();
  for (const slot of slots) { const key = `${slot.serviceLocation}:${slot.date}`; byCell.set(key, [...(byCell.get(key) || []), slot]); }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface" tabIndex={0} role="region" aria-label="Weekly schedule, scroll horizontally to see every day">
      <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
        <caption className="sr-only">Physician assignments by service and day</caption>
        <thead><tr className="border-b border-border"><th scope="col" className="sticky left-0 z-10 w-28 bg-surface px-4 py-3 text-left text-xs font-medium uppercase text-foreground-secondary">Service</th>{dates.map((date) => <th key={date.toISOString()} scope="col" className="border-l border-border py-3 text-center"><span className="block text-xs font-medium uppercase text-foreground-secondary">{format(date, 'EEE')}</span><span className={cn('mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold', isToday(date) && 'bg-primary text-primary-foreground')}>{format(date, 'd')}</span></th>)}</tr></thead>
        <tbody>{services.map((service) => <tr key={service} className="border-b border-border last:border-b-0"><th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-semibold">{service}</th>{dates.map((date) => {
          const key = `${service}:${format(date, 'yyyy-MM-dd')}`;
          const entries = byCell.get(key) || [];
          return <td key={key} className="border-l border-border p-2 align-top">{entries.length ? <div className="space-y-1">{entries.map((slot) => <Assignment key={slot.id} slot={slot} names={[slot.providerId, ...(slot.secondaryProviderIds || [])].filter((id): id is string => !!id).map((id) => providerById.get(id) || 'Unknown physician')} conflict={conflicted.has(slot.id)} onEdit={onEdit} />)}</div> : <span className="flex min-h-11 items-center justify-center text-foreground-muted" aria-label="No matching shift">—</span>}</td>;
        })}</tr>)}</tbody>
      </table>
    </div>
  );
}
