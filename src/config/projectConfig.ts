// Resolves the public ProjectConfig (brand + auth) for the current project and
// applies branding to the design tokens.
//
// Precedence (see docs/login-resolution.md):
//   1. CONFIG_MODE = 'static'  → load entirely from the bundled per-project
//      config (config/projects/{id}.json). No endpoint call. Forkers' fast path.
//   2. CONFIG_MODE = 'dynamic' (default) → start from NEUTRAL DEFAULTS, fetch
//      the public /config (brand + auth, gated by the project's opt-in flags),
//      and override. If the call fails, the defaults stand — always renders.
//
// What the endpoint returns is gated server-side by two opt-in flags
// (Cloud → Membership → Access): brand (default ON) and the sensitive auth
// detail — methods + passwordPolicy (default OFF). Social providers + passkey
// yes/no are always safe to return. When auth detail is not exposed, the
// portal uses the defaults below (email + minLength-3 policy), which match the
// Hub PasswordComplexity default.
//
// Brand mapping (conservative): the Hub MainColor becomes the primary accent;
// AccentColor a secondary; everything else stays neutral grey/white.

import type {
  ProjectConfig,
  StaticProjectConfig,
  SocialProviderId,
  AuthMethod,
  PasswordPolicy,
} from '@/types/projectConfig';
import { CONFIG_MODE, IS_DEV, HAS_CUSTOM_HUB_BASE } from './env';
import { getRuntimeApiRoot } from './runtimeApi';

// ── Neutral defaults ────────────────────────────────────────────────
// Grey / white / Norbix-blue, used conservatively. These render when no Hub
// brand is available and as the base that Hub brand overrides.
//
// The auth defaults are what the portal shows when a project does NOT expose
// its auth settings: email login + a default password policy of minLength 3
// (matching the Hub PasswordComplexity default), no socials, no passkey.
const DEFAULT_PASSWORD_POLICY = { minLength: 3 };

const NEUTRAL_DEFAULTS: StaticProjectConfig = {
  branding: {
    // Neutral placeholder used only before the project config resolves (or when
    // the project is unknown). Once the public config loads, the readable
    // project name replaces this — see loadDynamicConfig.
    displayName: 'Sign in',
    // mainColor intentionally unset → the token default (#0a558c Norbix blue)
    // applies; the Hub MainColor overrides it when present.
  },
  auth: {
    socialProviders: [],
    passkey: false,
    methods: ['email'],
    passwordPolicy: DEFAULT_PASSWORD_POLICY,
    exposed: false,
  },
  links: {},
};

const CACHE_KEY = (projectId: string) =>
  `norbix.admin.projectConfig.${projectId}`;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Static configs bundled from /config/projects/*.json (filename = project id).
const staticModules = import.meta.glob<{ default: StaticProjectConfig }>(
  '../../config/projects/*.json',
);

function staticPathFor(projectId: string): string | undefined {
  return Object.keys(staticModules).find((p) =>
    p.endsWith(`/${projectId}.json`),
  );
}

async function loadStatic(
  projectId: string,
): Promise<StaticProjectConfig | null> {
  const path = staticPathFor(projectId);
  if (!path) return null;
  const mod = await staticModules[path]();
  return mod.default;
}

function readCache(projectId: string): ProjectConfig | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; config: ProjectConfig };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.config;
  } catch {
    return null;
  }
}

function writeCache(projectId: string, config: ProjectConfig): void {
  try {
    localStorage.setItem(
      CACHE_KEY(projectId),
      JSON.stringify({ at: Date.now(), config }),
    );
  } catch {
    /* ignore quota / disabled storage */
  }
}

/** Shallow-merge an override config over a base (per top-level section). */
function merge(
  base: StaticProjectConfig,
  override: Partial<StaticProjectConfig> | null,
): StaticProjectConfig {
  if (!override) return base;
  return {
    branding: { ...base.branding, ...(override.branding ?? {}) },
    auth: { ...base.auth, ...(override.auth ?? {}) },
    links: { ...base.links, ...(override.links ?? {}) },
  };
}

// Shape of GET /public/projects/{id}/config. The server gates fields by the
// project's two opt-in flags: `branding` is null unless brand is exposed;
// `auth.methods` / `auth.passwordPolicy` are null unless auth is exposed.
// `socialProviders` + `passkey` are always present (safe to expose).
interface PublicConfigResponse {
  // The readable project name — NOT brand-gated, so it's present even when the
  // project does not expose its brand colors/logo. Used as the page title.
  displayName?: string;
  branding?: {
    displayName?: string;
    mainColor?: string;
    accentColor?: string;
    logoUrl?: string;
    iconUrl?: string;
  } | null;
  auth?: {
    socialProviders?: SocialProviderId[];
    passkey?: boolean;
    methods?: AuthMethod[] | null;
    passwordPolicy?: PasswordPolicy | null;
  };
}

async function loadDynamicConfig(
  projectId: string,
): Promise<Partial<StaticProjectConfig> | null> {
  const url = `${getRuntimeApiRoot()}/public/projects/${projectId}/config`;
  const res = await fetch(url, { headers: { 'X-Norbix-Project': projectId } });
  if (!res.ok) return null;
  const r = (await res.json()) as PublicConfigResponse;

  const out: Partial<StaticProjectConfig> = {};

  // The readable project name comes back top-level (not brand-gated). Prefer it
  // for the display name so the portal shows the project title even when brand
  // colors/logo are NOT exposed. Brand colors/logo are merged only when present.
  const projectName =
    r.displayName ||
    r.branding?.displayName ||
    NEUTRAL_DEFAULTS.branding.displayName;

  out.branding = {
    displayName: projectName,
    mainColor: r.branding?.mainColor,
    accentColor: r.branding?.accentColor,
    logoUrl: r.branding?.logoUrl || undefined,
    iconUrl: r.branding?.iconUrl || undefined,
  };

  // Auth: always take the safe parts; take the sensitive parts only if the
  // server exposed them (else keep the defaults).
  const authExposed = Boolean(r.auth?.methods || r.auth?.passwordPolicy);
  out.auth = {
    socialProviders:
      r.auth?.socialProviders ?? NEUTRAL_DEFAULTS.auth.socialProviders,
    passkey: r.auth?.passkey ?? NEUTRAL_DEFAULTS.auth.passkey,
    methods: r.auth?.methods ?? NEUTRAL_DEFAULTS.auth.methods,
    passwordPolicy:
      r.auth?.passwordPolicy ?? NEUTRAL_DEFAULTS.auth.passwordPolicy,
    exposed: authExposed,
  };

  return out;
}

/**
 * Resolve the project config. Always returns a usable config (never null) —
 * the neutral defaults guarantee the portal renders even with no project data.
 */
export async function loadProjectConfig(
  projectId: string,
): Promise<ProjectConfig> {
  // 1. Static mode: bundled config only, no network.
  if (CONFIG_MODE === 'static') {
    const fromStatic = await loadStatic(projectId);
    const resolved = merge(NEUTRAL_DEFAULTS, fromStatic);
    return { projectId, ...resolved };
  }

  // 2. Dynamic mode. Serve a fresh-enough cache if present.
  const cached = readCache(projectId);
  if (cached) return cached;

  // Start from defaults, layer a bundled static entry (if any), then the
  // public endpoint (brand + safe auth always; sensitive auth only if exposed).
  let resolved = merge(NEUTRAL_DEFAULTS, await loadStatic(projectId));

  const skipRemote = IS_DEV && !HAS_CUSTOM_HUB_BASE;
  if (!skipRemote) {
    try {
      const remote = await loadDynamicConfig(projectId);
      if (remote) resolved = merge(resolved, remote);
    } catch {
      /* endpoint unavailable — defaults (+ static) stand */
    }
  }

  const config: ProjectConfig = { projectId, ...resolved };
  writeCache(projectId, config);
  return config;
}

// ── Apply branding to the design tokens ─────────────────────────────
function setVar(name: string, value?: string): void {
  if (value) document.documentElement.style.setProperty(name, value);
}

/** Simple darken for the primary-hover token (mix toward black ~12%). */
function darken(hex: string, amount = 0.12): string | undefined {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Map the project's Hub Brand onto the CSS design tokens. Only sets a token
 * when the brand provides a value, so unset fields keep the neutral default.
 * Also sets the favicon from the brand icon.
 */
export function applyBranding(config: ProjectConfig): void {
  if (typeof document === 'undefined') return;
  const b = config.branding;

  if (b.mainColor) {
    setVar('--admin-primary', b.mainColor);
    setVar('--admin-primary-hover', darken(b.mainColor));
  }
  setVar('--admin-accent', b.accentColor);

  if (b.iconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = b.iconUrl;
  }
}
