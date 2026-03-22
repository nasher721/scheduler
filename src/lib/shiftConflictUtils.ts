import type { Conflict, ConflictSeverity, ShiftSlot } from "../store";

export function getUnresolvedConflictsForSlot(slotId: string, conflicts: Conflict[]): Conflict[] {
  return conflicts.filter((c) => c.slotId === slotId && !c.resolvedAt);
}

export function isCriticalUnfilledSlot(slot: ShiftSlot): boolean {
  return slot.servicePriority === "CRITICAL" && !slot.providerId;
}

/** When true, shift click should open the issues drawer first (not the edit modal). */
export function shouldOpenIssuesDrawerFirst(slot: ShiftSlot, conflicts: Conflict[]): boolean {
  if (getUnresolvedConflictsForSlot(slot.id, conflicts).length > 0) return true;
  if (isCriticalUnfilledSlot(slot)) return true;
  return false;
}

export type ShiftIssueMarkers = {
  hasUnresolvedConflict: boolean;
  maxSeverity: ConflictSeverity | null;
  /** Critical priority shift with no provider and no UNFILLED_CRITICAL conflict row — show synthetic gap treatment. */
  isCriticalCoverageGap: boolean;
};

export function getShiftIssueMarkers(slot: ShiftSlot, conflicts: Conflict[]): ShiftIssueMarkers {
  const unresolved = getUnresolvedConflictsForSlot(slot.id, conflicts);
  const severityOrder: ConflictSeverity[] = ["CRITICAL", "WARNING", "INFO"];
  let maxSeverity: ConflictSeverity | null = null;
  for (const sev of severityOrder) {
    if (unresolved.some((c) => c.severity === sev)) {
      maxSeverity = sev;
      break;
    }
  }
  const hasUnfilledCriticalRow = unresolved.some((c) => c.type === "UNFILLED_CRITICAL");
  const isCriticalCoverageGap = isCriticalUnfilledSlot(slot) && !hasUnfilledCriticalRow;
  return {
    hasUnresolvedConflict: unresolved.length > 0,
    maxSeverity,
    isCriticalCoverageGap,
  };
}

/** Month day cell: prefer a slot that should surface issues first, then by service priority. */
export function pickMonthDayRepresentativeSlot(daySlots: ShiftSlot[], conflicts: Conflict[]): ShiftSlot | null {
  if (daySlots.length === 0) return null;
  const scored = daySlots.map((slot) => {
    let score = 0;
    if (shouldOpenIssuesDrawerFirst(slot, conflicts)) score += 100;
    const priorityScore = { CRITICAL: 3, STANDARD: 2, FLEXIBLE: 1 }[slot.servicePriority];
    score += priorityScore;
    return { slot, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].slot;
}
