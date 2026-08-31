import { useEffect, useRef } from 'react';

/**
 * useRealtime — opens a WebSocket to the Django Channels endpoint and invokes
 * `onMessage` for every message received. Reconnects automatically and cleans up
 * on unmount.
 *
 * @param {string|null} url  Full WS url (e.g. `${WS_BASE_URL}/kitchen/`) or null to disable
 * @param {(data: object) => void} onMessage  Called with parsed JSON for each frame
 */
export default function useRealtime(url, onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!url) return undefined;

    let ws;
    let closed = false;
    let retryTimer;

    const connect = () => {
      try {
        ws = new WebSocket(url);
      } catch {
        retryTimer = setTimeout(connect, 3000);
        return;
      }

      ws.onopen = () => {};

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (!closed) retryTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        try { ws.close(); } catch { /* noop */ }
      };
    };

    connect();

    return () => {
      closed = true;
      clearTimeout(retryTimer);
      try { ws?.close(); } catch { /* noop */ }
    };
  }, [url]);
}
