/**
 * Accessibility Utilities
 * 
 * Helper functions for ARIA labels, focus management, and accessibility features.
 * Part of Phase 1: UX & Accessibility
 */

import type { ShiftSlot, Provider, ShiftType, ServicePriority } from '@/store';
import { format, parseISO } from 'date-fns';

/**
 * Generate ARIA label for a shift slot
 */
export function generateShiftAriaLabel(
  slot: ShiftSlot,
  provider?: Provider
): string {
  const parts: string[] = [];
  
  // Shift type and priority
  parts.push(`${formatShiftType(slot.type)} shift`);
  
  if (slot.servicePriority === 'CRITICAL') {
    parts.push('critical priority');
  }
  
  // Location
  if (slot.serviceLocation) {
    parts.push(`at ${slot.serviceLocation}`);
  }
  
  // Date
  parts.push(format(parseISO(slot.date), 'MMMM do'));
  
  // Assignment status
  if (provider) {
    parts.push(`assigned to ${provider.name}`);
  } else {
    parts.push('unassigned');
  }
  
  // Special flags
  if (slot.isBackup) {
    parts.push('backup assignment');
  }
  
  return parts.join(', ');
}

/**
 * Generate ARIA label for date header
 */
export function generateDateAriaLabel(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, "EEEE, MMMM do yyyy");
}

/**
 * Format shift type for display
 */
export function formatShiftType(type: ShiftType): string {
  const labels: Record<ShiftType, string> = {
    DAY: 'Day',
    NIGHT: 'Night',
    NMET: 'NMET',
    JEOPARDY: 'Jeopardy',
    RECOVERY: 'Recovery',
    CONSULTS: 'Consults',
    VACATION: 'Vacation'
  };
  
  return labels[type] || type;
}

/**
 * Format priority for display
 */
export function formatPriority(priority: ServicePriority): string {
  const labels: Record<ServicePriority, string> = {
    CRITICAL: 'Critical',
    STANDARD: 'Standard',
    FLEXIBLE: 'Flexible'
  };
  
  return labels[priority] || priority;
}

/**
 * Focus management helpers
 */
export function focusElement(elementId: string, options?: { 
  select?: boolean;
  scrollIntoView?: boolean;
  delay?: number;
}) {
  const { select = false, scrollIntoView = true, delay = 0 } = options || {};
  
  const doFocus = () => {
    const element = document.getElementById(elementId);
    if (!element) return false;
    
    element.focus({ preventScroll: !scrollIntoView });
    
    if (select && element instanceof HTMLInputElement) {
      element.select();
    }
    
    if (scrollIntoView) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    return true;
  };
  
  if (delay > 0) {
    setTimeout(doFocus, delay);
  } else {
    return doFocus();
  }
}

/**
 * Focus the first focusable element within a container
 */
export function focusFirstInContainer(containerId: string): boolean {
  const container = document.getElementById(containerId);
  if (!container) return false;
  
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusable.length > 0) {
    focusable[0].focus();
    return true;
  }
  
  return false;
}

/**
 * Trap focus within a modal or container
 */
export function trapFocus(containerId: string, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  );
  
  if (focusable.length === 0) return;
  
  const firstFocusable = focusable[0];
  const lastFocusable = focusable[focusable.length - 1];
  
  if (event.shiftKey) {
    // Shift + Tab
    if (document.activeElement === firstFocusable) {
      lastFocusable.focus();
      event.preventDefault();
    }
  } else {
    // Tab
    if (document.activeElement === lastFocusable) {
      firstFocusable.focus();
      event.preventDefault();
    }
  }
}

/**
 * Create a skip link target
 */
export function createSkipLinkTarget(id: string, label: string): HTMLElement {
  const target = document.createElement('div');
  target.id = id;
  target.tabIndex = -1;
  target.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-white focus:shadow-lg focus:rounded-lg';
  target.textContent = label;
  return target;
}

/**
 * Announce to screen readers
 */
export function announceToScreenReader(
  message: string,
  importance: 'polite' | 'assertive' = 'polite'
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', importance);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement is read
  setTimeout(() => {
    if (announcement.parentNode) {
      document.body.removeChild(announcement);
    }
  }, 1000);
}

/**
 * Get contrast ratio between two colors
 * Returns a ratio from 1 to 21 (higher is better contrast)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const luminance1 = getLuminance(color1);
  const luminance2 = getLuminance(color2);
  
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

function getLuminance(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 0;
  
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseColor(color: string): [number, number, number] | null {
  // Parse hex
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }
  }
  
  // Parse rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1]),
      parseInt(rgbMatch[2]),
      parseInt(rgbMatch[3])
    ];
  }
  
  return null;
}

/**
 * Check if a color combination meets WCAG AA standards
 */
export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if a color combination meets WCAG AAA standards
 */
export function meetsWCAGAAA(
  foreground: string,
  background: string,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Accessibility settings manager
 */
export interface AccessibilitySettings {
  highContrast: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  screenReaderOptimized: boolean;
}

const STORAGE_KEY = 'calendar-accessibility-settings';

export function getAccessibilitySettings(): AccessibilitySettings {
  if (typeof window === 'undefined') {
    return {
      highContrast: false,
      reduceMotion: false,
      largeText: false,
      screenReaderOptimized: false
    };
  }
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  
  // Check system preferences
  return {
    highContrast: window.matchMedia('(prefers-contrast: high)').matches,
    reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    largeText: window.matchMedia('(prefers-large-text)').matches,
    screenReaderOptimized: false
  };
}

export function saveAccessibilitySettings(settings: AccessibilitySettings): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applyAccessibilitySettings(settings);
  }
}

export function applyAccessibilitySettings(settings: AccessibilitySettings): void {
  const root = document.documentElement;
  
  if (settings.highContrast) {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }
  
  if (settings.reduceMotion) {
    root.classList.add('reduce-motion');
  } else {
    root.classList.remove('reduce-motion');
  }
  
  if (settings.largeText) {
    root.classList.add('large-text');
  } else {
    root.classList.remove('large-text');
  }
}

/**
 * Test if an element is visible to screen readers
 */
export function isVisibleToScreenReader(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  
  // Check if element is hidden with display: none or visibility: hidden
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  
  // Check if element has aria-hidden="true"
  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  
  return true;
}

/**
 * Get accessible name for an element
 */
export function getAccessibleName(element: HTMLElement): string {
  // Check aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  // Check aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) return labelElement.textContent || '';
  }
  
  // Check for associated label (for form elements)
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.textContent || '';
  }
  
  // Use text content
  return element.textContent || '';
}
