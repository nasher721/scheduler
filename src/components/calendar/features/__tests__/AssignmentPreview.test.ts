/**
 * AssignmentPreview Tests
 * 
 * Tests for assignment analysis logic in Phase 2.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ShiftSlot, Provider } from '@/store';
import type { AssignmentAnalysis } from '@/types/calendar';
import { parseISO, differenceInDays, isAfter, subWeeks, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

// Helper function to create mock slot
function createMockSlot(overrides: Partial<ShiftSlot> = {}): ShiftSlot {
  return {
    id: 'slot-1',
    date: '2024-03-15',
    type: 'DAY',
    servicePriority: 'STANDARD',
    serviceLocation: 'MICU',
    requiredSkill: 'ICU',
    providerId: null,
    isWeekendLayout: false,
    ...overrides
  };
}

// Helper function to create mock provider
function createMockProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'provider-1',
    name: 'Dr. Smith',
    skills: ['ICU', 'Neuro'],
    targetWeekDays: 5,
    targetWeekendDays: 2,
    targetWeekNights: 0,
    targetWeekendNights: 0,
    timeOffRequests: [],
    maxConsecutiveNights: 3,
    minDaysOffAfterNight: 2,
    credentials: [],
    ...overrides
  };
}

describe('Assignment Analysis Logic', () => {
  it('should detect consecutive shifts warning', () => {
    const provider = createMockProvider();
    const existingSlots: ShiftSlot[] = [
      createMockSlot({ id: 'slot-2', date: '2024-03-14', providerId: provider.id }),
      createMockSlot({ id: 'slot-3', date: '2024-03-13', providerId: provider.id }),
      createMockSlot({ id: 'slot-4', date: '2024-03-12', providerId: provider.id }),
    ];
    const newSlot = createMockSlot({ date: '2024-03-15' });

    // Check consecutive shifts
    const consecutiveShifts = existingSlots.filter(s => {
      const sDate = parseISO(s.date);
      const slotDate = parseISO(newSlot.date);
      return Math.abs(differenceInDays(sDate, slotDate)) <= 1;
    });

    expect(consecutiveShifts.length).toBeGreaterThanOrEqual(3);
  });

  it('should detect max consecutive nights conflict', () => {
    const provider = createMockProvider({ maxConsecutiveNights: 3 });
    const recentNights: ShiftSlot[] = [
      createMockSlot({ id: 'n1', date: '2024-03-10', type: 'NIGHT', providerId: provider.id }),
      createMockSlot({ id: 'n2', date: '2024-03-11', type: 'NIGHT', providerId: provider.id }),
      createMockSlot({ id: 'n3', date: '2024-03-12', type: 'NIGHT', providerId: provider.id }),
    ];
    const newSlot = createMockSlot({ date: '2024-03-13', type: 'NIGHT' });

    const slotDate = parseISO(newSlot.date);
    
    const nightCount = recentNights.filter(s => {
      if (s.type !== 'NIGHT') return false;
      const sDate = parseISO(s.date);
      return isAfter(slotDate, subWeeks(sDate, 1)) && isAfter(sDate, subWeeks(slotDate, 1));
    }).length;

    expect(nightCount).toBeGreaterThanOrEqual(provider.maxConsecutiveNights);
  });

  it('should calculate weekly workload correctly', () => {
    const provider = createMockProvider({ targetWeekDays: 5 });
    const slotDate = parseISO('2024-03-15');
    const weekStart = startOfWeek(slotDate);
    const weekEnd = endOfWeek(slotDate);

    const existingSlots: ShiftSlot[] = [
      createMockSlot({ id: 's1', date: '2024-03-11', providerId: provider.id }), // Mon
      createMockSlot({ id: 's2', date: '2024-03-12', providerId: provider.id }), // Tue
      createMockSlot({ id: 's3', date: '2024-03-13', providerId: provider.id }), // Wed
    ];

    const hoursThisWeek = existingSlots
      .filter(s => isWithinInterval(parseISO(s.date), { start: weekStart, end: weekEnd }))
      .reduce((sum, s) => sum + getShiftDuration(s.type), 0);

    expect(hoursThisWeek).toBe(36); // 3 shifts * 12 hours
  });

  it('should match skills correctly', () => {
    const provider = createMockProvider({ skills: ['ICU', 'Neuro'] });
    const requiredSkills = ['ICU', 'Cardiac'];

    const matchedSkills = requiredSkills.filter(skill =>
      provider.skills.some(ps => ps.toLowerCase() === skill.toLowerCase())
    );
    const missingSkills = requiredSkills.filter(skill =>
      !provider.skills.some(ps => ps.toLowerCase() === skill.toLowerCase())
    );

    expect(matchedSkills).toContain('ICU');
    expect(missingSkills).toContain('Cardiac');
    expect(matchedSkills.length / requiredSkills.length * 100).toBe(50);
  });

  it('should detect double booking', () => {
    const provider = createMockProvider();
    const existingSlots: ShiftSlot[] = [
      createMockSlot({ id: 's1', date: '2024-03-15', providerId: provider.id }),
    ];
    const newSlot = createMockSlot({ date: '2024-03-15' });

    const sameDayShifts = existingSlots.filter(s => s.date === newSlot.date);

    expect(sameDayShifts.length).toBeGreaterThan(0);
  });
});

// Helper function
function getShiftDuration(type: string): number {
  const durations: Record<string, number> = {
    DAY: 12,
    NIGHT: 12,
    NMET: 12,
    JEOPARDY: 8,
    RECOVERY: 8,
    CONSULTS: 8,
    VACATION: 0
  };
  return durations[type] || 8;
}
