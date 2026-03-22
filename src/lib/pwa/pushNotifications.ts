/**
 * Push Notifications for PWA
 * 
 * Handles subscription, unsubscription, and receiving push notifications
 */

import { useState, useEffect, useCallback } from 'react';

/** Serialized push subscription (`PushSubscription#toJSON()`), not the live DOM type */
export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
  data?: Record<string, unknown>;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export type NotificationType = 
  | 'SHIFT_REMINDER'
  | 'SWAP_REQUEST'
  | 'SCHEDULE_CHANGE'
  | 'URGENT_COVERAGE'
  | 'CONFLICT_DETECTED'
  | 'MESSAGE_RECEIVED';

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(): Promise<PushSubscriptionJSON | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications not supported');
  }

  const registration = await navigator.serviceWorker.ready;
  
  // Check existing subscription
  let subscription = await registration.pushManager.getSubscription();
  
  if (!subscription) {
    // Create new subscription
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY) as BufferSource,
    });
  }

  // Send subscription to server
  await saveSubscription(subscription);

  return subscription.toJSON() as PushSubscriptionJSON;
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    await subscription.unsubscribe();
    await deleteSubscription(subscription);
    return true;
  }
  
  return false;
}

/**
 * Check if push notifications are supported and permission status
 */
export function checkPushSupport(): {
  supported: boolean;
  permission: NotificationPermission;
} {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window;
  const permission = supported ? Notification.permission : 'default';
  
  return { supported, permission };
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  
  return Notification.requestPermission();
}

/**
 * Send local notification (for testing)
 */
export async function sendLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, options);
}

/**
 * Save subscription to server
 */
async function saveSubscription(subscription: globalThis.PushSubscription): Promise<void> {
  const response = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!response.ok) {
    throw new Error('Failed to save subscription');
  }
}

/**
 * Delete subscription from server
 */
async function deleteSubscription(subscription: globalThis.PushSubscription): Promise<void> {
  await fetch('/api/notifications/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
}

/**
 * Hook for push notifications
 */
export function usePushNotifications() {
  const [subscription, setSubscription] = useState<PushSubscriptionJSON | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSupport = async () => {
      const { supported, permission } = checkPushSupport();
      setSupported(supported);
      setPermission(permission);

      if (supported && permission === 'granted') {
        try {
          const registration = await navigator.serviceWorker.ready;
          const existingSub = await registration.pushManager.getSubscription();
          if (existingSub) {
            setSubscription(existingSub.toJSON() as PushSubscriptionJSON);
          }
        } catch (err) {
          console.error('Failed to get subscription:', err);
        }
      }
    };

    checkSupport();
  }, []);

  const subscribe = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Request permission first
      const newPermission = await requestNotificationPermission();
      setPermission(newPermission);

      if (newPermission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      const sub = await subscribeToPushNotifications();
      setSubscription(sub);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await unsubscribeFromPushNotifications();
      setSubscription(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe');
    } finally {
      setLoading(false);
    }
  }, []);

  const sendTestNotification = useCallback(async () => {
    await sendLocalNotification('Test Notification', {
      body: 'Push notifications are working!',
      icon: '/icons/icon-192x192.png',
    });
  }, []);

  return {
    subscription,
    permission,
    supported,
    loading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
    isSubscribed: !!subscription,
  };
}

/**
 * Hook for notification preferences
 */
export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<Record<NotificationType, boolean>>({
    SHIFT_REMINDER: true,
    SWAP_REQUEST: true,
    SCHEDULE_CHANGE: true,
    URGENT_COVERAGE: true,
    CONFLICT_DETECTED: true,
    MESSAGE_RECEIVED: true,
  });

  useEffect(() => {
    // Load from localStorage or API
    const saved = localStorage.getItem('notification-preferences');
    if (saved) {
      setPreferences(JSON.parse(saved));
    }
  }, []);

  const updatePreference = useCallback((type: NotificationType, enabled: boolean) => {
    setPreferences((prev) => {
      const updated = { ...prev, [type]: enabled };
      localStorage.setItem('notification-preferences', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { preferences, updatePreference };
}

export default usePushNotifications;
