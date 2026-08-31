import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, API_PREFIX, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, REQUEST_TIMEOUT } from '../constants/config';

/**
 * Centralized API client.
 * Handles: base URL, auth headers, token refresh, errors, timeouts.
 * Never store secrets — only the API base URL goes here.
 */

// Queue for concurrent token refresh requests
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

async function setTokens(access, refresh) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
}

async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

/**
 * Flattens DRF-style error payloads like
 * { "non_field_errors": ["Table is not available."] } or
 * { "items": [ { "quantity": ["A valid integer is required."] } ] }
 * into one readable line for the user.
 */
function extractDrfMessage(data) {
  if (!data || typeof data !== 'object') return null;
  const parts = [];
  const walk = (value) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
    } else {
      parts.push(String(value));
    }
  };
  walk(data);
  return parts.length ? parts.join('. ') : null;
}

/**
 * Core fetch wrapper with auth and error handling.
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    Accept: 'application/json',
    ...options.headers,
  };
  // FormData sets its own multipart Content-Type with boundary
  if (!options._skipJsonHeader) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach access token
  const token = await getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle 401 — attempt token refresh
    if (response.status === 401 && !options._isRetry) {
      // If we have a refresh token, this may be an expired access token — try refresh.
      // Otherwise it's just bad credentials on login — surface the real error.
      const hasRefresh = !!(await getRefreshToken());
      const refreshResult = hasRefresh ? await tryRefreshToken() : false;
      if (refreshResult) {
        // Retry the original request with new token
        return apiRequest(endpoint, { ...options, _isRetry: true });
      }
      if (hasRefresh) {
        // Refresh failed — clear tokens
        await clearTokens();
        throw new ApiError('Session expired. Please log in again.', 401);
      }
      // No refresh token — this is a login/credential failure. Fall through
      // so the API's real message (e.g. "Invalid credentials") is shown.
    }

    // Parse JSON response
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      // The server returned a non-JSON body (typically an HTML page).
      // This most often happens on Render free-tier: when the service has
      // gone to sleep it replies to every request with a "service suspended"
      // 503 HTML page instead of routing to Django. Flatten these into one
      // clear, human-friendly message instead of dumping raw HTML.
      const isHtml = typeof data === 'string' && /^\s*</.test(data);
      const isSuspension =
        response.status === 503 ||
        response.status === 502 ||
        (isHtml && /service (unavailable|suspended|temporarily)/i.test(data));

      let message;
      if (isSuspension) {
        message =
          'The backend is starting up or temporarily paused. ' +
          'Please wait a few seconds and try again.';
      } else {
        message =
          data?.message ||
          data?.detail ||
          (typeof data === 'string'
            ? data
            : extractDrfMessage(data) || `Request failed (${response.status})`);
      }
      throw new ApiError(message, response.status, data?.errors);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your connection.', 408);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Network error. Please check your connection.', 0);
  }
}

/**
 * Attempt to refresh the JWT access token.
 *
 * POSTs the refresh token to simplejwt's TokenRefreshView.
 * simplejwt returns { access: "...", refresh: "..." } (with rotation).
 */
async function tryRefreshToken() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  // If a refresh is already in flight, queue this caller
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    const url = `${API_BASE_URL}${API_PREFIX}/auth/refresh/`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      processQueue(new Error('Refresh failed'));
      return false;
    }

    // simplejwt TokenRefreshView returns { access, refresh } at top level
    // (refresh is present when SIMPLE_JWT.ROTATE_REFRESH_TOKENS = True)
    const data = await response.json();
    const newAccess = data?.access;
    const newRefresh = data?.refresh || refreshToken;

    if (newAccess) {
      await setTokens(newAccess, newRefresh);
      processQueue(null, newAccess);
      return true;
    }

    processQueue(new Error('Refresh failed'));
    return false;
  } catch (e) {
    processQueue(e);
    return false;
  } finally {
    isRefreshing = false;
  }
}

// ============================================================
// CUSTOM ERROR CLASS
// ============================================================

export class ApiError extends Error {
  constructor(message, status, errors = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

// ============================================================
// HTTP METHOD WRAPPERS
// ============================================================

export const api = {
  get: (endpoint, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return apiRequest(url, { method: 'GET' });
  },

  post: (endpoint, body = {}) =>
    apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Multipart upload (FormData) — lets the browser/RN set the Content-Type
  // boundary itself, with the auth header still attached.
  upload: (endpoint, formData) => {
    const headers = {};
    delete headers['Content-Type'];
    return apiRequest(endpoint, {
      method: 'POST',
      headers,
      body: formData,
      _skipJsonHeader: true,
    });
  },

  put: (endpoint, body = {}) =>
    apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: (endpoint, body = {}) =>
    apiRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (endpoint) =>
    apiRequest(endpoint, { method: 'DELETE' }),
};

export { setTokens, clearTokens, getAccessToken };
