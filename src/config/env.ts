// Build-time browser configuration.
//
// The portal runs under two bundlers during the Vite → Next migration, so each
// value is read from BOTH sources and the first defined one wins:
//   • Next.js   → process.env.NEXT_PUBLIC_ADMIN_*  (inlined at build)
//   • Vite      → import.meta.env.VITE_ADMIN_*     (inlined at build)
// Once the Vite entry is removed, only the NEXT_PUBLIC_* names remain.
//
// The Hub URL is the single endpoint you set; the API URL is DISCOVERED from
// the Hub's /echo at boot (the portal blocks until echo resolves).

interface ImportMetaEnv {
  VITE_ADMIN_CONFIG_MODE?: string;
  VITE_ADMIN_PROJECT_ID?: string;
}

// Vite exposes import.meta.env; Next does not (it would be undefined). Guard the
// access so reading it under Next never throws.
const viteEnv: ImportMetaEnv =
  (import.meta as unknown as { env?: ImportMetaEnv }).env ?? {};

/**
 * Pick the Next value (already inlined as a LITERAL by the caller) first, then
 * fall back to the Vite VITE_ADMIN_<suffix>.
 *
 * IMPORTANT: Next.js only inlines `process.env.NEXT_PUBLIC_*` when it appears
 * as a LITERAL member access in the source. A computed access like
 * `process.env[`NEXT_PUBLIC_ADMIN_${suffix}`]` is NOT replaced and always reads
 * `undefined` in the browser bundle. So the literal `process.env.NEXT_PUBLIC_*`
 * reads must live at the call sites below — not behind a dynamic key.
 */
function pick(nextValue: string | undefined, viteSuffix: string): string | undefined {
  if (nextValue) return nextValue;
  return (viteEnv as Record<string, string | undefined>)[`VITE_ADMIN_${viteSuffix}`];
}

// Literal reads so Next can statically inline them. Guard `process` for the
// Vite build where it may be undefined.
const NEXT_CONFIG_MODE =
  typeof process !== 'undefined' && process.env
    ? process.env.NEXT_PUBLIC_ADMIN_CONFIG_MODE
    : undefined;
const NEXT_PROJECT_ID =
  typeof process !== 'undefined' && process.env
    ? process.env.NEXT_PUBLIC_ADMIN_PROJECT_ID
    : undefined;

const env = {
  VITE_ADMIN_CONFIG_MODE: pick(NEXT_CONFIG_MODE, 'CONFIG_MODE'),
  VITE_ADMIN_PROJECT_ID: pick(NEXT_PROJECT_ID, 'PROJECT_ID'),
} satisfies ImportMetaEnv;

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

// ── Gateway access goes through the same-origin server proxy ────────
// The browser NEVER talks to the gateway directly. It calls the portal
// backend's reverse proxy at /api/proxy/{hub|api}/..., and the backend
// re-targets to the real Hub/API (HUB_BASE_URL / API_BASE_URL on the server,
// with fallbacks to hub.norbix.ai / api.norbix.ai). So the browser needs no
// gateway host env at all — these bases are same-origin relative paths.

export const API_VERSION = 'v3';

/** Same-origin proxy root for Hub calls (e.g. /api/proxy/hub/v3). */
export const HUB_ROOT = `/api/proxy/hub/${API_VERSION}`;

/** Same-origin proxy root for API calls (e.g. /api/proxy/api/v3). */
export const API_PROXY_ROOT = `/api/proxy/api/${API_VERSION}`;

/** Bare API proxy base (no version) for the SDK, which appends {version}. */
export const API_PROXY_BASE = '/api/proxy/api';

/** Bare Hub proxy base (no version) for the SDK. */
export const HUB_PROXY_BASE = '/api/proxy/hub';

// Static-config skip-remote heuristic used `HAS_CUSTOM_HUB_BASE` before; with
// the proxy there is no custom hub base, so dynamic config always runs in dev.
export const HAS_CUSTOM_HUB_BASE = false;

/** Optional build-time project pin (self-hosted custom-domain builds). */
export const PINNED_PROJECT_ID: string | undefined =
  env.VITE_ADMIN_PROJECT_ID && env.VITE_ADMIN_PROJECT_ID.length > 0
    ? env.VITE_ADMIN_PROJECT_ID
    : undefined;

// IS_DEV = "is this a local development BUILD" (NODE_ENV !== 'production').
// It only toggles developer conveniences: Redux DevTools and the skip-remote
// config heuristic. It is NOT the Norbix project environment (PROD / staging /
// test) — that is the `norbix-env` header, set from the server `ENV` var
// (self-hosted) or derived from the host (managed). The two are unrelated.
export const IS_DEV: boolean =
  Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) ||
  (typeof process !== 'undefined' &&
    process.env?.NODE_ENV !== 'production');
