import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './apiClient';

/**
 * Configure how notifications appear when the app is in the foreground.
 * This plays a sound and shows a banner even while the user is using the app.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   // Show banner in foreground
    shouldPlaySound: true,    // Play notification sound
    shouldSetBadge: true,     // Update badge count
  }),
});

/**
 * Register the device for push notifications.
 *
 * 1. Requests permission (shows system dialog)
 * 2. Gets the Expo push token
 * 3. Registers it with the Django backend
 *
 * Must be called after the user is logged in (needs auth token).
 *
 * @returns {string|null} The push token, or null if registration failed
 */
export async function registerForPushNotifications() {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  // Get the Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync();
  const pushToken = tokenData.data;

  // Register with the backend
  try {
    await api.post('/api/v1/notifications/device-token/', {
      token: pushToken,
      platform: Platform.OS,
    });
    console.log('Push token registered with backend');
  } catch (error) {
    console.warn('Failed to register push token:', error.message);
  }

  // Android needs a notification channel for custom sounds
  if (Platform.OS === 'android') {
    // Delete the old channels first — Android freezes channel settings at
    // creation, so re-creating them is the only way to apply new sounds
    // on app updates.
    try {
      await Notifications.deleteNotificationChannelAsync('order-ready');
    } catch (e) { /* channel may not exist yet */ }
    try {
      await Notifications.deleteNotificationChannelAsync('general');
    } catch (e) { /* channel may not exist yet */ }

    // Channel for order ready notifications
    await Notifications.setNotificationChannelAsync('order-ready', {
      name: 'Order Ready',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f6ef7',
      sound: 'order_ready.mp3',
    });

    // Channel for general notifications (payment, new order)
    await Notifications.setNotificationChannelAsync('general', {
      name: 'General',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f6ef7',
      sound: 'default',
    });
  }

  return pushToken;
}

/**
 * Unregister the device from push notifications (e.g. on logout).
 */
export async function unregisterPushNotifications(pushToken) {
  if (!pushToken) return;

  try {
    await api.delete('/api/v1/notifications/device-token/delete/', {
      token: pushToken,
    });
  } catch (error) {
    console.warn('Failed to unregister push token:', error.message);
  }
}

/**
 * Set up notification listeners.
 *
 * Returns an object with:
 *  - remove() to clean up listeners
 *  - lastNotificationResponse for initial cold-start tap
 *
 * @param {Function} onReceive - Called when a notification arrives in foreground
 * @param {Function} onTap - Called when user taps a notification
 */
export function setupNotificationListeners(onReceive, onTap) {
  // Listen for notifications received while app is in foreground
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    if (onReceive) onReceive(notification);
  });

  // Listen for notification taps (foreground and background)
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (onTap) onTap(response);
  });

  // Handle notification that opened the app from cold start
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response && onTap) {
      onTap(response);
    }
  });

  return {
    remove: () => {
      receivedSub.remove();
      responseSub.remove();
    },
  };
}

/**
 * Schedule a local notification with sound.
 * Used for offline scenarios or local alerts.
 */
export async function scheduleLocalNotification({ title, body, data, sound = true }) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      vibrate: [0, 250, 250, 250],
    },
    trigger: null, // Immediately
  });
}
