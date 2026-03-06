/**
 * useCalendarKeyboard Tests
 * 
 * Unit tests for the keyboard navigation hook.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarKeyboard } from '../useCalendarKeyboard';

// Mock the store
vi.mock('@/store', () => ({
  useScheduleStore: vi.fn(() => ({
    setCalendarPresentationMode: vi.fn(),
    shiftWeekOffset: vi.fn(),
    toggleCopilot: vi.fn(),
    scheduleViewport: {
      calendarPresentationMode: 'grid'
    }
  }))
}));

// Mock the announce hook
vi.mock('../useAnnounce', () => ({
  useAnnounce: vi.fn(() => ({
    announceViewChange: vi.fn(),
    announceNavigation: vi.fn()
  }))
}));

describe('useCalendarKeyboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all keyboard shortcuts', () => {
    const { result } = renderHook(() => useCalendarKeyboard());

    expect(result.current.shortcuts).toHaveLength(10);
    expect(result.current.shortcuts.map(s => s.key)).toContain('Ctrl + 1');
    expect(result.current.shortcuts.map(s => s.key)).toContain('Ctrl + 2');
    expect(result.current.shortcuts.map(s => s.key)).toContain('← / →');
    expect(result.current.shortcuts.map(s => s.key)).toContain('?');
  });

  it('should group shortcuts correctly', () => {
    const { result } = renderHook(() => useCalendarKeyboard());

    expect(result.current.groupedShortcuts.view).toHaveLength(6);
    expect(result.current.groupedShortcuts.navigation).toHaveLength(3);
    expect(result.current.groupedShortcuts.action).toHaveLength(3);
    expect(result.current.groupedShortcuts.help).toHaveLength(1);
  });

  it('should include shortcut group labels', () => {
    const { result } = renderHook(() => useCalendarKeyboard());

    expect(result.current.shortcutGroups.view).toBe('View Controls');
    expect(result.current.shortcutGroups.navigation).toBe('Navigation');
    expect(result.current.shortcutGroups.action).toBe('Actions');
    expect(result.current.shortcutGroups.help).toBe('Help');
  });

  it('should provide focus management functions', () => {
    const { result } = renderHook(() => useCalendarKeyboard());

    expect(typeof result.current.focusShift).toBe('function');
    expect(typeof result.current.focusNextShift).toBe('function');
    expect(typeof result.current.focusPreviousShift).toBe('function');
  });

  it('should provide scope management functions', () => {
    const { result } = renderHook(() => useCalendarKeyboard());

    expect(typeof result.current.enableScope).toBe('function');
    expect(typeof result.current.disableScope).toBe('function');
  });
});

describe('Keyboard shortcuts configuration', () => {
  it('should have unique shortcut keys', () => {
    const { result } = renderHook(() => useCalendarKeyboard());
    const keys = result.current.shortcuts.map(s => s.key);
    const uniqueKeys = [...new Set(keys)];
    
    expect(keys).toHaveLength(uniqueKeys.length);
  });

  it('should have descriptions for all shortcuts', () => {
    const { result } = renderHook(() => useCalendarKeyboard());
    
    result.current.shortcuts.forEach(shortcut => {
      expect(shortcut.description).toBeTruthy();
      expect(shortcut.description.length).toBeGreaterThan(0);
    });
  });

  it('should include all view shortcuts (Ctrl+1 through Ctrl+6)', () => {
    const { result } = renderHook(() => useCalendarKeyboard());
    const viewKeys = result.current.groupedShortcuts.view.map(s => s.key);
    
    for (let i = 1; i <= 6; i++) {
      expect(viewKeys).toContain(`Ctrl + ${i}`);
    }
  });
});
