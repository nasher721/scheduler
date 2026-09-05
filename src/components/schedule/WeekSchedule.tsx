import { useDroppable } from '@dnd-kit/core';
import { format, isToday } from 'date-fns';
import { AlertCircle, Plus } from 'lucide-react';
import type { Conflict, Provider, ShiftSlot } from '@/store';
import { cn } from '@/lib/utils';

function Assignment({ slot, names, conflict, onEdit }: { slot: ShiftSlot; names: string[]; conflict: boolean; onEdit: (slot: ShiftSlot) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: slot.id });
  const initials = names[0]?.replace(/^Dr\.?\s+/i, '').split(/\s+/).map((part) => part[0]).join('').slice(0, 2) || '';
  return (
    <button ref={setNodeRef} data-shift-type={slot.type} data-assigned={names.length > 0} data-conflict={conflict} type="button" onClick={() => onEdit(slot)} aria-label={`${slot.serviceLocation}, ${slot.date}: ${names.join(' and ') || 'Assign open shift'}${conflict ? ', conflict needs review' : ''}`} className={cn('workspace-assignment group flex min-h-11 w-full items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1', names.length ? 'border-primary/20 bg-primary/[0.07] text-foreground hover:border-primary/50' : 'border-dashed border-primary/50 bg-surface text-primary hover:bg-primary/5', isOver && 'ring-2 ring-primary ring-offset-1', conflict && 'border-error ring-1 ring-error/30')}>
      {names.length ? <span className="workspace-initials flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold uppercase text-primary" aria-hidden="true">{initials}</span> : <Plus className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
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
  const serviceSubtitle = (service: string) => service.toLowerCase().includes('night') || service === 'Nights' ? 'Overnight coverage' : service.toLowerCase().includes('jeopardy') ? 'Backup coverage' : service.toLowerCase().includes('consult') ? 'Consult service' : service.toLowerCase().includes('recovery') ? 'Post-call recovery' : service.toLowerCase().includes('vacation') ? 'Leave' : ['G20', 'H22', 'Akron'].includes(service) ? 'Critical care' : 'Scheduled service';
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 bg-surface shadow-sm" tabIndex={0} role="region" aria-label="Weekly schedule, scroll horizontally to see every day">
      <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
        <caption className="sr-only">Physician assignments by service and day</caption>
        <thead><tr className="border-b border-border/80"><th scope="col" className="sticky left-0 z-10 w-36 bg-surface px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-foreground-secondary">Service</th>{dates.map((date) => <th key={date.toISOString()} scope="col" className={cn('border-l border-border/70 py-3 text-center', [0, 6].includes(date.getDay()) && 'bg-secondary/20')}><span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-foreground-secondary">{format(date, 'EEE')}</span><span className={cn('mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold', isToday(date) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground')}>{format(date, 'd')}</span></th>)}</tr></thead>
        <tbody>{services.map((service) => <tr key={service} className="border-b border-border/70 last:border-b-0"><th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 text-left"><span className="flex items-center gap-2 font-bold"><span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />{service}</span><span className="mt-0.5 block pl-4 text-[10px] font-normal leading-relaxed text-foreground-muted">{serviceSubtitle(service)}</span></th>{dates.map((date) => {
          const key = `${service}:${format(date, 'yyyy-MM-dd')}`;
          const entries = byCell.get(key) || [];
          return <td key={key} className={cn('border-l border-border/70 p-2 align-top', [0, 6].includes(date.getDay()) && 'bg-secondary/10')}>{entries.length ? <div className="space-y-1.5">{entries.map((slot) => <Assignment key={slot.id} slot={slot} names={[slot.providerId, ...(slot.secondaryProviderIds || [])].filter((id): id is string => !!id).map((id) => providerById.get(id) || 'Unknown physician')} conflict={conflicted.has(slot.id)} onEdit={onEdit} />)}</div> : <span className="flex min-h-11 items-center justify-center text-foreground-muted" aria-label="No matching shift">—</span>}</td>;
        })}</tr>)}</tbody>
      </table>
    </div>
  );
}
