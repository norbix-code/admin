/**
 * The social sign-in and link calls, through the typed SDK
 * (@norbix.ai/ts ≥ 4.60.0) on the portal client, i.e. the same-origin proxy.
 * Kept in one module so the screens' tests can replace it.
 *
 * The start is NOT here: it is a browser navigation to the real API host
 * (social.ts, socialStartUrl). The SDK's `socialSignInUrl` builds that URL
 * from the client's base, which in the portal is the proxy, and the client
 * has no env (the proxy stamps it); `startPath` from the public config
 * already carries both the project and the env.
 */
import type { SocialSignInResult } from '@norbix.ai/ts';
import { getNorbixClient } from '@/services/norbix';

/**
 * Trade a one-time sign-in code for the bearer JWT, with the PKCE verifier
 * of the start (pkce.ts). The SDK sends no credentials on it: an old token
 * still in the client could get it refused.
 */
export const exchangeSocialCode = (
  provider: string,
  code: string,
  codeVerifier?: string,
): Promise<SocialSignInResult> =>
  getNorbixClient().api.auth.exchangeSocialCode(provider, code, {
    codeVerifier,
  });

/**
 * Signed in, for yourself: the provider page to send the browser to. The
 * PKCE challenge binds the link code to this tab.
 */
export const startLinkIdentity = (
  userId: string,
  provider: string,
  returnUrl: string,
  codeChallenge?: string,
): Promise<{ authorizeUrl: string }> =>
  getNorbixClient().api.membership.startLinkIdentity(userId, provider, {
    returnUrl,
    codeChallenge,
  });

/**
 * Signed in, as the user who started the link: store the identity. Sends
 * the PKCE verifier of the link start.
 */
export const finishLinkIdentity = (
  userId: string,
  code: string,
  codeVerifier?: string,
): Promise<void> =>
  getNorbixClient().api.membership.finishLinkIdentity(userId, code, {
    codeVerifier,
  });

/** A full-page navigation (to the API host or the provider). */
export const goTo = (url: string): void => {
  window.location.assign(url);
};
