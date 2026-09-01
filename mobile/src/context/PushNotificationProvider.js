import React, { createContext, useContext } from 'react';
import usePushNotifications from '../hooks/usePushNotifications';
import { navigationRef } from '../navigation/AppNavigator';

const PushNotificationContext = createContext({ pushToken: null });

export const usePushNotificationContext = () => useContext(PushNotificationContext);

/**
 * Wraps the app and manages push notification registration + listeners.
 *
 * When a notification arrives in the foreground, it shows an in-app alert.
 * When the user taps a notification, the app deep-links to the related order.
 */
export function PushNotificationProvider({ children }) {
  const { pushToken } = usePushNotifications({
    onNotificationReceived: (notification) => {
      const { title, body } = notification.request.content;
      // Optional: show an in-app alert when receiving in foreground
      // (The notification banner already shows via setNotificationHandler)
    },
    onNotificationTap: (data) => {
      // Deep-link to the order the notification is about. The backend
      // sends { type: 'order_ready', order_id, order_number, batch_id }.
      const orderId = Number(data?.order_id);
      if (orderId && navigationRef.current?.isReady()) {
        navigationRef.current.navigate('Main', {
          screen: 'Orders',
          params: { screen: 'OrderDetail', params: { orderId } },
        });
      }
    },
  });

  return (
    <PushNotificationContext.Provider value={{ pushToken }}>
      {children}
    </PushNotificationContext.Provider>
  );
}
