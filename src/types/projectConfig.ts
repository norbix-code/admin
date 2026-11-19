// Public, unauthenticated project configuration that drives the portal's look
// (brand) and the login screen (auth). Sourced from the Hub project's Brand +
// membership settings via the public config endpoint.
//
// What the public endpoint returns is gated by two opt-in flags the developer
// sets in Cloud → Membership → Access:
//   - expose brand (default ON)  → branding present
//   - expose auth  (default OFF) → the sensitive auth detail (methods +
//                                  passwordPolicy) present
// Social providers list + passkey yes/no are ALWAYS returned (low-risk, needed
// to render the login screen). When auth detail is not exposed, the portal
// uses defaults: email/password + the default password policy (minLength 6,
// matching the Membership default rule).

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
   * Which social providers exist (always exposed). Older field; the buttons
   * come from `socialSignIn`, which says how to start each one.
   */
  socialProviders: SocialProviderId[];
  /**
   * The social sign-in buttons (always exposed). Absent → no buttons.
   */
  socialSignIn?: PublicSocialSignIn[];
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

/** A project config without the project id: the part defaults and the public config fill in. */
export type ProjectConfigBody = Omit<ProjectConfig, 'projectId'>;
