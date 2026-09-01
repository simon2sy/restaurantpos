import { useState, useCallback, useRef } from 'react';
import { ApiError } from '../services/apiClient';

/**
 * Hook that wraps an async API call with automatic retry + exponential backoff.
 *
 * Usage:
 *   const { data, loading, error, execute, retry } = useRetry(fetchOrders);
 *
 *   // First call (with optional args)
 *   await execute(status, page);
 *
 *   // Retry last failed call (same args)
 *   await retry();
 */
export default function useRetry(asyncFn, { maxRetries = 2, baseDelay = 1000 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastArgsRef = useRef(null);

  const execute = useCallback(
    async (...args) => {
      lastArgsRef.current = args;
      setLoading(true);
      setError(null);

      let lastError;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await asyncFn(...args);
          setData(result);
          setLoading(false);
          return result;
        } catch (err) {
          lastError = err;

          // Only retry on network/timeout errors (status 0, 408, 502, 503, 504)
          const isRetryable =
            err instanceof ApiError &&
            [0, 408, 502, 503, 504].includes(err.status);

          if (!isRetryable || attempt >= maxRetries) break;

          // Exponential backoff: 1s, 2s, 4s...
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      setError(lastError);
      setLoading(false);
      throw lastError;
    },
    [asyncFn, maxRetries, baseDelay]
  );

  const retry = useCallback(() => {
    if (lastArgsRef.current) {
      return execute(...lastArgsRef.current);
    }
    return execute();
  }, [execute]);

  const clearError = useCallback(() => setError(null), []);

  return { data, loading, error, execute, retry, clearError };
}
