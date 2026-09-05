import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { applyScheduleImport, excelSerialToDate, normalizeDate, normalizeHeader, parseProviderCell, resolveHeaderMapping, rollbackLastImport } from './excelUtils.ts';
import { generateInitialSlots, useScheduleStore, type Provider } from '../store.ts';
import { exportScheduleToExcel } from './excelUtils.ts';

describe('excelUtils validation', () => {
  it('normalizes header variants', () => {
    expect(normalizeHeader(' Provider Name  ')).toBe('provider name');
  });

  it('detects malformed dates', () => {
    expect(normalizeDate('not-a-date')).toBe(null);
    expect(normalizeDate('2026-01-09')).toBe('2026-01-09');
    expect(normalizeDate('2026-02-31')).toBe(null);
    expect(normalizeDate('02/30/2026')).toBe(null);
    expect(normalizeDate('01/09/2026')).toBe('2026-01-09');
  });

  it('deduplicates repeated normalized providers in shared cells', () => {
    expect(parseProviderCell('Dr. Avery Chen & Dr. Avery Chen')?.providers).toEqual(['Avery Chen']);
    expect(parseProviderCell('Dr. Avery Chen / Dr. Jordan Lee')?.providers).toEqual(['Avery Chen', 'Jordan Lee']);
  });

  it('round-trips Excel serial dates without timezone drift', () => {
    expect(excelSerialToDate(46031)).toBe('2026-01-09');
    expect(excelSerialToDate(46031.75)).toBe('2026-01-09');
    expect(excelSerialToDate(Number.POSITIVE_INFINITY)).toBe(null);
  });

  it('flags ambiguous header mappings', () => {
    const { issues } = resolveHeaderMapping(['Date', 'Nights', 'Night']);
    expect(issues.some((issue) => issue.code === 'AMBIGUOUS_HEADER')).toBe(true);
  });

  it('rejects previews with blocking validation errors before changing the store', () => {
    const result = applyScheduleImport({
      fileName: 'broken.xlsx',
      totalRows: 1,
      validRows: 0,
      invalidRows: 1,
      requiresMapping: true,
      availableHeaders: ['Date'],
      mapping: { date: 'Date' },
      issues: [{ type: 'error', code: 'INVALID_DATE', message: 'bad date' }],
      rows: [{ date: '', assignments: {}, issues: [{ type: 'error', code: 'INVALID_DATE', message: 'bad date' }] }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('IMPORT_APPLY_FAILED');
  });

  it('exports a workbook that preserves clinical assignments on re-import', async () => {
    const provider: Provider = {
      id: 'provider-a', name: 'Dr. Avery Chen', notes: '=1+1', targetWeekDays: 10, targetWeekendDays: 4,
      targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [{ date: '2026-01-09', type: 'PTO' }],
      preferredDates: [], skills: ['NEURO_CRITICAL'], maxConsecutiveNights: 2, minDaysOffAfterNight: 1,
    };
    const secondProvider: Provider = { ...provider, id: 'provider-b', name: 'Dr. Jordan Lee', timeOffRequests: [] };
    const slots = generateInitialSlots('2026-01-05', 1);
    const assign = (location: string, providerId: string, secondaryProviderIds?: string[]) => {
      const slot = slots.find((entry) => entry.date === '2026-01-09' && entry.serviceLocation === location);
      if (!slot) throw new Error(`Missing ${location} test slot`);
      slot.providerId = providerId;
      slot.secondaryProviderIds = secondaryProviderIds;
      slot.isSharedAssignment = Boolean(secondaryProviderIds?.length);
    };
    assign('AMET', provider.id);
    assign('NMET', secondProvider.id);
    assign('Recovery', provider.id);
    assign('Nights', provider.id, [secondProvider.id]);
    useScheduleStore.setState({ providers: [provider, secondProvider], slots, startDate: '2026-01-05' });

    let exportedBlob: Blob | null = null;
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    window.URL.createObjectURL = ((blob: Blob) => { exportedBlob = blob; return 'blob:test'; }) as typeof window.URL.createObjectURL;
    window.URL.revokeObjectURL = (() => undefined) as typeof window.URL.revokeObjectURL;
    HTMLAnchorElement.prototype.click = (() => undefined);
    try {
      expect((await exportScheduleToExcel()).success).toBe(true);
      expect(exportedBlob).toBeTruthy();
      const workbook = XLSX.read(await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(exportedBlob!);
      }), { type: 'array', cellDates: true });
      expect(workbook.Sheets['Staff 2026 #s']?.L2?.f).toBe("COUNTIF('2026 Sch'!I:I,A2)");
      expect(workbook.Sheets['Staff 2026 #s']?.E2?.f).toContain('IFERROR(WEEKDAY(');
      expect(workbook.Sheets['Staff 2026 #s']?.S2).toMatchObject({ t: 's', v: '=1+1' });
      expect(workbook.Sheets['Staff 2026 #s']?.S2?.f).toBeUndefined();
      const fteFormulaCells = Object.values(workbook.Sheets['Staff 2026 #s'] ?? {}).filter((cell) => cell && typeof cell === 'object' && 'f' in cell) as Array<{ f?: string }>;
      expect(fteFormulaCells.length).toBeGreaterThan(0);
      expect(fteFormulaCells.every((cell) => typeof cell.f === 'string' && !cell.f.includes(',WEEKDAY('))).toBe(true);
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets['2026 Sch'], { defval: '' });
      const dateRow = rows.find((row) => normalizeDate(row['Month '] ?? row.Month) === '2026-01-09');
      const value = (name: string) => dateRow?.[name] ?? dateRow?.[`${name} `];
      expect(value('AMET')).toBe('Dr. Avery Chen');
      expect(value('NMET')).toBe('Dr. Jordan Lee');
      expect(value('Recovery')).toBe('Dr. Avery Chen');
      expect(value('Nights')).toBe('Dr. Avery Chen & Dr. Jordan Lee');
      expect(value('Vacations')).toBe('Dr. Avery Chen');
    } finally {
      window.URL.createObjectURL = originalCreateObjectURL;
      window.URL.revokeObjectURL = originalRevokeObjectURL;
      HTMLAnchorElement.prototype.click = originalAnchorClick;
    }
  });

  it('applies partial imports by date and service without clearing surrounding schedule', () => {
    const providerA: Provider = { id: 'a', name: 'Dr. Avery Chen', targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [], preferredDates: [], skills: ['NEURO_CRITICAL'], maxConsecutiveNights: 2, minDaysOffAfterNight: 1 };
    const providerB: Provider = { ...providerA, id: 'b', name: 'Dr. Jordan Lee' };
    const slots = generateInitialSlots('2026-01-05', 2);
    const target = slots.find((slot) => slot.date === '2026-01-09' && slot.serviceLocation === 'G20');
    const untouched = slots.find((slot) => slot.date === '2026-01-10' && slot.serviceLocation === 'G20');
    const sameDayOtherService = slots.find((slot) => slot.date === '2026-01-09' && slot.serviceLocation === 'H22');
    if (!target || !untouched || !sameDayOtherService) throw new Error('Missing generated test slots');
    untouched.providerId = providerB.id;
    sameDayOtherService.providerId = providerB.id;
    target.providerId = providerB.id;
    target.secondaryProviderIds = [providerA.id];
    target.isSharedAssignment = true;
    useScheduleStore.setState({ providers: [providerA, providerB], slots, startDate: '2026-01-05', numWeeks: 2 });
    const result = applyScheduleImport({ fileName: 'partial.xlsx', totalRows: 2, validRows: 2, invalidRows: 0, requiresMapping: false, availableHeaders: ['Date', 'G20'], mapping: { date: 'Date', dayG20: 'G20' }, issues: [], rows: [
      { date: '2026-01-09', assignments: { dayG20: ['Avery Chen'] }, issues: [] },
      { date: '2026-03-20', assignments: { dayG20: ['Jordan Lee'] }, issues: [] },
    ] });
    expect(result.success).toBe(true);
    expect(useScheduleStore.getState().providers).toHaveLength(2);
    expect(useScheduleStore.getState().slots.find((slot) => slot.id === target.id)?.providerId).toBe(providerA.id);
    expect(useScheduleStore.getState().slots.find((slot) => slot.id === untouched.id)?.providerId).toBe(providerB.id);
    expect(useScheduleStore.getState().slots.find((slot) => slot.id === sameDayOtherService.id)?.providerId).toBe(providerB.id);
    expect(useScheduleStore.getState().slots.find((slot) => slot.id === target.id)?.secondaryProviderIds).toEqual([]);
    expect(useScheduleStore.getState().slots.some((slot) => slot.date === '2026-03-20' && slot.serviceLocation === 'G20' && slot.providerId === providerB.id)).toBe(true);
    useScheduleStore.setState({ startDate: '2027-01-04', numWeeks: 4 });
    expect(rollbackLastImport()).toBe(true);
    expect(useScheduleStore.getState().startDate).toBe('2026-01-05');
    expect(useScheduleStore.getState().numWeeks).toBe(2);
    expect(useScheduleStore.getState().slots.find((slot) => slot.id === target.id)?.providerId).toBe(providerB.id);
    expect(useScheduleStore.getState().slots.find((slot) => slot.id === target.id)?.secondaryProviderIds).toEqual([providerA.id]);
  });

  it('rejects ambiguous normalized physician names without changing assignments', () => {
    const provider: Provider = { id: 'chen-a', name: 'Dr. Avery Chen', targetWeekDays: 10, targetWeekendDays: 4, targetWeekNights: 3, targetWeekendNights: 2, timeOffRequests: [], preferredDates: [], skills: ['NEURO_CRITICAL'], maxConsecutiveNights: 2, minDaysOffAfterNight: 1 };
    const providers = [provider, { ...provider, id: 'chen-b', name: 'Doctor Avery Chen' }];
    const slots = generateInitialSlots('2026-01-05', 1);
    useScheduleStore.setState({ providers, slots, startDate: '2026-01-05', numWeeks: 1 });
    const result = applyScheduleImport({ fileName: 'ambiguous.xlsx', totalRows: 1, validRows: 1, invalidRows: 0, requiresMapping: false, availableHeaders: ['Date', 'G20'], mapping: { date: 'Date', dayG20: 'G20' }, issues: [], rows: [{ date: '2026-01-05', assignments: { dayG20: ['Avery Chen'] }, issues: [] }] });
    expect(result.success).toBe(false);
    expect(useScheduleStore.getState().providers).toEqual(providers);
    expect(useScheduleStore.getState().slots).toEqual(slots);
  });
});
