// Build-time configuration, read from Vite's import.meta.env.
//
// The Hub URL is the single required endpoint: on boot the portal calls the
// Hub's GET /{version}/echo, which returns the API URL, regions, release, and
// license. So the API URL is normally DISCOVERED, not configured — the env
// API values below are only a fallback when echo is unavailable.

interface ImportMetaEnv {
  VITE_ADMIN_CONFIG_MODE?: string;
  VITE_ADMIN_HUB_BASE_URL?: string;
  VITE_ADMIN_HUB_VERSION?: string;
  VITE_ADMIN_PROJECT_ID?: string;
}

const env = (import.meta as unknown as { env: ImportMetaEnv }).env;

// Release/runtime (ManagedService | SelfHosted | Enterprise) is NOT configured
// here — it is discovered from the Hub's /echo response at boot (see the config
// slice `selectRelease`). The portal blocks until echo resolves, so there is no
// need to hardcode it.

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

// ── API ─────────────────────────────────────────────────────────────
// The API base is NOT configured — it is ALWAYS discovered from the Hub's
// /echo response (echo.apiUrl, already versioned). The portal blocks the UI
// until echo resolves (see App boot), so there is no env override and no
// pre-echo fallback: nothing calls the API before echo is in.

/** Default API version used only until /echo returns its own apiVersion. */
export const API_VERSION = 'v3';

/** Optional build-time project pin (self-hosted custom-domain builds). */
export const PINNED_PROJECT_ID: string | undefined =
  env.VITE_ADMIN_PROJECT_ID && env.VITE_ADMIN_PROJECT_ID.length > 0
    ? env.VITE_ADMIN_PROJECT_ID
    : undefined;

/** True only during `vite dev`. Used to enable local dev conveniences. */
export const IS_DEV: boolean = Boolean(
  (import.meta as unknown as { env: { DEV?: boolean } }).env.DEV,
);
