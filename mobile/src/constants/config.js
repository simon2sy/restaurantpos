// API Configuration
// ────────────────────────────────────────────────────────────
// PRODUCTION  – Render
// LOCAL DEV   – use your LAN IP for Expo Go on same WiFi
// ────────────────────────────────────────────────────────────
// export const API_BASE_URL = 'https://pos.trustnepalsuppliers.com'; // Production (DirectAdmin)
<<<<<<< HEAD
// export const API_BASE_URL = 'https://restaurantpos-1bmq.onrender.com'; // Production (Render)
export const API_BASE_URL = 'http://192.168.100.38:8000'; // Local dev (Expo Go) — your current LAN IP
=======
export const API_BASE_URL = 'https://restaurantpos-1bmq.onrender.com'; // Production (Render)
// export const API_BASE_URL = 'http://192.168.100.104:8000'; // Local dev (Expo Go) — your current LAN IP
>>>>>>> eb3f16e1ac2df291645ae1c9aea13db89ea5ac68
// export const API_BASE_URL = 'http://10.0.2.2:8000'; // Android emulator
// export const API_BASE_URL = 'http://localhost:8000'; // iOS simulator / Local dev
// ⚠️  IMPORTANT: Django MUST run on 0.0.0.0:8000 for Expo Go to connect!
//     Run: python manage.py runserver 0.0.0.0:8000
//     (Default runserver only listens on 127.0.0.1, which blocks phone requests)

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;
 
// WebSocket base URL derived from the API host (http:// -> ws://, https -> wss://)
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws') + '/ws';

// Token configuration
export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const RESTAURANT_DATA_KEY = 'restaurant_data';

// Timeouts
export const REQUEST_TIMEOUT = 30000; // 30 seconds

// Pagination
export const DEFAULT_PAGE_SIZE = 50;

// Sentry (set in .env or leave empty to disable)
export const SENTRY_DSN = '';
