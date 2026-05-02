/**
 * Swap Notifications Hook
 * 
 * Marketplace-specific notification triggers for shift swaps.
 * Wraps the existing PWA push notification infrastructure.
 */

import { useState, useCallback } from 'react';
import {
  requestNotificationPermission,
  checkPushSupport,
  sendLocalNotification,
} from '@/lib/pwa/pushNotifications';

interface SwapNotificationPreferences {
  swapRequested: boolean;
  swapApproved: boolean;
  shiftReminder: boolean;
}

const DEFAULT_PREFERENCES: SwapNotificationPreferences = {
  swapRequested: true,
  swapApproved: true,
  shiftReminder: true,
};

const STORAGE_KEY = 'nicu-notification-prefs';

/**
 * Check if Notification API is available (not SSR, secure context)
 */
function isNotificationApiAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window;
}

/**
 * Get stored preferences from localStorage
 */
function getStoredPreferences(): SwapNotificationPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_PREFERENCES;
}

/**
 * Save preferences to localStorage
 */
function savePreferences(prefs: SwapNotificationPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors (quota exceeded, private browsing, etc.)
  }
}

/** Compute initial push support state (runs once at module level) */
function getInitialPushState() {
  if (!isNotificationApiAvailable()) {
    return { supported: false, permission: 'default' as NotificationPermission };
  }
  const { supported, permission } = checkPushSupport();
  return { supported, permission };
}

/**
 * Hook for swap-related notifications
 * 
 * Provides notification triggers for marketplace-specific events:
 * - Swap requests
 * - Swap approvals
 * - Shift reminders
 */
export function useSwapNotifications() {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
    () => getInitialPushState().permission
  );
  const [isSupported] = useState<boolean>(
    () => getInitialPushState().supported
  );
  const [preferences, setPreferences] = useState<SwapNotificationPreferences>(
    () => getStoredPreferences()
  );
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isNotificationApiAvailable()) {
      return 'denied';
    }

    const permission = await requestNotificationPermission();
    setPermissionStatus(permission);
    return permission;
  }, []);

  /**
   * Notify a provider that someone wants their shift
   */
  const notifySwapRequested = useCallback(async (
    shiftId: string,
    fromProvider: string
  ): Promise<void> => {
    if (!preferences.swapRequested) return;
    if (permissionStatus !== 'granted') return;
    if (!isNotificationApiAvailable()) return;

    await sendLocalNotification('Shift Swap Requested', {
      body: `Provider ${fromProvider} has requested your shift. Tap to view details.`,
      icon: '/icons/icon-192x192.png',
      tag: `swap-requested-${shiftId}`,
      data: { type: 'swap-requested', shiftId, fromProvider },
    });

    setLastNotification(`swap-requested-${shiftId}`);
  }, [preferences.swapRequested, permissionStatus]);

  /**
   * Notify the requester that their claim was approved
   */
  const notifySwapApproved = useCallback(async (
    shiftId: string,
    toProvider: string
  ): Promise<void> => {
    if (!preferences.swapApproved) return;
    if (permissionStatus !== 'granted') return;
    if (!isNotificationApiAvailable()) return;

    await sendLocalNotification('Shift Swap Approved', {
      body: `Your shift swap has been approved by ${toProvider}.`,
      icon: '/icons/icon-192x192.png',
      tag: `swap-approved-${shiftId}`,
      data: { type: 'swap-approved', shiftId, toProvider },
    });

    setLastNotification(`swap-approved-${shiftId}`);
  }, [preferences.swapApproved, permissionStatus]);

  /**
   * Remind about upcoming shift
   */
  const notifyShiftReminder = useCallback(async (
    shiftId: string,
    date: string,
    shiftType: string
  ): Promise<void> => {
    if (!preferences.shiftReminder) return;
    if (permissionStatus !== 'granted') return;
    if (!isNotificationApiAvailable()) return;

    await sendLocalNotification('Upcoming Shift Reminder', {
      body: `Reminder: You have a ${shiftType} shift on ${date}.`,
      icon: '/icons/icon-192x192.png',
      tag: `shift-reminder-${shiftId}`,
      data: { type: 'shift-reminder', shiftId, date, shiftType },
    });

    setLastNotification(`shift-reminder-${shiftId}`);
  }, [preferences.shiftReminder, permissionStatus]);

  /**
   * Update preference for a specific notification type
   */
  const updatePreference = useCallback((
    type: keyof SwapNotificationPreferences,
    enabled: boolean
  ): void => {
    setPreferences((prev) => {
      const updated = { ...prev, [type]: enabled };
      savePreferences(updated);
      return updated;
    });
  }, []);

  /**
   * Enable/disable swap requested notifications
   */
  const setSwapRequestedEnabled = useCallback((enabled: boolean) => {
    updatePreference('swapRequested', enabled);
  }, [updatePreference]);

  /**
   * Enable/disable swap approved notifications
   */
  const setSwapApprovedEnabled = useCallback((enabled: boolean) => {
    updatePreference('swapApproved', enabled);
  }, [updatePreference]);

  /**
   * Enable/disable shift reminder notifications
   */
  const setShiftReminderEnabled = useCallback((enabled: boolean) => {
    updatePreference('shiftReminder', enabled);
  }, [updatePreference]);

  /**
   * Check if a specific notification type is enabled
   */
  const isEnabled = useCallback((
    type: keyof SwapNotificationPreferences
  ): boolean => {
    return preferences[type];
  }, [preferences]);

  /**
   * Clear last notification reference
   */
  const clearLastNotification = useCallback(() => {
    setLastNotification(null);
  }, []);

  return {
    // Permission state
    requestPermission,
    permissionStatus,
    isSupported,
    
    // Notification triggers
    notifySwapRequested,
    notifySwapApproved,
    notifyShiftReminder,
    
    // Preferences
    preferences,
    updatePreference,
    setSwapRequestedEnabled,
    setSwapApprovedEnabled,
    setShiftReminderEnabled,
    isEnabled,
    
    // State
    lastNotification,
    clearLastNotification,
  };
}

export default useSwapNotifications;