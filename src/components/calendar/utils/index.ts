/**
 * Calendar Utilities
 * 
 * Helper functions and utilities for the calendar.
 */

export {
  generateShiftAriaLabel,
  generateDateAriaLabel,
  formatShiftType,
  formatPriority,
  focusElement,
  focusFirstInContainer,
  trapFocus,
  createSkipLinkTarget,
  announceToScreenReader,
  getContrastRatio,
  meetsWCAGAA,
  meetsWCAGAAA,
  getAccessibilitySettings,
  saveAccessibilitySettings,
  applyAccessibilitySettings,
  isVisibleToScreenReader,
  getAccessibleName
} from './accessibilityUtils';

export type { AccessibilitySettings } from './accessibilityUtils';
