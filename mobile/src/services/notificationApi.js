import { api } from './apiClient';

const PREFIX = '/api/v1/notifications';

export const notificationApi = {
  /** Fetch undismissed notifications (pass { all: '1' } for everything). */
  list: (params = {}) => api.get(`${PREFIX}/`, params),

  /** Dismiss a single notification by ID. */
  dismiss: (id) => api.post(`${PREFIX}/${id}/dismiss/`),

  /** Dismiss every pending notification at once. */
  dismissAll: () => api.post(`${PREFIX}/dismiss-all/`),

  /** Register a push notification device token. */
  registerDeviceToken: (token, platform = 'android') =>
    api.post(`${PREFIX}/device-token/`, { token, platform }),

  /** Unregister a push notification device token (on logout). */
  unregisterDeviceToken: (token) =>
    api.delete(`${PREFIX}/device-token/delete/`, { token }),
};
