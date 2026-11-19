// Resolves the public ProjectConfig (brand + auth) for the current project and
// applies branding to the design tokens.
//
// The portal starts from neutral defaults, asks the public config endpoint
// (GET /public/projects/{id}/config) and lets the answer override them. When
// the call fails the defaults stand, so the portal always renders.
//
// The endpoint returns brand, sign-in methods, password rules, social
// providers and passkey yes/no. A missing field (no password flow, an older
// gateway) keeps the defaults below (email + minLength-6 policy), which match
// the Membership default password rule (at least 6 characters, nothing else).
//
// Brand mapping (conservative): the Hub MainColor becomes the primary accent;
// AccentColor a secondary; everything else stays neutral grey/white.

import type {
  ProjectBranding,
  ProjectConfig,
  ProjectConfigBody,
  PublicAiChat,
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
// The auth defaults are what the portal shows when the answer has no auth
// detail: email login + a default password policy of minLength 6
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
    fromProject: false,
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
    aiChat: override.aiChat ?? base.aiChat,
  };
}

// Shape of GET /public/projects/{id}/config. Everything in it is what a
// sign-in page shows anyway; no client id or secret.
interface PublicConfigResponse {
  // The readable project name. Used as the page title.
  displayName?: string;
  branding?: {
    displayName?: string;
    mainColor?: string;
    accentColor?: string;
    logoUrl?: string;
    iconUrl?: string;
  } | null;
  // End-user AI chat: on/off + assistants (id, name, welcome). The
  // assistants list is empty while the chat is off. Absent on older gateways.
  aiChat?: {
    enabled?: boolean;
    assistants?: { id?: string; name?: string; welcome?: string | null }[];
  } | null;
  auth?: {
    socialProviders?: SocialProviderId[];
    socialSignIn?: PublicSocialSignIn[] | null;
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
): Promise<Partial<ProjectConfigBody> | null> {
  const url = `${getRuntimeApiRoot()}/public/projects/${projectId}/config`;
  const res = await fetch(url, {
    headers: setProjectHeaders(new Headers(), projectId),
  });
  if (!res.ok) return null;
  const r = (await res.json()) as PublicConfigResponse;

  const out: Partial<ProjectConfigBody> = {};

  if (r.aiChat) out.aiChat = toAiChat(r.aiChat);

  // The readable project name comes back top-level. Brand colors/logo are
  // merged only when present.
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

  // Auth: take what the server sent; keep the defaults for what is missing.
  const authFromProject = Boolean(r.auth?.methods || r.auth?.passwordPolicy);
  out.auth = {
    socialProviders:
      r.auth?.socialProviders ?? NEUTRAL_DEFAULTS.auth.socialProviders,
    socialSignIn: r.auth?.socialSignIn ?? [],
    passkey: r.auth?.passkey ?? NEUTRAL_DEFAULTS.auth.passkey,
    methods: r.auth?.methods ?? NEUTRAL_DEFAULTS.auth.methods,
    passwordPolicy:
      r.auth?.passwordPolicy ?? NEUTRAL_DEFAULTS.auth.passwordPolicy,
    fromProject: authFromProject,
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
