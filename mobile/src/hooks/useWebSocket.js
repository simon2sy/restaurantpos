import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { WS_BASE_URL } from '../constants/config';
import { getAccessToken } from '../services/apiClient';

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;
const PING_INTERVAL_MS = 30000;

/**
 * useWebSocket - Real-time WebSocket connection to Django Channels.
 *
 * Replaces AJAX polling with persistent WebSocket connections for:
 * - 'kitchen'   - KitchenConsumer (new_order, batch_status)
 * - 'waiters'   - WaiterConsumer (order_ready, order_served)
 * - 'dashboard' - DashboardConsumer (stats_updated)
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Authentication via JWT token in query string
 * - App state awareness (pauses when backgrounded)
 * - Heartbeat/ping to keep connection alive
 *
 * @param {string|null} stream  'kitchen' | 'waiters' | 'dashboard' (null disables)
 * @param {(data: object) => void} onMessage - Callback for incoming messages
 * @param {{ reconnectDelayMs?: number }} [options]
 */
export default function useWebSocket(stream, onMessage, { reconnectDelayMs = RECONNECT_DELAY_MS } = {}) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const wsRef = useRef(null);
  const reconnectDelayRef = useRef(reconnectDelayMs);
  const reconnectTimerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const isClosedRef = useRef(false);
  const appActiveRef = useRef(true);
  const appStateSubRef = useRef(null);

  const connect = useCallback(async () => {
    if (!stream || isClosedRef.current) return;

    try {
      const token = await getAccessToken();
      const wsUrl = `${WS_BASE_URL}/${stream}/`;
      const url = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[WebSocket] Connected to ${stream}`);
        reconnectDelayRef.current = reconnectDelayMs;

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;
          onMessageRef.current?.(data);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
      ws.onerror = (error) => {
        console.error(`[WebSocket] Error on ${stream}:`, error);
      };

      ws.onclose = (event) => {
        console.log(`[WebSocket] Disconnected from ${stream}:`, event.code, event.reason);
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        if (!isClosedRef.current && appActiveRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            if (!isClosedRef.current && appActiveRef.current) {
              connect();
            }
          }, reconnectDelayRef.current);

          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * 2,
            MAX_RECONNECT_DELAY_MS
          );
        }
      };
    } catch (error) {
      console.error(`[WebSocket] Failed to connect to ${stream}:`, error);
      
      if (!isClosedRef.current && appActiveRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          if (!isClosedRef.current && appActiveRef.current) {
            connect();
          }
        }, reconnectDelayRef.current);

        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 2,
          MAX_RECONNECT_DELAY_MS
        );
      }
    }
  }, [stream, reconnectDelayMs]);

  useEffect(() => {
    if (!stream) return undefined;

    appStateSubRef.current = AppState.addEventListener('change', (state) => {
      const wasActive = appActiveRef.current;
      appActiveRef.current = state === 'active' || state === 'foreground';

      if (appActiveRef.current && !wasActive) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reconnectDelayRef.current = reconnectDelayMs;
          connect();
        }
      } else if (!appActiveRef.current && wasActive) {
        if (wsRef.current) {
          isClosedRef.current = true;
          wsRef.current.close();
          wsRef.current = null;
        }
      }
    });

    return () => {
      appStateSubRef.current?.remove?.();
      appStateSubRef.current = null;
    };
  }, [stream, connect, reconnectDelayMs]);

  useEffect(() => {
    if (!stream) return undefined;

    isClosedRef.current = false;
    connect();

    return () => {
      isClosedRef.current = true;
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [stream, connect]);
}