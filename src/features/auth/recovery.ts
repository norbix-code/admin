/**
 * Passkey recovery link.
 *
 * The gateway's recovery e-mail (Hub.Membership.Mq Passkey.cs,
 * MembershipPortalLinks.MagicLink) links to `{portal}/oauth/callback#token=…`.
 * That token is NOT a session: it is redeemed once with
 * `POST …/membership/userauth/recovery/magic-link/consume`, which answers a
 * RESTRICTED session (`amr=MagicLink`, 15-minute access token): the host
 * should lead the user to register a new passkey (gateway decision D3). The
 * link token itself is never stored.
 *
 * The consume is sent with no credentials (a recovering user often still has
 * an old token, which the gateway may refuse).
 */
import { getAnonymousNorbixClient } from '@/services/norbix';
import { socialErrorCode } from './social';

/** Redeem the link token; answers the recovery session's access token. */
export async function consumeRecoveryLink(token: string): Promise<string> {
  const answer =
    await getAnonymousNorbixClient().api.membership.consumeMagicLink({ token });
  if (!answer?.accessToken) {
    throw Object.assign(new Error('The recovery answer carries no token.'), {
      code: 'NORBIX_NO_TOKEN',
    });
  }
  return answer.accessToken;
}

/** The plain message for a refused recovery link. */
export function recoveryErrorMessage(err: unknown): string {
  const status = (err as { status?: unknown } | null)?.status;
  if (status === 429) {
    return 'Too many attempts. Please wait a while and open the link again.';
  }
  switch (socialErrorCode(err)) {
    case 'CM-ERRORS-PASSKEY-016':
      return 'This recovery link has expired or was already used. Please ask for a new one.';
    case 'CM-ERRORS-PASSKEY-015':
      return 'Recovery links are turned off for this project. Please contact the site owner.';
    case 'CM-ERRORS-MEMBERSHIP-USERS-049':
      return 'This recovery link belongs to another environment of this project.';
    default:
      return 'Could not use this recovery link. Please try again or ask for a new one.';
  }
}

/** Shown when the link carries no token (cut off by a mail client, say). */
export const RECOVERY_LINK_INCOMPLETE =
  'This recovery link is incomplete. Please open the whole link from the e-mail, or ask for a new one.';
