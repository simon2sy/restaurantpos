import React, { createContext, useContext } from 'react';
import { Alert } from 'react-native';
import usePushNotifications from '../hooks/usePushNotifications';
import { navigationRef } from '../navigation/AppNavigator';

const PushNotificationContext = createContext({ pushToken: null });

export const usePushNotificationContext = () => useContext(PushNotificationContext);

/**
 * Wraps the app and manages push notification registration + listeners.
 *
 * When a notification arrives in the foreground, it shows an in-app alert.
 * When the user taps a notification, the app deep-links to the related order.
 *
 * Supported notification types:
 * - payment_received: Payment completed notification
 * - order_ready: Food is ready notification
 * - new_order: New order notification (for kitchen)
 */
export function PushNotificationProvider({ children }) {
  const { pushToken } = usePushNotifications({
    onNotificationReceived: (notification) => {
      const { title, body, data } = notification.request.content;
      const notificationType = data?.type;

      // Show in-app alert based on notification type
      if (title && body) {
        let alertTitle = title;
        let alertMessage = body;

        // Customize alert based on notification type
        switch (notificationType) {
          case 'payment_received':
            alertTitle = '💵 Payment Received';
            break;
          case 'order_ready':
            alertTitle = '🍽️ Order Ready';
            break;
          case 'new_order':
            alertTitle = '🔥 New Order';
            break;
          default:
            break;
        }

        Alert.alert(alertTitle, alertMessage, [{ text: 'OK' }]);
      }
    },
    onNotificationTap: (data) => {
      // Deep-link to the order the notification is about.
      // The backend sends different data based on notification type:
      // - payment_received: { type, order_id, order_number, payment_method, total, payer_name }
      // - order_ready: { type, order_id, order_number, batch_id }
      // - new_order: { type, order_id, order_number, batch_id }
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
