import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  registerForPushNotifications,
  setupNotificationListeners,
} from '../services/pushNotificationService';
import { useAuth } from '../context/AuthContext';

/**
 * usePushNotifications — handles the full push notification lifecycle:
 *
 * 1. On login: registers the device token with the backend
 * 2. Sets up foreground + tap listeners
 * 3. On logout: unregisters the token
 * 4. Provides onNotificationReceived and onNotificationTap callbacks
 *
 * @param {Object} options
 * @param {Function} options.onNotificationReceived - called in foreground
 * @param {Function} options.onNotificationTap - called when user taps a notification
 */
export default function usePushNotifications({ onNotificationReceived, onNotificationTap } = {}) {
  const { isLoggedIn, user } = useAuth();
  const tokenRef = useRef(null);
  const listenersRef = useRef(null);

  const handleReceived = useCallback((notification) => {
    console.log('Push notification received in foreground:', notification.request.content);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  }, [onNotificationReceived]);

  const handleTap = useCallback((response) => {
    const data = response.notification.request.content.data;
    console.log('Push notification tapped:', data);
    if (onNotificationTap) {
      onNotificationTap(data, response);
    }
  }, [onNotificationTap]);

  // Register for push notifications when user logs in
  useEffect(() => {
    if (!isLoggedIn || !user) {
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        const token = await registerForPushNotifications();
        if (!cancelled) {
          tokenRef.current = token;
        }
      } catch (error) {
        console.warn('Failed to register push notifications:', error);
      }
    };

    register();

    // Set up listeners
    listenersRef.current = setupNotificationListeners(handleReceived, handleTap);

    return () => {
      cancelled = true;
      if (listenersRef.current) {
        listenersRef.current.remove();
        listenersRef.current = null;
      }
    };
  }, [isLoggedIn, user, handleReceived, handleTap]);

  return {
    pushToken: tokenRef.current,
  };
}
