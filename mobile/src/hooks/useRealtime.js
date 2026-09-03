import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { realtimeApi } from '../services/realtimeApi';

const DEFAULT_INTERVAL_MS = 3000;
const MAX_BACKOFF_MS = 15000;

/**
 * useRealtime — HTTP-polling replacement for the WebSocket transport.
 *
 * Polls GET /api/v1/realtime/pulse/ on an interval and invokes `onMessage`
 * with the same message shapes the Django Channels consumers used to send:
 *   - 'kitchen'   → { type: 'new_order' } / { type: 'batch_status' } on change
 *   - 'dashboard' → { type: 'stats_updated', reason }
 *   - 'waiters'   → { type: 'order_ready', order_number, table, cabin,
 *                     delivery, ready_at } per new notification
 *
 * Safeguards: skips a tick while the previous request is in-flight,
 * backs off on errors, pauses while the app is backgrounded, and cleans
 * up on unmount.
 *
 * @param {string|null} stream  'kitchen' | 'waiters' | 'dashboard' (null disables)
 * @param {(data: object) => void} onMessage
 * @param {{ intervalMs?: number }} [options]
 */
export default function useRealtime(stream, onMessage, { intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!stream) return undefined;

    let closed = false;
    let inFlight = false;
    let timer = null;
    let since = null; // server-provided cursor
    let backoffMs = 0;
    let appActive = true;
    let appStateSub = null;

    const tick = async () => {
      if (closed || inFlight) return;
      inFlight = true;
      try {
        const res = await realtimeApi.pulse(since, stream);
        const data = res?.data ?? res;

        if (data?.now) since = data.now;

        // Replay concrete events (waiters order-ready payloads etc.)
        if (Array.isArray(data?.events)) {
          for (const ev of data.events) {
            onMessageRef.current?.(ev);
          }
        }

        // Surface stream-level change flags as synthetic messages that
        // mirror the old WebSocket frame types, so screens just refetch.
        const section = data?.[stream];
        if (section?.changed) {
          if (stream === 'kitchen') {
            onMessageRef.current?.({ type: 'batch_status' });
          } else if (stream === 'dashboard') {
            onMessageRef.current?.({ type: 'stats_updated', reason: 'poll' });
          }
        }

        backoffMs = 0; // success — reset backoff
      } catch {
        // Network/server hiccup — back off before retrying.
        backoffMs = Math.min(backoffMs + intervalMs, MAX_BACKOFF_MS);
      }
    };

    const run = async () => {
      await tick();
      if (!closed) {
        timer = setTimeout(run, intervalMs + backoffMs);
      }
    };

    // Pause while backgrounded to save battery/data; catch up on resume.
    appStateSub = AppState.addEventListener('change', (state) => {
      const wasActive = appActive;
      appActive = state === 'active' || state === 'foreground';
      if (appActive && !wasActive) run();
    });

    run();

    return () => {
      closed = true;
      clearTimeout(timer);
      appStateSub?.remove?.();
    };
  }, [stream, intervalMs]);
}
