import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDate, normalizeHeader, resolveHeaderMapping } from './excelUtils.ts';

test('normalizes header variants', () => {
  assert.equal(normalizeHeader(' Provider Name  '), 'provider name');
});

test('detects malformed dates', () => {
  assert.equal(normalizeDate('not-a-date'), null);
  assert.equal(normalizeDate('2026-01-09'), '2026-01-09');
});

test('flags ambiguous header mappings', () => {
  const { issues } = resolveHeaderMapping(['Date', 'Nights', 'Night']);
  assert.equal(issues.some((issue) => issue.code === 'AMBIGUOUS_HEADER'), true);
});
