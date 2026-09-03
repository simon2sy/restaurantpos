import { api } from './apiClient';

const PREFIX = '/api/v1/realtime';

export const realtimeApi = {
  /**
   * Poll for realtime changes since `since` (ISO string) for the given
   * comma-separated streams: 'kitchen', 'waiters', 'dashboard'.
   * Pass null since on the first call to establish a baseline cursor.
   */
  pulse: (since = null, streams = 'kitchen,waiters,dashboard') => {
    const params = { streams };
    if (since) params.since = since;
    return api.get(`${PREFIX}/pulse/`, params);
  },
};