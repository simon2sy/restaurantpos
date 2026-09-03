import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationApi } from '../services/notificationApi';

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

  // Polling listener (replaces the WebSocket — works on WSGI-only hosts).
  // Also pauses while the app is backgrounded and backs off on errors.
  useEffect(() => {
    closedRef.current = false;
    let inFlight = false;
    let timer;
    let backoffMs = 0;
    const INTERVAL_MS = 4000;

    const tick = async () => {
      if (closedRef.current || inFlight) return;
      inFlight = true;
      try {
        await refresh();
        backoffMs = 0;
      } catch {
        backoffMs = Math.min(backoffMs + INTERVAL_MS, 15000);
      } finally {
        inFlight = false;
      }
    };

    const run = async () => {
      await tick();
      if (!closedRef.current) retryRef.current = setTimeout(run, INTERVAL_MS + backoffMs);
    };

    let appStateSub = null;
    try {
      const { AppState } = require('react-native');
      appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active' || state === 'foreground') run();
      });
    } catch {
      // react-native unavailable in some test environments — ignore
    }

    run();

    return () => {
      closedRef.current = true;
      clearTimeout(retryRef.current);
      appStateSub?.remove?.();
    };
  }, []);

  return { count, refresh };
}
