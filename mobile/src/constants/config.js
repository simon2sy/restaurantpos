// API Configuration
// ────────────────────────────────────────────────────────────
// PRODUCTION  – uncomment the Render URL for APK builds
// LOCAL DEV   – use your LAN IP for Expo Go on same WiFi
// ────────────────────────────────────────────────────────────
export const API_BASE_URL = 'https://restaurantpos-m2kl.onrender.com'; // Production (Render)
// export const API_BASE_URL = 'http://192.168.100.104:8000'; // Local dev (Expo Go)
// export const API_BASE_URL = 'http://10.0.2.2:8000'; // Android emulator
// export const API_BASE_URL = 'http://localhost:8000'; // iOS simulator

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

// WebSocket base URL derived from the API host (http:// -> ws://, https -> wss://)
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws') + '/ws';

// Token configuration
export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';

// Timeouts
export const REQUEST_TIMEOUT = 30000; // 30 seconds

// Pagination
export const DEFAULT_PAGE_SIZE = 50;
