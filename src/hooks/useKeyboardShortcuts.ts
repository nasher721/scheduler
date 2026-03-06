import { useEffect, useCallback, useRef } from 'react';

export interface Shortcut {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  description: string;
  category?: string;
  action: () => void;
  preventDefault?: boolean;
}

/**
 * Hook for registering keyboard shortcuts
 * @param shortcuts - Array of shortcut definitions
 * @param enabled - Whether shortcuts are enabled (default: true)
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled: boolean = true) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.getAttribute('role') === 'textbox'
    ) {
      // Allow Ctrl/Cmd+S even in inputs
      const isSaveShortcut = 
        (event.ctrlKey || event.metaKey) && 
        event.key.toLowerCase() === 's';
      
      if (!isSaveShortcut) return;
    }

    for (const shortcut of shortcutsRef.current) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
      const altMatch = !!shortcut.alt === event.altKey;
      const shiftMatch = !!shortcut.shift === event.shiftKey;

      if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action();
        break;
      }
    }
  }, [enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Default shortcuts for the application
 */
export const defaultShortcuts: Shortcut[] = [
  {
    key: 's',
    ctrl: true,
    description: 'Save schedule',
    category: 'File',
    action: () => {
      // Dispatch custom event that components can listen to
      window.dispatchEvent(new CustomEvent('app:save'));
    },
  },
  {
    key: 'z',
    ctrl: true,
    description: 'Undo last action',
    category: 'Edit',
    action: () => {
      window.dispatchEvent(new CustomEvent('app:undo'));
    },
  },
  {
    key: 'z',
    ctrl: true,
    shift: true,
    description: 'Redo last action',
    category: 'Edit',
    action: () => {
      window.dispatchEvent(new CustomEvent('app:redo'));
    },
  },
  {
    key: 'f',
    ctrl: true,
    description: 'Search/filter providers',
    category: 'Navigation',
    action: () => {
      window.dispatchEvent(new CustomEvent('app:search'));
    },
  },
  {
    key: 'n',
    ctrl: true,
    description: 'Add new provider',
    category: 'Actions',
    action: () => {
      window.dispatchEvent(new CustomEvent('app:new-provider'));
    },
  },
  {
    key: 'a',
    ctrl: true,
    shift: true,
    description: 'Auto-assign shifts',
    category: 'Actions',
    action: () => {
      window.dispatchEvent(new CustomEvent('app:auto-assign'));
    },
  },
  {
    key: '?',
    description: 'Show keyboard shortcuts',
    category: 'Help',
    action: () => {
      window.dispatchEvent(new CustomEvent('app:show-shortcuts'));
    },
  },
  {
    key: 'Escape',
    description: 'Close modal/panel',
    category: 'Navigation',
    action: () => {
      window.dispatchEvent(new CustomEvent('app:escape'));
    },
  },
  {
    key: '1',
    ctrl: true,
    description: 'Go to Calendar view',
    category: 'Navigation',
    action: () => {
      window.dispatchEvent(new CustomEvent('app:view', { detail: 'calendar' }));
    },
  },
  {
    key: '2',
    ctrl: true,
    description: 'Go to Providers view',
    category: 'Navigation',
    action: () => {
      window.dispatchEvent(new CustomEvent('app:view', { detail: 'providers' }));
    },
  },
  {
    key: 'd',
    ctrl: true,
    description: 'Toggle dark mode',
    category: 'Preferences',
    action: () => {
      window.dispatchEvent(new CustomEvent('app:toggle-theme'));
    },
  },
];

/**
 * Format shortcut for display (e.g., "Ctrl+S")
 */
export function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.meta) parts.push('Cmd');
  
  parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  
  return parts.join('+');
}

/**
 * Group shortcuts by category
 */
export function groupShortcutsByCategory(shortcuts: Shortcut[]): Record<string, Shortcut[]> {
  return shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);
}

export default useKeyboardShortcuts;
