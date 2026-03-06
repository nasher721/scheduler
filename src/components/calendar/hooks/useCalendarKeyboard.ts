/**
 * useCalendarKeyboard Hook
 * 
 * Provides keyboard navigation and shortcuts for the calendar interface.
 * Part of Phase 1: UX & Accessibility
 */

import { useHotkeys, useHotkeysContext } from 'react-hotkeys-hook';
import { useCallback, useMemo } from 'react';
import { useScheduleStore, type CalendarPresentationMode } from '@/store';
import { useAnnounce } from './useAnnounce';

export interface KeyboardShortcut {
  key: string;
  description: string;
  scope?: string;
  group?: 'navigation' | 'view' | 'action' | 'help';
}

const SHORTCUT_GROUPS = {
  view: 'View Controls',
  navigation: 'Navigation',
  action: 'Actions',
  help: 'Help'
} as const;

export function useCalendarKeyboard() {
  const { 
    setCalendarPresentationMode, 
    shiftWeekOffset,
    toggleCopilot,
    scheduleViewport
  } = useScheduleStore();
  
  const { announceViewChange, announceNavigation } = useAnnounce();

  // View switching shortcuts
  useHotkeys('ctrl+1', (e) => {
    e.preventDefault();
    setCalendarPresentationMode('grid');
    announceViewChange('Grid');
  }, {
    description: 'Switch to Grid view',
    scopes: ['calendar']
  });

  useHotkeys('ctrl+2', (e) => {
    e.preventDefault();
    setCalendarPresentationMode('list');
    announceViewChange('List');
  }, {
    description: 'Switch to List view',
    scopes: ['calendar']
  });

  useHotkeys('ctrl+3', (e) => {
    e.preventDefault();
    setCalendarPresentationMode('bar');
    announceViewChange('Bar');
  }, {
    description: 'Switch to Bar view',
    scopes: ['calendar']
  });

  useHotkeys('ctrl+4', (e) => {
    e.preventDefault();
    setCalendarPresentationMode('week');
    announceViewChange('Week');
  }, {
    description: 'Switch to Week view',
    scopes: ['calendar']
  });

  useHotkeys('ctrl+5', (e) => {
    e.preventDefault();
    setCalendarPresentationMode('month');
    announceViewChange('Month');
  }, {
    description: 'Switch to Month view',
    scopes: ['calendar']
  });

  useHotkeys('ctrl+6', (e) => {
    e.preventDefault();
    setCalendarPresentationMode('timeline');
    announceViewChange('Timeline');
  }, {
    description: 'Switch to Timeline view',
    scopes: ['calendar']
  });

  // Navigation shortcuts
  useHotkeys('arrowleft', () => {
    shiftWeekOffset(-1);
    announceNavigation('previous week');
  }, {
    description: 'Previous week',
    scopes: ['calendar']
  });

  useHotkeys('arrowright', () => {
    shiftWeekOffset(1);
    announceNavigation('next week');
  }, {
    description: 'Next week',
    scopes: ['calendar']
  });

  useHotkeys('alt+arrowleft', () => {
    shiftWeekOffset(-4); // Previous month
    announceNavigation('previous month');
  }, {
    description: 'Previous month',
    scopes: ['calendar']
  });

  useHotkeys('alt+arrowright', () => {
    shiftWeekOffset(4); // Next month
    announceNavigation('next month');
  }, {
    description: 'Next month',
    scopes: ['calendar']
  });

  useHotkeys('t', () => {
    // Jump to today
    const today = new Date().toISOString().split('T')[0];
    useScheduleStore.getState().setSelectedDate(today);
    announceNavigation('today');
  }, {
    description: 'Jump to today',
    scopes: ['calendar']
  });

  // Action shortcuts
  useHotkeys('ctrl+f', (e) => {
    e.preventDefault();
    const searchInput = document.getElementById('calendar-search');
    if (searchInput) {
      searchInput.focus();
      searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, {
    description: 'Focus search box',
    scopes: ['calendar']
  });

  useHotkeys('ctrl+/', (e) => {
    e.preventDefault();
    toggleCopilot();
  }, {
    description: 'Toggle AI Assistant',
    scopes: ['calendar']
  });

  useHotkeys('esc', () => {
    // Close modals, clear selection
    useScheduleStore.getState().setSelectedDate(null);
    useScheduleStore.getState().setSelectedProviderId(null);
  }, {
    description: 'Clear selection / Close modal',
    scopes: ['calendar']
  });

  // Help shortcut
  useHotkeys('?', (e) => {
    // Only trigger if not in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    
    // Toggle keyboard help modal
    const event = new CustomEvent('toggle-keyboard-help');
    window.dispatchEvent(event);
  }, {
    description: 'Show keyboard shortcuts',
    scopes: ['calendar']
  });

  // Get all shortcuts organized by group
  const shortcuts = useMemo<KeyboardShortcut[]>(() => [
    // View shortcuts
    { key: 'Ctrl + 1', description: 'Grid view', group: 'view' },
    { key: 'Ctrl + 2', description: 'List view', group: 'view' },
    { key: 'Ctrl + 3', description: 'Bar view', group: 'view' },
    { key: 'Ctrl + 4', description: 'Week view', group: 'view' },
    { key: 'Ctrl + 5', description: 'Month view', group: 'view' },
    { key: 'Ctrl + 6', description: 'Timeline view', group: 'view' },
    
    // Navigation shortcuts
    { key: '← / →', description: 'Previous / Next week', group: 'navigation' },
    { key: 'Alt + ← / →', description: 'Previous / Next month', group: 'navigation' },
    { key: 'T', description: 'Jump to today', group: 'navigation' },
    
    // Action shortcuts
    { key: 'Ctrl + F', description: 'Focus search', group: 'action' },
    { key: 'Ctrl + /', description: 'Toggle AI Assistant', group: 'action' },
    { key: 'Esc', description: 'Clear selection / Close modal', group: 'action' },
    
    // Help shortcuts
    { key: '?', description: 'Show keyboard shortcuts', group: 'help' },
  ], []);

  // Group shortcuts for display
  const groupedShortcuts = useMemo(() => {
    return shortcuts.reduce((acc, shortcut) => {
      const group = shortcut.group || 'other';
      if (!acc[group]) acc[group] = [];
      acc[group].push(shortcut);
      return acc;
    }, {} as Record<string, KeyboardShortcut[]>);
  }, [shortcuts]);

  // Focus management helpers
  const focusShift = useCallback((shiftId: string) => {
    const element = document.getElementById(`shift-${shiftId}`);
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      element.setAttribute('aria-selected', 'true');
    }
  }, []);

  const focusNextShift = useCallback(() => {
    const focused = document.activeElement;
    if (focused?.id?.startsWith('shift-')) {
      const allShifts = document.querySelectorAll('[id^="shift-"]');
      const currentIndex = Array.from(allShifts).indexOf(focused);
      const nextShift = allShifts[currentIndex + 1];
      if (nextShift) {
        (nextShift as HTMLElement).focus();
        nextShift.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, []);

  const focusPreviousShift = useCallback(() => {
    const focused = document.activeElement;
    if (focused?.id?.startsWith('shift-')) {
      const allShifts = document.querySelectorAll('[id^="shift-"]');
      const currentIndex = Array.from(allShifts).indexOf(focused);
      const prevShift = allShifts[currentIndex - 1];
      if (prevShift) {
        (prevShift as HTMLElement).focus();
        prevShift.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, []);

  // Enable/disable keyboard shortcuts
  const enableScope = useCallback((scope: string) => {
    const { enableScope: enable } = useHotkeysContext();
    enable(scope);
  }, []);

  const disableScope = useCallback((scope: string) => {
    const { disableScope: disable } = useHotkeysContext();
    disable(scope);
  }, []);

  return {
    shortcuts,
    groupedShortcuts,
    shortcutGroups: SHORTCUT_GROUPS,
    focusShift,
    focusNextShift,
    focusPreviousShift,
    enableScope,
    disableScope
  };
}

// Hook for announcing keyboard navigation to screen readers
export function useKeyboardAnnounce() {
  const announce = useCallback((message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  return { announce };
}
