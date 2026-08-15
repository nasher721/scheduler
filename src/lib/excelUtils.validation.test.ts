import { describe, it, expect } from 'vitest';
import { normalizeDate, normalizeHeader, resolveHeaderMapping } from './excelUtils.ts';

describe('excelUtils validation', () => {
  it('normalizes header variants', () => {
    expect(normalizeHeader(' Provider Name  ')).toBe('provider name');
  });

  it('detects malformed dates', () => {
    expect(normalizeDate('not-a-date')).toBe(null);
    expect(normalizeDate('2026-01-09')).toBe('2026-01-09');
  });

  it('flags ambiguous header mappings', () => {
    const { issues } = resolveHeaderMapping(['Date', 'Nights', 'Night']);
    expect(issues.some((issue) => issue.code === 'AMBIGUOUS_HEADER')).toBe(true);
  });
});
