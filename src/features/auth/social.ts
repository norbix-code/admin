/**
 * Project social sign-in and identity linking (gateway feat/membership-social).
 *
 * Sign-in is a full-page navigation, not a call:
 *
 *   1. The button sends the browser to `{API host}{startPath}&returnUrl=…`
 *      (`startPath` comes from the public config's `auth.socialSignIn`). The
 *      gateway sets a short-lived HttpOnly cookie (`nb_social`) and redirects
 *      to the provider.
 *   2. The provider calls the gateway back; the gateway checks that cookie and
 *      sends the browser to the portal's `/oauth/callback` with a one-time
 *      `code` and `provider` (plus `intent=link` for a link), or with
 *      `error=<reason>`. A token never travels in the URL.
 *   3. The callback page exchanges a sign-in code (no credentials, 2 minutes,
 *      once) for the same JWT a password sign-in gives, or finishes a link as
 *      the signed-in user.
 *
 * The start goes to the REAL API host, never through the same-origin proxy:
 * the cookie must be set on the host the provider calls back, or every
 * sign-in ends in `state_mismatch`.
 *
 * This file is pure (no SDK, no React); the calls live in socialApi.ts.
 */
import type { PublicSocialSignIn } from '@/types/projectConfig';
import { ROUTES } from '@/routes';
import type { LinkAddress } from './linkToken';

/** Names the gateway knows; anything else is shown as "the provider". */
const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google',
  apple: 'Apple',
  microsoft: 'Microsoft',
  github: 'GitHub',
  facebook: 'Facebook',
  x: 'X',
  okta: 'Okta',
};

const slugOf = (provider: string | null | undefined): string =>
  (provider ?? '').trim().toLowerCase();

/**
 * The provider's name for a message or a button. The public config's
 * `displayName` wins; then the known names. A value read from the address bar
 * is never shown as it is: an unknown provider is "the provider".
 */
export function providerLabel(
  provider: string | null | undefined,
  buttons: PublicSocialSignIn[] = [],
): string {
  const slug = slugOf(provider);
  if (!slug) return 'the provider';
  const fromConfig = buttons.find((b) => slugOf(b.provider) === slug);
  if (fromConfig?.displayName?.trim()) return fromConfig.displayName.trim();
  return PROVIDER_LABEL[slug] ?? 'the provider';
}

/**
 * The buttons to show: one per entry of `auth.socialSignIn`, first one per
 * provider, only entries with a relative `startPath` (a path on the API host,
 * never a URL to another site). Empty list → no buttons.
 */
export function socialButtons(
  list: PublicSocialSignIn[] | null | undefined,
): PublicSocialSignIn[] {
  const seen = new Set<string>();
  const out: PublicSocialSignIn[] = [];
  for (const entry of list ?? []) {
    const slug = slugOf(entry?.provider);
    const path = entry?.startPath ?? '';
    if (!slug || seen.has(slug)) continue;
    if (!path.startsWith('/') || path.startsWith('//')) continue;
    seen.add(slug);
    out.push({
      provider: slug,
      displayName: entry.displayName?.trim() || providerLabel(slug),
      startPath: path,
    });
  }
  return out;
}

/**
 * The API host root from the echo `apiUrl` (`https://api.host/v3` →
 * `https://api.host`): `startPath` already begins with `/v3`. Null when the
 * echo has no usable http(s) URL.
 */
export function apiHostRoot(apiUrl: string | null | undefined): string | null {
  if (!apiUrl) return null;
  try {
    const url = new URL(apiUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const path = url.pathname.replace(/\/+$/, '').replace(/\/v\d+$/, '');
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

/**
 * The portal page the gateway sends the browser back to, on success and on
 * failure. `via` names the provider and `link=1` marks a link, so the page
 * can word an `error=` answer (the gateway adds only `error` to a failure).
 * Its origin must be in the project's CORS union (README, "Social sign-in").
 */
export function socialReturnUrl(
  portalOrigin: string,
  provider: string,
  link = false,
): string {
  const query = new URLSearchParams({ via: slugOf(provider) });
  if (link) query.set('link', '1');
  return `${portalOrigin}${ROUTES.OAUTH_CALLBACK}?${query.toString()}`;
}

/** Where a sign-in button goes: `{API host}{startPath}&returnUrl=…`. */
export function socialStartUrl(
  apiRoot: string,
  startPath: string,
  returnUrl: string,
): string {
  const join = startPath.includes('?') ? '&' : '?';
  return `${apiRoot}${startPath}${join}returnUrl=${encodeURIComponent(returnUrl)}`;
}

/** What /oauth/callback was opened with. */
export type SocialCallback =
  | { kind: 'signIn'; provider: string; code: string }
  | { kind: 'link'; provider: string; code: string }
  | { kind: 'error'; error: string; provider: string; link: boolean }
  /** The old token-in-the-URL answer (e.g. a passkey recovery link). */
  | { kind: 'token' }
  | { kind: 'none' };

/** Every parameter the page reads; all are taken out of the address bar. */
export const CALLBACK_PARAM_NAMES = [
  'code',
  'provider',
  'intent',
  'error',
  'via',
  'link',
  // Old answers carried a token here; it is never used, but never left in
  // the address bar either.
  'token',
  'bearerToken',
  'access_token',
  'userId',
  'user_id',
];

/** Read the callback query (the gateway always answers in the query). */
export function readSocialCallback(address: LinkAddress): SocialCallback {
  const query = new URLSearchParams(address.search);
  const fragment = new URLSearchParams(address.hash.replace(/^#/, ''));
  const get = (name: string) => (query.get(name) ?? '').trim();

  const provider = slugOf(get('provider') || get('via'));
  const link = get('intent') === 'link' || get('link') === '1';
  const error = get('error');
  if (error) return { kind: 'error', error, provider, link };

  const code = get('code');
  if (code && provider) {
    return link
      ? { kind: 'link', provider, code }
      : { kind: 'signIn', provider, code };
  }
  if (
    ['token', 'bearerToken', 'access_token'].some(
      (n) => fragment.get(n) || query.get(n),
    )
  ) {
    return { kind: 'token' };
  }
  return { kind: 'none' };
}

/**
 * The plain message for a callback `error=` reason (gateway
 * SocialSignInRules / ProjectSocialUsers). Unknown reasons get the default:
 * the query text is never shown.
 */
export function callbackErrorMessage(
  error: string,
  provider: string,
  buttons: PublicSocialSignIn[] = [],
): string {
  const name = providerLabel(provider, buttons);
  switch (error) {
    case 'email_in_use':
      return `This email already has an account. Sign in, then link ${name} from Security.`;
    case 'state_mismatch':
      return 'This sign-in was started in another browser or has expired. Please start again.';
    case 'access_denied':
      return `Sign-in with ${name} was cancelled.`;
    case 'user_blocked':
      return 'This account cannot sign in. Please contact the site owner.';
    case 'invite_only':
      return 'This project is invite-only. Ask the site owner for an invitation.';
    case 'provider_not_available':
      return `Sign-in with ${name} is not available for this project.`;
    case 'integration_not_configured':
      return `Sign-in with ${name} is not set up completely. Please contact the site owner.`;
    case 'provider_error':
    case 'no_code':
      return `${capitalize(name)} did not finish the sign-in. Please try again.`;
    case 'account_not_ready':
    case 'no_users_database':
      return 'This project cannot sign you in yet. Please contact the site owner.';
    default:
      return `Sign-in with ${name} did not complete. Please try again.`;
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The gateway error code of a failed call (NorbixError or a raw body). */
export function socialErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as {
    code?: unknown;
    status?: unknown;
    fieldErrors?: { errorCode?: string }[];
    raw?: {
      responseStatus?: {
        errorCode?: string;
        errors?: { errorCode?: string }[];
      };
    };
    data?: {
      responseStatus?: {
        errorCode?: string;
        errors?: { errorCode?: string }[];
      };
    };
  };
  const candidates = [
    typeof e.code === 'string' ? e.code : undefined,
    ...(e.fieldErrors ?? []).map((f) => f.errorCode),
    ...(e.raw?.responseStatus?.errors ?? []).map((f) => f.errorCode),
    e.raw?.responseStatus?.errorCode,
    ...(e.data?.responseStatus?.errors ?? []).map((f) => f.errorCode),
    e.data?.responseStatus?.errorCode,
  ];
  const code = candidates.find((c) => c && /^CM-ERRORS-/.test(c));
  if (code) return code;
  // 055 is the only 409 these routes answer.
  if (e.status === 409) return 'CM-ERRORS-MEMBERSHIP-055';
  return undefined;
}

/**
 * The plain message for a refused exchange, link start or link finish
 * (CM-ERRORS-MEMBERSHIP-049…057, gateway Domain/Errors/Membership.cs).
 */
export function socialErrorMessage(
  err: unknown,
  provider: string,
  buttons: PublicSocialSignIn[] = [],
): string {
  const name = providerLabel(provider, buttons);
  switch (socialErrorCode(err)) {
    case 'CM-ERRORS-MEMBERSHIP-049':
      return `Sign-in with ${name} is not available for this project.`;
    case 'CM-ERRORS-MEMBERSHIP-050':
      return `Sign-in with ${name} is not set up completely. Please contact the site owner.`;
    case 'CM-ERRORS-MEMBERSHIP-051':
      return 'This sign-in has expired or was already used. Please start again.';
    case 'CM-ERRORS-MEMBERSHIP-052':
      return 'This portal address is not allowed to receive sign-ins. Please contact the site owner.';
    case 'CM-ERRORS-MEMBERSHIP-053':
      return `Sign-in with ${name} is not set up completely. Please contact the site owner.`;
    case 'CM-ERRORS-MEMBERSHIP-054':
      return `Sign-in with ${name} was refused.`;
    case 'CM-ERRORS-MEMBERSHIP-055':
      return `This ${name} account belongs to someone else.`;
    case 'CM-ERRORS-MEMBERSHIP-056':
      return 'You can link an account only to yourself. Please sign in again and retry.';
    case 'CM-ERRORS-MEMBERSHIP-057':
      return 'This sign-in was started in another browser or has expired. Please start again.';
    default:
      return `Could not finish with ${name}. Please try again.`;
  }
}
