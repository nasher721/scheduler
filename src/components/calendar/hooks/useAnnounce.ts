/**
 * useAnnounce Hook
 * 
 * Provides screen reader announcements for calendar actions.
 * Uses @react-aria/live-announcer for proper ARIA live region support.
 */

import { useCallback } from 'react';
import { announce as ariaAnnounce } from '@react-aria/live-announcer';
import type { ShiftType, Provider } from '@/store';

export function useAnnounce() {
  /**
   * Announce a general message to screen readers
   */
  const announce = useCallback((message: string, importance: 'polite' | 'assertive' = 'polite') => {
    ariaAnnounce(message, importance);
  }, []);

  /**
   * Announce view changes
   */
  const announceViewChange = useCallback((viewName: string) => {
    announce(`Switched to ${viewName} view`, 'polite');
  }, [announce]);

  /**
   * Announce navigation changes
   */
  const announceNavigation = useCallback((direction: string) => {
    announce(`Moved to ${direction}`, 'polite');
  }, [announce]);

  /**
   * Announce shift assignment
   */
  const announceAssignment = useCallback((
    providerName: string, 
    shiftType: ShiftType, 
    date: string
  ) => {
    announce(`${providerName} assigned to ${shiftType} shift on ${date}`, 'polite');
  }, [announce]);

  /**
   * Announce shift unassignment
   */
  const announceUnassignment = useCallback((shiftType: ShiftType, date: string) => {
    announce(`${shiftType} shift on ${date} is now unassigned`, 'polite');
  }, [announce]);

  /**
   * Announce filter changes
   */
  const announceFilterChange = useCallback((filterCount: number, resultCount: number) => {
    if (filterCount === 0) {
      announce('All filters cleared', 'polite');
    } else {
      announce(`Filters applied. Showing ${resultCount} shifts`, 'polite');
    }
  }, [announce]);

  /**
   * Announce search results
   */
  const announceSearchResults = useCallback((term: string, count: number) => {
    if (count === 0) {
      announce(`No results found for "${term}"`, 'assertive');
    } else {
      announce(`Found ${count} result${count !== 1 ? 's' : ''} for "${term}"`, 'polite');
    }
  }, [announce]);

  /**
   * Announce selection changes
   */
  const announceSelection = useCallback((count: number) => {
    if (count === 0) {
      announce('Selection cleared', 'polite');
    } else {
      announce(`${count} item${count !== 1 ? 's' : ''} selected`, 'polite');
    }
  }, [announce]);

  /**
   * Announce errors
   */
  const announceError = useCallback((message: string) => {
    announce(`Error: ${message}`, 'assertive');
  }, [announce]);

  /**
   * Announce success
   */
  const announceSuccess = useCallback((message: string) => {
    announce(`Success: ${message}`, 'polite');
  }, [announce]);

  /**
   * Announce loading states
   */
  const announceLoading = useCallback((message: string) => {
    announce(`Loading: ${message}`, 'polite');
  }, [announce]);

  return {
    announce,
    announceViewChange,
    announceNavigation,
    announceAssignment,
    announceUnassignment,
    announceFilterChange,
    announceSearchResults,
    announceSelection,
    announceError,
    announceSuccess,
    announceLoading
  };
}
