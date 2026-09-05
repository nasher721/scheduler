import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminReadinessBanner } from '@/components/schedule/AdminReadinessBanner';
import { ImportPreviewDialog } from '@/components/schedule/ImportPreviewDialog';
import type { ScheduleReadiness } from '@/components/schedule/useScheduleReadiness';
import type { ImportPreviewResult } from '@/lib/excelUtils';
import { generateInitialSlots, useScheduleStore } from '@/store';
import { buildAuthoritativeMetrics } from '@/lib/scheduleRisk';

const readiness: ScheduleReadiness = {
  assigned: 75, totalSlots: 100, coverage: 75, criticalUnfilled: 5,
  skillMismatchRisk: 0, fatigueExposure: 0, alertCount: 5, hasSetupData: true,
  severity: 'warning', statusLabel: 'Review recommended', syncLabel: 'Saved on this device · cloud unavailable', syncSeverity: 'warning', isOnline: true,
};
const preview: ImportPreviewResult = {
  fileName: 'schedule.xlsx', totalRows: 1, validRows: 1, invalidRows: 0,
  requiresMapping: false, availableHeaders: ['Date', 'G20'], mapping: { date: 'Date', dayG20: 'G20' },
  issues: [], rows: [{ date: '2026-09-07', assignments: { dayG20: ['Dr. Patel'] }, issues: [] }],
};

describe('Scheduling workspace', () => {
  it('clears filters without moving the planning window or selected calendar date', () => {
    const state = useScheduleStore.getState();
    useScheduleStore.setState({ startDate: '2027-02-03', numWeeks: 12, scheduleViewport: { ...state.scheduleViewport, currentWeekOffset: 3.5, providerSearchTerm: 'Chen', shiftTypeFilter: 'NIGHT', showConflictsOnly: true, showUnfilledOnly: true } });
    useScheduleStore.getState().resetScheduleViewportFilters();
    const after = useScheduleStore.getState();
    expect(after.startDate).toBe('2027-02-03');
    expect(after.numWeeks).toBe(12);
    expect(after.scheduleViewport).toMatchObject({ currentWeekOffset: 3.5, providerSearchTerm: '', shiftTypeFilter: 'all', showConflictsOnly: false, showUnfilledOnly: false });
  });

  it('excludes vacation placeholders from coverage totals and staffing gaps', () => {
    const slots = generateInitialSlots('2026-09-07', 1);
    const staffing = slots.filter((slot) => slot.type !== 'VACATION');
    const metrics = buildAuthoritativeMetrics(slots, []);
    expect(slots.length).toBeGreaterThan(staffing.length);
    expect(metrics.totalSlots).toBe(staffing.length);
    expect(metrics.unfilledSlots).toBe(staffing.length);
    expect(metrics.criticalUnfilledSlots.every((slot) => slot.type !== 'VACATION')).toBe(true);
  });

  it('exposes coverage and opens the actionable gap or risk views', () => {
    const onViewAlerts = vi.fn();
    const onViewOpenShifts = vi.fn();
    render(<AdminReadinessBanner readiness={readiness} onViewAlerts={onViewAlerts} onViewOpenShifts={onViewOpenShifts} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
    expect(screen.getByRole('status')).toHaveTextContent('cloud unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'View 25 open shifts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review 5 scheduling alerts' }));
    expect(onViewOpenShifts).toHaveBeenCalledOnce();
    expect(onViewAlerts).toHaveBeenCalledOnce();
  });

  it('requires revalidation after changing a workbook mapping', () => {
    render(<ImportPreviewDialog preview={preview} mapping={{ ...preview.mapping, dayG20: '' }} busy={false} onMappingChange={vi.fn()} onValidate={vi.fn()} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Apply import' })).toBeDisabled();
    expect(screen.getByText(/Re-validate before applying/)).toBeVisible();
  });

  it('explains and blocks a date-only workbook before applying', () => {
    const dateOnly = { ...preview, availableHeaders: ['Date'], mapping: { date: 'Date' }, rows: [{ date: '2026-09-07', assignments: {}, issues: [] }] };
    render(<ImportPreviewDialog preview={dateOnly} mapping={dateOnly.mapping} busy={false} onMappingChange={vi.fn()} onValidate={vi.fn()} onApply={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Apply import' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Map at least one service');
  });

  it('blocks workbook errors, allows valid preview, and dismisses with Escape', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const props = { mapping: preview.mapping, busy: false, onMappingChange: vi.fn(), onValidate: vi.fn(), onApply, onClose };
    const { rerender } = render(<ImportPreviewDialog {...props} preview={{ ...preview, invalidRows: 1 }} />);
    expect(screen.getByRole('button', { name: 'Apply import' })).toBeDisabled();
    rerender(<ImportPreviewDialog {...props} preview={preview} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply import' }));
    expect(onApply).toHaveBeenCalledOnce();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
