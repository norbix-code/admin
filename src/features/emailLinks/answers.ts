// The public pages behind the footer links of a sent message — "Preferences"
// (/notifications/preferences?hash=…), "Unsubscribe"
// (/notifications/email-unsubscribe?hash=…) and "View in web"
// (/notifications/emails/preview?hash=…). They need no sign-in: the `hash` is
// a signed link, and the gateway either answers or refuses it. These helpers
// turn the gateway's answer into what the page says.

export interface GatewayError {
  errorCode?: string;
  message?: string;
}

export interface ResponseStatus {
  isSuccess?: boolean;
  errors?: GatewayError[];
}

export interface EmailLinkPreferences {
  emailAddress?: string;
  unsubscribedFromMarketing?: boolean;
  blockReasons?: string[];
}

export interface EmailLinkPreferencesAnswer {
  item?: EmailLinkPreferences;
  responseStatus?: ResponseStatus;
}

export interface EmailPreviewAnswer {
  subject?: string;
  body?: string;
}

/** No token in the link at all. */
export const EMAIL_LINK_MISSING = 'CM-ERRORS-SECRETS-001';
export const PREVIEW_LINK_EXPIRED = 'CM-ERRORS-NOTIFICATIONS-PREVIEW-002';

export const MISSING_LINK_MESSAGE =
  'This link is incomplete. Open the link from the email again.';
export const GENERIC_REFUSAL_MESSAGE =
  'We could not open your email preferences. Please try again later.';
export const UNSUBSCRIBED_MESSAGE =
  'You have been unsubscribed from marketing emails.';
export const PREVIEW_EXPIRED_MESSAGE =
  'This preview link has expired. Ask the sender for a new email.';
export const PREVIEW_NOT_VALID_MESSAGE = 'This preview link is not valid.';

type Refusable = { data?: { responseStatus?: ResponseStatus } };

/**
 * The sentence to show when the gateway refused a preferences link, or
 * undefined when it did not. A refusal comes as an HTTP error (`error.data`)
 * or as a 200 body with `isSuccess: false` (`data`); both are read. The
 * gateway's own message is shown (it never says whether the address exists).
 */
export function emailLinkRefusal(
  error: unknown,
  data?: { responseStatus?: ResponseStatus },
): string | undefined {
  const fromError = (error as Refusable | undefined)?.data?.responseStatus;
  const fromData = data?.responseStatus;
  const status =
    fromError ?? (fromData?.isSuccess === false ? fromData : undefined);

  if (!status) return error ? GENERIC_REFUSAL_MESSAGE : undefined;

  const errors = status.errors ?? [];
  if (errors.some((e) => e.errorCode === EMAIL_LINK_MISSING)) {
    return MISSING_LINK_MESSAGE;
  }
  return errors.find((e) => e.message)?.message ?? GENERIC_REFUSAL_MESSAGE;
}

/** One sentence: what this address receives now. */
export function preferencesSummary(preferences: EmailLinkPreferences): string {
  const who = preferences.emailAddress || 'This address';
  return preferences.unsubscribedFromMarketing
    ? `${who} is unsubscribed from marketing emails.`
    : `${who} receives marketing emails.`;
}

/**
 * What the "View in web" page says for a refused link, or undefined when there
 * was no error. Every refusal reads the same (never saying whether the email
 * exists), except "expired": the reader can ask the sender again.
 */
export function previewLinkRefusal(error: unknown): string | undefined {
  if (!error) return undefined;
  const codes = ((error as Refusable).data?.responseStatus?.errors ?? []).map(
    (e) => e.errorCode,
  );
  return codes.includes(PREVIEW_LINK_EXPIRED)
    ? PREVIEW_EXPIRED_MESSAGE
    : PREVIEW_NOT_VALID_MESSAGE;
}

/** The `hash` of the current address; empty when the link has none. */
export function linkHash(search: string): string {
  return new URLSearchParams(search).get('hash') ?? '';
}
