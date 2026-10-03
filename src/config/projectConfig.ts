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
  ProjectBranding,
  ProjectConfig,
  PublicAiChat,
  StaticProjectConfig,
  SocialProviderId,
  AuthMethod,
  PasswordPolicy,
} from '@/types/projectConfig';
import { CONFIG_MODE } from './env';
import { getRuntimeApiRoot } from './runtimeApi';
import { setProjectHeaders } from './project';

// ── Neutral defaults ────────────────────────────────────────────────
// Grey / white / Norbix-blue, used conservatively. These render when no Hub
// brand is available and as the base that Hub brand overrides.
//
// The auth defaults are what the portal shows when a project does NOT expose
// its auth settings: email login + a default password policy of minLength 3
// (matching the Hub PasswordComplexity default), no socials, no passkey.
const DEFAULT_PASSWORD_POLICY = { minLength: 3 };

/** Placeholder `displayName` used until (or unless) a project name resolves. */
export const PLACEHOLDER_DISPLAY_NAME = 'Sign in';

/**
 * The project's readable name, or undefined while only the placeholder is
 * known. The sidebar and the browser tab use it; they must not say "Sign in".
 */
export function projectNameOf(
  branding?: ProjectBranding | null,
): string | undefined {
  const name = branding?.displayName?.trim();
  return name && name !== PLACEHOLDER_DISPLAY_NAME ? name : undefined;
}

const NEUTRAL_DEFAULTS: StaticProjectConfig = {
  branding: {
    // Neutral placeholder used only before the project config resolves (or when
    // the project is unknown). Once the public config loads, the readable
    // project name replaces this — see loadDynamicConfig.
    displayName: PLACEHOLDER_DISPLAY_NAME,
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
// `import.meta.glob` is a Vite-only compile-time macro; under Next it is
// undefined, so the static-config fast path is simply unavailable there (the
// dynamic public-endpoint path is used instead). Guard the access so the module
// loads under both bundlers.
type StaticModuleMap = Record<
  string,
  () => Promise<{ default: StaticProjectConfig }>
>;

const staticModules: StaticModuleMap = (() => {
  const glob = (import.meta as unknown as { glob?: unknown }).glob;
  if (typeof glob !== 'function') return {};
  return (glob as (p: string) => StaticModuleMap)(
    '../../config/projects/*.json',
  );
})();

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
    adminPortalEnabled: override.adminPortalEnabled ?? base.adminPortalEnabled,
    aiChat: override.aiChat ?? base.aiChat,
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
  // Coarse on/off bit for the managed portal (always-safe). Absent on older
  // gateways → treat as enabled (don't lock out before the flag ships).
  adminPortalEnabled?: boolean;
  branding?: {
    displayName?: string;
    mainColor?: string;
    accentColor?: string;
    logoUrl?: string;
    iconUrl?: string;
  } | null;
  // End-user AI chat (item N): on/off + assistants (id, name, welcome). The
  // assistants list is empty while the chat is off. Absent on older gateways.
  aiChat?: {
    enabled?: boolean;
    assistants?: { id?: string; name?: string; welcome?: string | null }[];
  } | null;
  auth?: {
    socialProviders?: SocialProviderId[];
    passkey?: boolean;
    methods?: AuthMethod[] | null;
    passwordPolicy?: PasswordPolicy | null;
  };
}

/** Normalise the public `aiChat` section; off unless it says enabled. */
export function toAiChat(
  raw: NonNullable<PublicConfigResponse['aiChat']>,
): PublicAiChat {
  const enabled = raw.enabled === true;
  return {
    enabled,
    assistants: enabled
      ? (raw.assistants ?? [])
          .filter((a) => a.id)
          .map((a) => ({
            id: a.id!,
            name: a.name || 'Assistant',
            welcome: a.welcome || undefined,
          }))
      : [],
  };
}

async function loadDynamicConfig(
  projectId: string,
): Promise<Partial<StaticProjectConfig> | null> {
  const url = `${getRuntimeApiRoot()}/public/projects/${projectId}/config`;
  const res = await fetch(url, {
    headers: setProjectHeaders(new Headers(), projectId),
  });
  if (!res.ok) return null;
  const r = (await res.json()) as PublicConfigResponse;

  const out: Partial<StaticProjectConfig> = {};

  // Coarse managed-portal on/off flag. Absent (older gateway) → undefined here,
  // which merge() leaves as the default (enabled) so we never lock out the app
  // before the flag exists server-side.
  if (typeof r.adminPortalEnabled === 'boolean') {
    out.adminPortalEnabled = r.adminPortalEnabled;
  }

  if (r.aiChat) out.aiChat = toAiChat(r.aiChat);

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

  // Always ask the endpoint, dev builds included: the same-origin proxy is
  // always there (env.ts). Skipping it in dev hid brand, auth and the AI chat.
  try {
    const remote = await loadDynamicConfig(projectId);
    if (remote) resolved = merge(resolved, remote);
  } catch {
    /* endpoint unavailable — defaults (+ static) stand */
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
 * Also sets the favicon from the brand icon and the tab title from the name.
 */
export function applyBranding(config: ProjectConfig): void {
  if (typeof document === 'undefined') return;
  const b = config.branding;

  if (b.mainColor) {
    setVar('--admin-primary', b.mainColor);
    setVar('--admin-primary-hover', darken(b.mainColor));
  }
  setVar('--admin-accent', b.accentColor);

  // Browser tab: the project name once known. Until then (and when the boot
  // never resolves a project) the static metadata title "Admin Portal" stays.
  const name = projectNameOf(b);
  if (name) document.title = name;

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
