import { describe, expect, it } from 'vitest';
import {
  GENERIC_REFUSAL_MESSAGE,
  MISSING_LINK_MESSAGE,
  PREVIEW_EXPIRED_MESSAGE,
  PREVIEW_NOT_VALID_MESSAGE,
  emailLinkRefusal,
  linkHash,
  preferencesSummary,
  previewLinkRefusal,
} from './answers';

// What the footer-link pages say for each gateway answer.
describe('email link answers', () => {
  it('reads a refusal from an HTTP error or a 200 with isSuccess:false', () => {
    const refused = (errorCode: string, message?: string) => ({
      responseStatus: { isSuccess: false, errors: [{ errorCode, message }] },
    });
    expect([
      emailLinkRefusal(undefined, { responseStatus: { isSuccess: true } }),
      emailLinkRefusal({ data: refused('CM-ERRORS-SECRETS-001', 'x') }),
      emailLinkRefusal(
        undefined,
        refused('CM-ERRORS-EMAILS-024', 'This link is not valid.'),
      ),
      emailLinkRefusal({ status: 'FETCH_ERROR' }),
      emailLinkRefusal({ data: refused('CM-ERRORS-EMAILS-024') }),
    ]).toEqual([
      undefined,
      MISSING_LINK_MESSAGE,
      'This link is not valid.',
      GENERIC_REFUSAL_MESSAGE,
      GENERIC_REFUSAL_MESSAGE,
    ]);
  });

  it('says in one sentence what the address receives', () => {
    expect([
      preferencesSummary({ emailAddress: 'ana@example.com' }),
      preferencesSummary({ unsubscribedFromMarketing: true }),
    ]).toEqual([
      'ana@example.com receives marketing emails.',
      'This address is unsubscribed from marketing emails.',
    ]);
  });

  it('gives "expired" its own words and every other refusal the same', () => {
    const withCode = (errorCode: string) => ({
      data: { responseStatus: { errors: [{ errorCode }] } },
    });
    expect([
      previewLinkRefusal(undefined),
      previewLinkRefusal(withCode('CM-ERRORS-NOTIFICATIONS-PREVIEW-002')),
      previewLinkRefusal(withCode('CM-ERRORS-NOTIFICATIONS-PREVIEW-001')),
    ]).toEqual([undefined, PREVIEW_EXPIRED_MESSAGE, PREVIEW_NOT_VALID_MESSAGE]);
  });

  it('reads the hash from the address, empty without one', () => {
    expect([linkHash('?hash=a%2Bb'), linkHash('')]).toEqual(['a+b', '']);
  });
});
