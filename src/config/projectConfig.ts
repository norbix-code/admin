// Resolves the public ProjectConfig (brand + auth) for the current project and
// applies branding to the design tokens.
//
// The portal starts from neutral defaults, asks the public config endpoint
// (GET /public/projects/{id}/config) and lets the answer override them. When
// the call fails the defaults stand, so the portal always renders.
//
// What the endpoint returns is gated server-side by two opt-in flags
// (Cloud → Membership → Access): brand (default ON) and the sensitive auth
// detail — methods + passwordPolicy (default OFF). Social providers + passkey
// yes/no are always safe to return. When auth detail is not exposed, the
// portal uses the defaults below (email + minLength-6 policy), which match the
// Membership default password rule (at least 6 characters, nothing else).
//
// Brand mapping (conservative): the Hub MainColor becomes the primary accent;
// AccentColor a secondary; everything else stays neutral grey/white.

import type {
  ProjectBranding,
  ProjectConfig,
  ProjectConfigBody,
  SocialProviderId,
  PublicSocialSignIn,
  AuthMethod,
  PasswordPolicy,
} from '@/types/projectConfig';
import { getRuntimeApiRoot } from './runtimeApi';
import { setProjectHeaders } from './project';

// ── Neutral defaults ────────────────────────────────────────────────
// Grey / white / Norbix-blue, used conservatively. These render when no Hub
// brand is available and as the base that Hub brand overrides.
//
// The auth defaults are what the portal shows when a project does NOT expose
// its auth settings: email login + a default password policy of minLength 6
// (matching the Membership default rule), no socials, no passkey.
export const DEFAULT_PASSWORD_POLICY = { minLength: 6 };

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

const NEUTRAL_DEFAULTS: ProjectConfigBody = {
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
    socialSignIn: [],
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
  base: ProjectConfigBody,
  override: Partial<ProjectConfigBody> | null,
): ProjectConfigBody {
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
// `socialProviders`, `socialSignIn` + `passkey` are always present (safe to
// expose: a visitor sees the sign-in buttons anyway; no client id or secret).
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
    socialSignIn?: PublicSocialSignIn[] | null;
    passkey?: boolean;
    methods?: AuthMethod[] | null;
    passwordPolicy?: PasswordPolicy | null;
  };
}

async function loadDynamicConfig(
  projectId: string,
): Promise<Partial<ProjectConfigBody> | null> {
  const url = `${getRuntimeApiRoot()}/public/projects/${projectId}/config`;
  const res = await fetch(url, {
    headers: setProjectHeaders(new Headers(), projectId),
  });
  if (!res.ok) return null;
  const r = (await res.json()) as PublicConfigResponse;

  const out: Partial<ProjectConfigBody> = {};

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
    socialSignIn: r.auth?.socialSignIn ?? [],
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
  const cached = readCache(projectId);
  if (cached) return cached;

  let resolved = NEUTRAL_DEFAULTS;
  try {
    const remote = await loadDynamicConfig(projectId);
    if (remote) resolved = merge(resolved, remote);
  } catch {
    /* endpoint unavailable — the defaults stand */
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
