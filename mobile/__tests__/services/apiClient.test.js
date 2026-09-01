// Tests for apiClient — the centralized fetch wrapper with auth + error handling.

import { api, ApiError } from '../../src/services/apiClient';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../src/constants/config';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
  SecureStore.getItemAsync.mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────

const okJson = (data, status = 200) => ({
  ok: true,
  status,
  headers: new Map([['content-type', 'application/json']]),
  json: () => Promise.resolve(data),
});

const errorJson = (data, status = 400) => ({
  ok: false,
  status,
  headers: new Map([['content-type', 'application/json']]),
  json: () => Promise.resolve(data),
});

const htmlResponse = (status = 503) => ({
  ok: false,
  status,
  headers: new Map([['content-type', 'text/html']]),
  text: () => Promise.resolve('<html><body>Service unavailable</body></html>'),
});

// ─── GET ──────────────────────────────────────────────────

describe('api.get()', () => {
  it('sends GET with correct URL and no auth header when no token', async () => {
    global.fetch.mockResolvedValueOnce(okJson({ success: true, data: [] }));

    const result = await api.get('/api/v1/orders/');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/orders/`);
    expect(opts.method).toBe('GET');
    expect(opts.headers.Authorization).toBeUndefined();
    expect(result).toEqual({ success: true, data: [] });
  });

  it('attaches Bearer token when available', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce('test-access-token');
    global.fetch.mockResolvedValueOnce(okJson({ success: true }));

    await api.get('/api/v1/auth/me/');

    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer test-access-token');
  });

  it('appends query params to URL', async () => {
    global.fetch.mockResolvedValueOnce(okJson({ data: [] }));

    await api.get('/api/v1/orders/', { status: 'OPEN', page: 2 });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('status=OPEN');
    expect(url).toContain('page=2');
  });
});

// ─── POST ─────────────────────────────────────────────────

describe('api.post()', () => {
  it('sends POST with JSON body', async () => {
    global.fetch.mockResolvedValueOnce(okJson({ success: true }, 201));

    const result = await api.post('/api/v1/orders/', { table_id: 1 });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/api/v1/orders/`);
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ table_id: 1 }));
    expect(opts.headers['Content-Type']).toBe('application/json');
  });
});

// ─── PATCH / PUT / DELETE ─────────────────────────────────

describe('api.patch()', () => {
  it('sends PATCH with correct body', async () => {
    global.fetch.mockResolvedValueOnce(okJson({ success: true }));

    await api.patch('/api/v1/orders/5/status/', { status: 'PREPARING' });

    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.method).toBe('PATCH');
    expect(opts.body).toBe(JSON.stringify({ status: 'PREPARING' }));
  });
});

describe('api.delete()', () => {
  it('sends DELETE request', async () => {
    global.fetch.mockResolvedValueOnce(okJson({ success: true }));

    await api.delete('/api/v1/orders/5/');

    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.method).toBe('DELETE');
  });
});

// ─── Error handling ───────────────────────────────────────

describe('Error handling', () => {
  it('throws ApiError with status 400 and server message', async () => {
    global.fetch.mockResolvedValueOnce(
      errorJson({ success: false, message: 'Table is not available.' }, 400)
    );

    await expect(api.post('/api/v1/orders/', { table_id: 1 }))
      .rejects.toThrow('Table is not available.');
  });

  it('throws ApiError on network failure', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api.get('/api/v1/orders/'))
      .rejects.toThrow('Network error');
  });

  it('throws ApiError on 503 service suspension with friendly message', async () => {
    global.fetch.mockResolvedValueOnce(htmlResponse(503));

    await expect(api.get('/api/v1/orders/'))
      .rejects.toThrow('starting up or temporarily paused');
  });

  it('returns status code in ApiError', async () => {
    global.fetch.mockResolvedValueOnce(
      errorJson({ message: 'Not found' }, 404)
    );

    try {
      await api.get('/api/v1/orders/999/');
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(404);
    }
  });
});

// ─── Token refresh on 401 ─────────────────────────────────

describe('Token refresh', () => {
  it('attempts refresh when receiving 401 with existing refresh token', async () => {
    // Sequence of SecureStore.getItemAsync calls:
    // 1. getAccessToken() in apiRequest → expired-access
    // 2. getRefreshToken() check → valid-refresh
    // 3. getRefreshToken() inside tryRefreshToken → valid-refresh
    // After refresh: getAccessToken() for retry → new-access
    SecureStore.getItemAsync
      .mockResolvedValueOnce('expired-access')    // 1. access token
      .mockResolvedValueOnce('valid-refresh')      // 2. has refresh check
      .mockResolvedValueOnce('valid-refresh');      // 3. inside tryRefreshToken

    global.fetch
      // Original request: 401
      .mockResolvedValueOnce(errorJson({ detail: 'Token expired' }, 401))
      // Refresh request: success
      .mockResolvedValueOnce(okJson({ access: 'new-access', refresh: 'new-refresh' }))
      // Retry after refresh: success
      .mockResolvedValueOnce(okJson({ success: true, data: { id: 1 } }));

    // After refresh succeeds, retry request needs access token again
    SecureStore.getItemAsync.mockResolvedValueOnce('new-access');

    const result = await api.get('/api/v1/orders/');

    // Should have made 3 fetch calls: original + refresh + retry
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ success: true, data: { id: 1 } });

    // New tokens should be stored
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      expect.any(String),
      'new-access'
    );
  });

  it('clears tokens when refresh fails', async () => {
    SecureStore.getItemAsync
      .mockResolvedValueOnce('expired-access')
      .mockResolvedValueOnce('expired-refresh');

    global.fetch
      .mockResolvedValueOnce(errorJson({ detail: 'Token expired' }, 401))
      .mockResolvedValueOnce(errorJson({ detail: 'Invalid token' }, 401));

    await expect(api.get('/api/v1/orders/'))
      .rejects.toThrow('Session expired');
  });

  it('does NOT attempt refresh when 401 has no refresh token (login failure)', async () => {
    SecureStore.getItemAsync.mockResolvedValueOnce(null); // no access
    SecureStore.getItemAsync.mockResolvedValueOnce(null); // no refresh

    global.fetch.mockResolvedValueOnce(
      errorJson({ success: false, message: 'Invalid credentials.' }, 401)
    );

    await expect(api.post('/api/v1/auth/login/', { username: 'x', password: 'y' }))
      .rejects.toThrow('Invalid credentials');

    // Should NOT have called refresh endpoint
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ─── FormData upload ──────────────────────────────────────

describe('api.upload()', () => {
  it('sends FormData without Content-Type header', async () => {
    global.fetch.mockResolvedValueOnce(okJson({ success: true }));

    const formData = new FormData();
    await api.upload('/api/v1/menu/items/', formData);

    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(formData);
    expect(opts.headers['Content-Type']).toBeUndefined();
  });
});
