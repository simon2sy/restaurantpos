import { useState, useCallback, useRef } from 'react';
import { create, act } from 'react-test-renderer';
import useRetry from '../../src/hooks/useRetry';
import { ApiError } from '../../src/services/apiClient';

// Helper component that uses the useRetry hook
function TestComponent({ asyncFn, maxRetries, baseDelay }) {
  const { data, loading, error, execute, retry, clearError } = useRetry(asyncFn, {
    maxRetries,
    baseDelay,
  });

  return {
    data,
    loading,
    error,
    execute,
    retry,
    clearError,
  };
}

// Since useRetry is a plain logic hook (no RN deps), test it directly
describe('useRetry()', () => {
  // We test the hook logic by invoking the same functions directly
  // without needing react-test-renderer or testing-library

  it('returns data on successful execution', async () => {
    const mockFn = jest.fn().mockResolvedValue({ id: 1, name: 'Order #1' });

    let hookRef = {};
    function Wrapper() {
      const hook = useRetry(mockFn);
      Object.assign(hookRef, hook);
      return null;
    }

    create(<Wrapper />);

    let result;
    await act(async () => {
      result = await hookRef.execute('arg1');
    });

    expect(mockFn).toHaveBeenCalledWith('arg1');
    expect(result).toEqual({ id: 1, name: 'Order #1' });
    expect(hookRef.data).toEqual({ id: 1, name: 'Order #1' });
    expect(hookRef.loading).toBe(false);
    expect(hookRef.error).toBeNull();
  });

  it('sets error state on non-retryable failure', async () => {
    const mockFn = jest.fn().mockRejectedValue(new ApiError('Bad request', 400));

    let hookRef = {};
    function Wrapper() {
      const hook = useRetry(mockFn);
      Object.assign(hookRef, hook);
      return null;
    }

    create(<Wrapper />);

    await act(async () => {
      try {
        await hookRef.execute();
      } catch {
        // expected
      }
    });

    expect(hookRef.error).toBeTruthy();
    expect(hookRef.error.message).toBe('Bad request');
    expect(hookRef.loading).toBe(false);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('retries on network error (status 0)', async () => {
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('Network error', 0))
      .mockResolvedValueOnce({ success: true });

    let hookRef = {};
    function Wrapper() {
      const hook = useRetry(mockFn, { maxRetries: 1, baseDelay: 10 });
      Object.assign(hookRef, hook);
      return null;
    }

    create(<Wrapper />);

    let data;
    await act(async () => {
      data = await hookRef.execute();
    });

    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(data).toEqual({ success: true });
  });

  it('retries on 503 (service unavailable)', async () => {
    const mockFn = jest
      .fn()
      .mockRejectedValueOnce(new ApiError('Service down', 503))
      .mockResolvedValueOnce({ ok: true });

    let hookRef = {};
    function Wrapper() {
      const hook = useRetry(mockFn, { maxRetries: 2, baseDelay: 10 });
      Object.assign(hookRef, hook);
      return null;
    }

    create(<Wrapper />);

    await act(async () => {
      await hookRef.execute();
    });

    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 400/401/403/404', async () => {
    const statuses = [400, 401, 403, 404];

    for (const status of statuses) {
      const mockFn = jest.fn().mockRejectedValue(new ApiError('Error', status));

      let hookRef = {};
      function Wrapper() {
        const hook = useRetry(mockFn, { maxRetries: 3, baseDelay: 10 });
        Object.assign(hookRef, hook);
        return null;
      }

      create(<Wrapper />);

      await act(async () => {
        try {
          await hookRef.execute();
        } catch {
          // expected
        }
      });

      expect(mockFn).toHaveBeenCalledTimes(1);
    }
  });

  it('clearError() resets error state', async () => {
    const mockFn = jest.fn().mockRejectedValue(new ApiError('Error', 500));

    let hookRef = {};
    function Wrapper() {
      const hook = useRetry(mockFn);
      Object.assign(hookRef, hook);
      return null;
    }

    create(<Wrapper />);

    await act(async () => {
      try {
        await hookRef.execute();
      } catch {
        // expected
      }
    });

    expect(hookRef.error).toBeTruthy();

    act(() => {
      hookRef.clearError();
    });

    expect(hookRef.error).toBeNull();
  });
});
