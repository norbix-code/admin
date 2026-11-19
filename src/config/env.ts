// Fixed browser-side values. Nothing here comes from the environment: the
// project and the Norbix addresses are server settings (see app/lib).

export const API_VERSION = 'v3';

// The browser never calls Norbix directly. It calls the portal's own proxy
// (app/api/proxy), which forwards to the Hub and the API.

/** Proxy root for Hub calls, with the version: /api/proxy/hub/v3. */
export const HUB_ROOT = `/api/proxy/hub/${API_VERSION}`;

/** Proxy root for API calls, with the version: /api/proxy/api/v3. */
export const API_PROXY_ROOT = `/api/proxy/api/${API_VERSION}`;

/** Proxy base for the SDK, which adds the version itself. */
export const API_PROXY_BASE = '/api/proxy/api';

/** Proxy base for the SDK, which adds the version itself. */
export const HUB_PROXY_BASE = '/api/proxy/hub';

/**
 * True in a development build (`npm run dev`). Turns on Redux DevTools and
 * console logging of failed requests. Not the project environment (PROD /
 * staging / test) — that is the server's ENV setting.
 */
export const IS_DEV: boolean = process.env.NODE_ENV !== 'production';
