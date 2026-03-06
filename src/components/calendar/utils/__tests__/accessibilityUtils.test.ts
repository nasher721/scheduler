/**
 * Accessibility Utilities Tests
 * 
 * Unit tests for accessibility helper functions.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateShiftAriaLabel,
  formatShiftType,
  formatPriority,
  getContrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA
} from '../accessibilityUtils';
import type { ShiftSlot, Provider } from '@/store';

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn(() => 'January 1st'),
  parseISO: vi.fn((date: string) => new Date(date))
}));

describe('generateShiftAriaLabel', () => {
  const mockSlot: ShiftSlot = {
    id: '1',
    date: '2024-01-01',
    type: 'DAY',
    servicePriority: 'STANDARD',
    serviceLocation: 'MICU',
    requiredSkill: 'ICU',
    providerId: 'provider-1',
    isWeekendLayout: false,
    isBackup: false
  };

  const mockProvider: Provider = {
    id: 'provider-1',
    name: 'Dr. Smith',
    skills: ['ICU'],
    targetWeekDays: 5,
    targetWeekendDays: 2,
    targetWeekNights: 0,
    targetWeekendNights: 0,
    timeOffRequests: [],
    maxConsecutiveNights: 3,
    minDaysOffAfterNight: 2
  };

  it('should generate label for assigned shift', () => {
    const label = generateShiftAriaLabel(mockSlot, mockProvider);
    
    expect(label).toContain('Day shift');
    expect(label).toContain('at MICU');
    expect(label).toContain('assigned to Dr. Smith');
    expect(label).toContain('January 1st');
  });

  it('should indicate unassigned shifts', () => {
    const unassignedSlot = { ...mockSlot, providerId: null };
    const label = generateShiftAriaLabel(unassignedSlot);
    
    expect(label).toContain('unassigned');
  });

  it('should indicate critical priority', () => {
    const criticalSlot = { ...mockSlot, servicePriority: 'CRITICAL' };
    const label = generateShiftAriaLabel(criticalSlot, mockProvider);
    
    expect(label).toContain('critical priority');
  });

  it('should indicate backup assignment', () => {
    const backupSlot = { ...mockSlot, isBackup: true };
    const label = generateShiftAriaLabel(backupSlot, mockProvider);
    
    expect(label).toContain('backup assignment');
  });
});

describe('formatShiftType', () => {
  it('should format all shift types correctly', () => {
    expect(formatShiftType('DAY')).toBe('Day');
    expect(formatShiftType('NIGHT')).toBe('Night');
    expect(formatShiftType('NMET')).toBe('NMET');
    expect(formatShiftType('JEOPARDY')).toBe('Jeopardy');
    expect(formatShiftType('RECOVERY')).toBe('Recovery');
    expect(formatShiftType('CONSULTS')).toBe('Consults');
    expect(formatShiftType('VACATION')).toBe('Vacation');
  });

  it('should return the input for unknown types', () => {
    expect(formatShiftType('UNKNOWN' as any)).toBe('UNKNOWN');
  });
});

describe('formatPriority', () => {
  it('should format all priority levels correctly', () => {
    expect(formatPriority('CRITICAL')).toBe('Critical');
    expect(formatPriority('STANDARD')).toBe('Standard');
    expect(formatPriority('FLEXIBLE')).toBe('Flexible');
  });

  it('should return the input for unknown priorities', () => {
    expect(formatPriority('UNKNOWN' as any)).toBe('UNKNOWN');
  });
});

describe('getContrastRatio', () => {
  it('should calculate contrast ratio for black and white', () => {
    const ratio = getContrastRatio('#000000', '#FFFFFF');
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('should calculate contrast ratio for same colors', () => {
    const ratio = getContrastRatio('#FFFFFF', '#FFFFFF');
    expect(ratio).toBe(1);
  });

  it('should calculate contrast ratio for hex colors', () => {
    const ratio = getContrastRatio('#FF0000', '#FFFFFF');
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(6);
  });

  it('should calculate contrast ratio for rgb colors', () => {
    const ratio = getContrastRatio('rgb(0,0,0)', 'rgb(255,255,255)');
    expect(ratio).toBeCloseTo(21, 0);
  });
});

describe('meetsWCAGAA', () => {
  it('should pass for black on white', () => {
    expect(meetsWCAGAA('#000000', '#FFFFFF')).toBe(true);
  });

  it('should fail for light gray on white', () => {
    expect(meetsWCAGAA('#CCCCCC', '#FFFFFF')).toBe(false);
  });

  it('should have lower threshold for large text', () => {
    // Light gray passes for large text but not normal text
    const isLargeTextPass = meetsWCAGAA('#CCCCCC', '#FFFFFF', true);
    const isNormalTextPass = meetsWCAGAA('#CCCCCC', '#FFFFFF', false);
    
    expect(isLargeTextPass).toBe(true);
    expect(isNormalTextPass).toBe(false);
  });
});

describe('meetsWCAGAAA', () => {
  it('should pass for black on white', () => {
    expect(meetsWCAGAAA('#000000', '#FFFFFF')).toBe(true);
  });

  it('should have stricter requirements than AA', () => {
    const aaPasses = meetsWCAGAA('#666666', '#FFFFFF');
    const aaaPasses = meetsWCAGAAA('#666666', '#FFFFFF');
    
    expect(aaPasses).toBe(true);
    expect(aaaPasses).toBe(false);
  });
});
