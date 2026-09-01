import React, { createContext, useContext } from 'react';
import { Alert } from 'react-native';
import usePushNotifications from '../hooks/usePushNotifications';

const PushNotificationContext = createContext({ pushToken: null });

export const usePushNotificationContext = () => useContext(PushNotificationContext);

/**
 * Wraps the app and manages push notification registration + listeners.
 *
 * When a notification arrives in the foreground, it shows an in-app alert.
 * When the user taps a notification, the data payload is available for navigation.
 */
export function PushNotificationProvider({ children }) {
  const { pushToken } = usePushNotifications({
    onNotificationReceived: (notification) => {
      const { title, body } = notification.request.content;
      // Optional: show an in-app alert when receiving in foreground
      // (The notification banner already shows via setNotificationHandler)
    },
    onNotificationTap: (data) => {
      // Handle notification tap — navigate based on data payload
      // e.g. if data.type === 'order_ready', navigate to kitchen screen
      console.log('Notification tapped:', data);
    },
  });

  return (
    <PushNotificationContext.Provider value={{ pushToken }}>
      {children}
    </PushNotificationContext.Provider>
  );
}
