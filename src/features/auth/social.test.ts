// Social sign-in helpers: the button list from the public config, the start
// URL on the real API host, the callback answer (a one-time code, never a
// token) and the plain messages for the gateway's reasons and codes.
import { describe, expect, it } from 'vitest';
import {
  apiHostRoot,
  callbackErrorMessage,
  providerLabel,
  readSocialCallback,
  socialButtons,
  socialErrorCode,
  socialErrorMessage,
  socialReturnUrl,
  socialStartUrl,
} from './social';

const GOOGLE = {
  provider: 'google',
  displayName: 'Google',
  startPath: '/v3/membership/auth/social/google?projectId=pr_1',
};
const GITHUB = {
  provider: 'github',
  displayName: 'GitHub',
  startPath: '/v3/membership/auth/social/github?projectId=pr_1&env=TEST',
};

describe('socialButtons — auth.socialSignIn', () => {
  it('one button per entry, in the gateway order', () => {
    expect(socialButtons([GOOGLE, GITHUB])).toEqual([GOOGLE, GITHUB]);
  });

  it('an empty or absent list gives no buttons', () => {
    expect(socialButtons([])).toEqual([]);
    expect(socialButtons(undefined)).toEqual([]);
    expect(socialButtons(null)).toEqual([]);
  });

  it('keeps the first entry of a provider and drops entries with no relative start path', () => {
    expect(
      socialButtons([
        GOOGLE,
        { ...GOOGLE, displayName: 'Google again' },
        { ...GITHUB, startPath: 'https://evil.test/start' },
        { ...GITHUB, provider: 'okta', startPath: '//evil.test/start' },
        { provider: '', displayName: 'x', startPath: '/v3/x' },
      ]),
    ).toEqual([GOOGLE]);
  });

  it('a missing display name falls back to the provider name', () => {
    expect(
      socialButtons([{ ...GOOGLE, provider: 'GitHub', displayName: '' }]),
    ).toEqual([{ ...GOOGLE, provider: 'github', displayName: 'GitHub' }]);
  });
});

describe('the start URL', () => {
  it('the API host root comes from the echo apiUrl', () => {
    expect(apiHostRoot('https://api.norbix.ai/v3')).toBe(
      'https://api.norbix.ai',
    );
    expect(apiHostRoot('http://localhost:5002/v3/')).toBe(
      'http://localhost:5002',
    );
    expect(apiHostRoot('https://host.test/gateway/v3')).toBe(
      'https://host.test/gateway',
    );
    expect(apiHostRoot('')).toBeNull();
    expect(apiHostRoot('not a url')).toBeNull();
    expect(apiHostRoot('javascript:alert(1)')).toBeNull();
  });

  it('the return page names the provider; a link adds link=1', () => {
    expect(socialReturnUrl('https://portal.test', 'Google')).toBe(
      'https://portal.test/oauth/callback?via=google',
    );
    expect(socialReturnUrl('https://portal.test', 'github', true)).toBe(
      'https://portal.test/oauth/callback?via=github&link=1',
    );
  });

  it('is {API host}{startPath}&returnUrl=… with the return page encoded', () => {
    expect(
      socialStartUrl(
        'https://api.test',
        GITHUB.startPath,
        'https://portal.test/oauth/callback?via=github',
      ),
    ).toBe(
      'https://api.test/v3/membership/auth/social/github?projectId=pr_1&env=TEST' +
        '&returnUrl=https%3A%2F%2Fportal.test%2Foauth%2Fcallback%3Fvia%3Dgithub',
    );
    expect(socialStartUrl('https://api.test', '/v3/start', 'https://p')).toBe(
      'https://api.test/v3/start?returnUrl=https%3A%2F%2Fp',
    );
  });
});

describe('readSocialCallback — /oauth/callback', () => {
  const read = (search: string, hash = '') =>
    readSocialCallback({ search, hash });

  it('a sign-in code', () => {
    expect(read('?via=google&code=c1&provider=google')).toEqual({
      kind: 'signIn',
      provider: 'google',
      code: 'c1',
    });
  });

  it('a link code (intent=link)', () => {
    expect(
      read('?via=google&link=1&intent=link&code=c2&provider=google'),
    ).toEqual({ kind: 'link', provider: 'google', code: 'c2' });
  });

  it('a code on a page started for a link is never a sign-in code', () => {
    expect(read('?via=google&link=1&code=c2&provider=google').kind).toBe(
      'link',
    );
  });

  it('an error, with the provider and the link mark from the return page', () => {
    expect(read('?via=github&error=email_in_use')).toEqual({
      kind: 'error',
      error: 'email_in_use',
      provider: 'github',
      link: false,
    });
    expect(read('?via=github&link=1&error=access_denied')).toEqual({
      kind: 'error',
      error: 'access_denied',
      provider: 'github',
      link: true,
    });
  });

  it('an error wins over a code', () => {
    expect(read('?code=c&provider=google&error=state_mismatch').kind).toBe(
      'error',
    );
  });

  it('the recovery e-mail link: the token from the fragment, then the query', () => {
    expect(read('', '#token=t1')).toEqual({ kind: 'recovery', token: 't1' });
    expect(read('?token=t2')).toEqual({ kind: 'recovery', token: 't2' });
    expect(read('?token=q', '#token=f')).toEqual({
      kind: 'recovery',
      token: 'f',
    });
  });

  it('a recovery link with the name but no token says so (empty token)', () => {
    expect(read('', '#token=')).toEqual({ kind: 'recovery', token: '' });
  });

  it('an old session token in the URL is never read', () => {
    expect(read('?access_token=t2')).toEqual({ kind: 'none' });
    expect(read('', '#bearerToken=t3')).toEqual({ kind: 'none' });
  });

  it('nothing to read', () => {
    expect(read('')).toEqual({ kind: 'none' });
    expect(read('?code=c1')).toEqual({ kind: 'none' });
  });
});

describe('messages', () => {
  it('names the provider from the config, else a known name, else "the provider"', () => {
    expect(
      providerLabel('okta', [
        { ...GOOGLE, provider: 'okta', displayName: 'Acme SSO' },
      ]),
    ).toBe('Acme SSO');
    expect(providerLabel('GITHUB')).toBe('GitHub');
    expect(providerLabel('<b>evil</b>')).toBe('the provider');
    expect(providerLabel('')).toBe('the provider');
  });

  it('email_in_use tells the user to sign in and link from Security', () => {
    expect(callbackErrorMessage('email_in_use', 'google')).toBe(
      'This email already has an account. Sign in, then link Google from Security.',
    );
  });

  it('state_mismatch and unknown reasons are plain; the query text is never shown', () => {
    expect(callbackErrorMessage('state_mismatch', 'google')).toBe(
      'This sign-in was started in another browser or has expired. Please start again.',
    );
    const unknown = callbackErrorMessage('Sneaky_text_here', 'google');
    expect(unknown).toBe(
      'Sign-in with Google did not complete. Please try again.',
    );
    expect(unknown).not.toContain('Sneaky');
  });

  it.each([
    ['access_denied', 'Sign-in with GitHub was cancelled.'],
    [
      'user_blocked',
      'This account cannot sign in. Please contact the site owner.',
    ],
    [
      'invite_only',
      'This project is invite-only. Ask the site owner for an invitation.',
    ],
    ['provider_error', 'GitHub did not finish the sign-in. Please try again.'],
    [
      'no_users_database',
      'This project cannot sign you in yet. Please contact the site owner.',
    ],
  ])('reason %s', (reason, message) => {
    expect(callbackErrorMessage(reason, 'github')).toBe(message);
  });

  const failed = (errorCode: string, status = 400) => ({
    status,
    code: errorCode,
    fieldErrors: [],
  });

  it.each([
    [
      'CM-ERRORS-MEMBERSHIP-049',
      'Sign-in with Google is not available for this project.',
    ],
    [
      'CM-ERRORS-MEMBERSHIP-050',
      'Sign-in with Google is not set up completely. Please contact the site owner.',
    ],
    [
      'CM-ERRORS-MEMBERSHIP-051',
      'This sign-in has expired or was already used. Please start again.',
    ],
    [
      'CM-ERRORS-MEMBERSHIP-052',
      'This portal address is not allowed to receive sign-ins. Please contact the site owner.',
    ],
    [
      'CM-ERRORS-MEMBERSHIP-053',
      'Sign-in with Google is not set up completely. Please contact the site owner.',
    ],
    ['CM-ERRORS-MEMBERSHIP-054', 'Sign-in with Google was refused.'],
    [
      'CM-ERRORS-MEMBERSHIP-055',
      'This Google account belongs to someone else.',
    ],
    [
      'CM-ERRORS-MEMBERSHIP-056',
      'You can link an account only to yourself. Please sign in again and retry.',
    ],
    [
      'CM-ERRORS-MEMBERSHIP-057',
      'This sign-in was started in another browser or has expired. Please start again.',
    ],
  ])('code %s', (code, message) => {
    expect(socialErrorMessage(failed(code), 'google')).toBe(message);
  });

  it('reads the code from the error list or the raw body; a bare 409 is 055', () => {
    expect(
      socialErrorCode({
        code: 'NORBIX_HTTP_ERROR',
        fieldErrors: [{ errorCode: 'CM-ERRORS-MEMBERSHIP-051' }],
      }),
    ).toBe('CM-ERRORS-MEMBERSHIP-051');
    expect(
      socialErrorCode({
        raw: {
          responseStatus: {
            errors: [{ errorCode: 'CM-ERRORS-MEMBERSHIP-056' }],
          },
        },
      }),
    ).toBe('CM-ERRORS-MEMBERSHIP-056');
    expect(socialErrorCode({ status: 409 })).toBe('CM-ERRORS-MEMBERSHIP-055');
    expect(socialErrorCode(new Error('offline'))).toBeUndefined();
    expect(socialErrorMessage(new Error('offline'), 'google')).toBe(
      'Could not finish with Google. Please try again.',
    );
  });
});
