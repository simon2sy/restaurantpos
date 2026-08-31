import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationApi } from '../services/notificationApi';
import { WS_BASE_URL } from '../constants/config';

/**
 * useNotifications — keeps a live count of undismissed order-ready
 * notifications and opens a WebSocket on ws/waiters/ so new alerts
 * arrive in real time.
 *
 * Returns { count, refresh }
 *  - count   – number of undismissed notifications (0 when all dismissed)
 *  - refresh – call to re-fetch from the API (e.g. after navigating back)
 */
export default function useNotifications() {
  const [count, setCount] = useState(0);
  const wsRef = useRef(null);
  const closedRef = useRef(false);
  const retryRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationApi.list();
      const data = res?.data;
      setCount(Array.isArray(data) ? data.length : 0);
    } catch {
      // best-effort; don't crash the app
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // WebSocket listener
  useEffect(() => {
    closedRef.current = false;

    const connect = () => {
      if (closedRef.current) return;

      try {
        const ws = new WebSocket(`${WS_BASE_URL}/waiters/`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'order_ready') {
              // Bump the count immediately (optimistic)
              setCount((c) => c + 1);
            }
          } catch {
            // ignore malformed frames
          }
        };

        ws.onclose = () => {
          if (!closedRef.current) {
            retryRef.current = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          try { ws.close(); } catch { /* noop */ }
        };
      } catch {
        retryRef.current = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      closedRef.current = true;
      clearTimeout(retryRef.current);
      try { wsRef.current?.close(); } catch { /* noop */ }
    };
  }, []);

  return { count, refresh };
}
