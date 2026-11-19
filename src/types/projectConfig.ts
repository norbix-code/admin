// Public, unauthenticated project configuration that drives the portal's look
// (brand) and the login screen (auth). Sourced from the Hub project's Brand +
// membership settings via the public config endpoint.
//
// The endpoint returns the brand, the sign-in methods, the password rules,
// the social providers and passkey yes/no. A field that is missing (a project
// with no password flow, an older gateway) falls back to the portal's
// defaults: email/password + the default password policy (minLength 6,
// matching the Membership default rule).

export type SocialProviderId =
  | 'google'
  | 'github'
  | 'facebook'
  | 'apple'
  | 'microsoft';

/** Identifier methods a project's auth flows accept. */
export type AuthMethod = 'email' | 'phone' | 'username';

/** Password policy the UI mirrors. */
export interface PasswordPolicy {
  minLength: number;
  maxLength?: number;
  minNumbers?: number;
  minUpper?: number;
  minLower?: number;
  minSpecial?: number;
  allowedSpecial?: string;
}

/** Brand palette + assets from the Hub project Brand settings. */
export interface ProjectBranding {
  displayName: string;
  mainColor?: string; // Hub Brand.MainColor  → --admin-primary (+hover)
  accentColor?: string; // Hub Brand.AccentColor → --admin-accent
  logoUrl?: string; // Hub Brand.Logo  → login + header
  iconUrl?: string; // Hub Brand.Icon  → favicon
  backgroundUrl?: string;
}

/**
 * One social sign-in button from the public config (`auth.socialSignIn`, the
 * ENABLED social sign-in integrations of the env). Never a client id or a
 * secret.
 */
export interface PublicSocialSignIn {
  /** `google` / `apple` / `microsoft` / `github` / `facebook` / `x` / `okta`. */
  provider: string;
  /** The provider's name for the button, e.g. "GitHub". */
  displayName: string;
  /**
   * Relative to the API host, e.g.
   * `/v3/membership/auth/social/google?projectId=pr_…` (`&env=` when not
   * PROD). The portal adds `&returnUrl=`.
   */
  startPath: string;
}

export interface ProjectAuthOptions {
  /**
   * Which social providers exist (always returned). Older field; the buttons
   * come from `socialSignIn`, which says how to start each one.
   */
  socialProviders: SocialProviderId[];
  /**
   * The social sign-in buttons (always returned). Absent → no buttons.
   */
  socialSignIn?: PublicSocialSignIn[];
  /** Whether a passkey flow is configured (always returned). */
  passkey: boolean;
  /** Identifier methods; defaults when the project has none. */
  methods: AuthMethod[];
  /** Password rules to mirror in the UI; the default when the project has none. */
  passwordPolicy: PasswordPolicy;
  /** Whether the methods and password rules came from the project (false: defaults). */
  fromProject: boolean;
}

export interface ProjectLinks {
  termsUrl?: string;
  privacyUrl?: string;
}

/** One assistant an end user can chat with (public, never the prompt / LLM). */
export interface PublicAiAssistant {
  id: string;
  name: string;
  welcome?: string;
}

/**
 * End-user AI chat from the public config (`aiChat`). The chat launcher
 * renders only when `enabled`; `assistants` is empty while the chat is off.
 * Absent → treated as off.
 */
export interface PublicAiChat {
  enabled: boolean;
  assistants: PublicAiAssistant[];
}

export interface ProjectConfig {
  projectId: string;
  branding: ProjectBranding;
  auth: ProjectAuthOptions;
  links: ProjectLinks;
  /** End-user AI chat on/off + assistants. Absent → chat off. */
  aiChat?: PublicAiChat;
}

/** A project config without the project id: the part defaults and the public config fill in. */
export type ProjectConfigBody = Omit<ProjectConfig, 'projectId'>;
