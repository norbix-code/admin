// Public, unauthenticated project configuration that drives the portal's look
// (brand) and the login screen (auth). Sourced from the Hub project's Brand +
// membership settings via the public endpoint, or from a bundled static config.
//
// What the public endpoint returns is gated by two opt-in flags the developer
// sets in Cloud → Membership → Access:
//   - expose brand (default ON)  → branding present
//   - expose auth  (default OFF) → the sensitive auth detail (methods +
//                                  passwordPolicy) present
// Social providers list + passkey yes/no are ALWAYS returned (low-risk, needed
// to render the login screen). When auth detail is not exposed, the portal
// uses defaults: email/password + the default password policy (minLength 3,
// matching the Hub PasswordComplexity default).

export type SocialProviderId =
  | 'google'
  | 'github'
  | 'facebook'
  | 'apple'
  | 'microsoft';

/** Identifier methods a project's auth flows accept. */
export type AuthMethod = 'email' | 'phone' | 'username';

/** Password policy the UI mirrors. Only present when the project exposes auth. */
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

export interface ProjectAuthOptions {
  /** Which social providers exist (always exposed). Rendered as icon links. */
  socialProviders: SocialProviderId[];
  /** Whether a passkey flow is configured (always exposed). */
  passkey: boolean;
  /** Identifier methods — only when the project exposes auth; else defaults. */
  methods: AuthMethod[];
  /** Password rules to mirror in the UI — only when exposed; else default. */
  passwordPolicy: PasswordPolicy;
  /** Whether the project exposed the sensitive auth detail (methods/policy). */
  exposed: boolean;
}

export interface ProjectLinks {
  termsUrl?: string;
  privacyUrl?: string;
}

export interface ProjectConfig {
  projectId: string;
  branding: ProjectBranding;
  auth: ProjectAuthOptions;
  links: ProjectLinks;
}

/** Static / bundled payload shape = ProjectConfig without projectId. */
export type StaticProjectConfig = Omit<ProjectConfig, 'projectId'>;

// ── Back-compat aliases ─────────────────────────────────────────────
export type LoginConfig = ProjectConfig;
export type LoginBranding = ProjectBranding;
export type LoginAuthOptions = ProjectAuthOptions;
export type LoginLinks = ProjectLinks;
export type StaticLoginConfig = StaticProjectConfig;
