// Build-time configuration, read from Vite's import.meta.env.
//
// The Hub URL is the single required endpoint: on boot the portal calls the
// Hub's GET /{version}/echo, which returns the API URL, regions, release, and
// license. So the API URL is normally DISCOVERED, not configured — the env
// API values below are only a fallback when echo is unavailable.

export type AdminRelease = 'ManagedService' | 'SelfHosted' | 'Enterprise';

interface ImportMetaEnv {
  VITE_ADMIN_RELEASE?: string;
  VITE_ADMIN_CONFIG_MODE?: string;
  VITE_ADMIN_HUB_BASE_URL?: string;
  VITE_ADMIN_HUB_VERSION?: string;
  VITE_ADMIN_API_BASE_URL?: string;
  VITE_ADMIN_API_VERSION?: string;
  VITE_ADMIN_PROJECT_ID?: string;
}

const env = (import.meta as unknown as { env: ImportMetaEnv }).env;

export const ADMIN_RELEASE: AdminRelease =
  (env.VITE_ADMIN_RELEASE as AdminRelease) || 'ManagedService';

// ── Config mode (brand + auth resolution) ───────────────────────────
// 'static'  → load brand + auth ENTIRELY from the bundled per-project config;
//             never call the public endpoint. For forkers who want full control
//             and the fastest first paint (no network round-trip).
// 'dynamic' → start from the neutral defaults, call the public endpoint, and
//             override with whatever the Hub returns (the project's Brand
//             colors, logo, enabled auth providers). If the call fails, the
//             defaults stand. This is the default.
export type AdminConfigMode = 'static' | 'dynamic';

export const CONFIG_MODE: AdminConfigMode =
  (env.VITE_ADMIN_CONFIG_MODE as AdminConfigMode) === 'static'
    ? 'static'
    : 'dynamic';

// ── Hub (entry point) ───────────────────────────────────────────────
const DEFAULT_HUB_BASE_URL = 'https://hub.norbix.ai';

export const HUB_BASE_URL: string =
  env.VITE_ADMIN_HUB_BASE_URL || DEFAULT_HUB_BASE_URL;

export const HUB_VERSION: string = env.VITE_ADMIN_HUB_VERSION || 'v3';

/** Full Hub root, e.g. https://hub.norbix.ai/v3 — used for the /echo call. */
export const HUB_ROOT = `${HUB_BASE_URL.replace(/\/$/, '')}/${HUB_VERSION}`;

export const HAS_CUSTOM_HUB_BASE: boolean = Boolean(
  env.VITE_ADMIN_HUB_BASE_URL && env.VITE_ADMIN_HUB_BASE_URL.length > 0,
);

// ── API (normally discovered from echo; env is a fallback) ──────────
const DEFAULT_API_BASE_URL = 'https://api.norbix.ai';

export const API_BASE_URL: string =
  env.VITE_ADMIN_API_BASE_URL || DEFAULT_API_BASE_URL;

export const API_VERSION: string = env.VITE_ADMIN_API_VERSION || 'v3';

/** True when the operator explicitly set an API base (vs. the prod default). */
export const HAS_CUSTOM_API_BASE: boolean = Boolean(
  env.VITE_ADMIN_API_BASE_URL && env.VITE_ADMIN_API_BASE_URL.length > 0,
);

/** Fallback API root when echo hasn't resolved (e.g. https://api.norbix.ai/v3). */
export const API_ROOT_FALLBACK = `${API_BASE_URL.replace(/\/$/, '')}/${API_VERSION}`;

/** Optional build-time project pin (self-hosted custom-domain builds). */
export const PINNED_PROJECT_ID: string | undefined =
  env.VITE_ADMIN_PROJECT_ID && env.VITE_ADMIN_PROJECT_ID.length > 0
    ? env.VITE_ADMIN_PROJECT_ID
    : undefined;

/** Static-config-first when not managed service. */
export const PREFER_STATIC_CONFIG = ADMIN_RELEASE !== 'ManagedService';

/** True only during `vite dev`. Used to enable local dev conveniences. */
export const IS_DEV: boolean = Boolean(
  (import.meta as unknown as { env: { DEV?: boolean } }).env.DEV,
);
