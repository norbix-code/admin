// @vitest-environment jsdom
// Social sign-in and identity linking on the screens:
//  - the sign-in page shows one button per `auth.socialSignIn` entry, each a
//    link to the REAL API host (echo apiUrl) with the portal's return page;
//  - /oauth/callback exchanges a sign-in code and signs the portal in like a
//    password sign-in, finishes a link code and goes back to Security, and
//    words every error plainly with the sign-in button;
//  - Security → "Sign-in methods" starts a link and sends the browser to the
//    provider page the gateway answers.
//
// The SDK calls (socialApi.ts) and the data hooks are mocked; the screens'
// own rules are what is under test.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import auth, { signedIn } from '@/features/auth/slice';
import config, { echoResolved } from '@/config/slice';
import project, { projectConfigResolved } from '@/features/project/slice';
import { ROUTES } from '@/routes';
import type { ProjectConfig } from '@/types/projectConfig';
import type { EchoResponse } from '@/types/echo';

const calls = vi.hoisted(() => ({
  exchange: [] as unknown[][],
  start: [] as unknown[][],
  finish: [] as unknown[][],
  goTo: [] as string[],
  exchangeAnswer: undefined as unknown,
  exchangeError: undefined as unknown,
  startError: undefined as unknown,
  finishError: undefined as unknown,
  consume: [] as string[],
  consumeAnswer: 'recovery.jwt' as string,
  consumeError: undefined as unknown,
}));

// Only the call is replaced; the messages are the real ones.
vi.mock('./recovery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./recovery')>()),
  consumeRecoveryLink: async (token: string) => {
    calls.consume.push(token);
    if (calls.consumeError) throw calls.consumeError;
    return calls.consumeAnswer;
  },
}));

vi.mock('./socialApi', () => ({
  exchangeSocialCode: async (...args: unknown[]) => {
    calls.exchange.push(args);
    if (calls.exchangeError) throw calls.exchangeError;
    return calls.exchangeAnswer;
  },
  startLinkIdentity: async (...args: unknown[]) => {
    calls.start.push(args);
    if (calls.startError) throw calls.startError;
    return { authorizeUrl: 'https://accounts.google.test/o/oauth2/auth?x=1' };
  },
  finishLinkIdentity: async (...args: unknown[]) => {
    calls.finish.push(args);
    if (calls.finishError) throw calls.finishError;
  },
  goTo: (url: string) => void calls.goTo.push(url),
}));

vi.mock('@/services/publicApi', () => ({
  useGetLegalDocumentQuery: () => ({ data: { available: false } }),
}));

vi.mock('@/services/norbix', () => ({
  useLoginMutation: () => [vi.fn(), { isLoading: false, isError: false }],
  useChangePasswordMutation: () => [vi.fn(), { isLoading: false }],
  usePasskeyAuthenticationOptionsMutation: () => [vi.fn()],
  useVerifyPasskeyAuthenticationMutation: () => [vi.fn()],
}));

// The passkeys card has its own data and tests.
vi.mock('./passkeys', () => ({ PasskeysCard: () => null }));

const { Login } = await import('./login');
const { OAuthCallback } = await import('./callback');
const { SecurityOverview } = await import('./security');

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

const CONFIG = (socialSignIn = [GOOGLE, GITHUB]) =>
  ({
    projectId: 'pr_1',
    branding: { displayName: 'Shop' },
    auth: {
      socialProviders: [],
      socialSignIn,
      passkey: false,
      methods: ['email'],
      passwordPolicy: { minLength: 6 },
      exposed: false,
    },
    links: {},
  }) as ProjectConfig;

const ECHO = { apiUrl: 'https://api.norbix.test/v3' } as EchoResponse;
const PORTAL = window.location.origin;

function makeStore(
  opts: {
    config?: ProjectConfig;
    echo?: EchoResponse | null;
    signedIn?: boolean;
  } = {},
) {
  const store = configureStore({
    reducer: combineReducers({ auth, config, project }),
  });
  if (opts.echo !== null) store.dispatch(echoResolved(opts.echo ?? ECHO));
  store.dispatch(projectConfigResolved(opts.config ?? CONFIG()));
  if (opts.signedIn) {
    store.dispatch(signedIn({ token: 'old.token', userId: 'usr_1' }));
  }
  return store;
}

function renderAt(url: string, opts: Parameters<typeof makeStore>[0] = {}) {
  const store = makeStore(opts);
  const config = opts.config ?? CONFIG();
  // The callback cleans the address bar through window.history.
  window.history.replaceState(null, '', url);
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={ROUTES.SIGN_IN} element={<Login config={config} />} />
          <Route path={ROUTES.OAUTH_CALLBACK} element={<OAuthCallback />} />
          <Route path={ROUTES.SECURITY} element={<SecurityOverview />} />
          <Route path={ROUTES.HOME} element={<p>Home screen</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

afterEach(() => {
  cleanup();
  calls.exchange = [];
  calls.start = [];
  calls.finish = [];
  calls.goTo = [];
  calls.exchangeAnswer = undefined;
  calls.exchangeError = undefined;
  calls.startError = undefined;
  calls.finishError = undefined;
  calls.consume = [];
  calls.consumeAnswer = 'recovery.jwt';
  calls.consumeError = undefined;
  window.history.replaceState(null, '', '/');
});

const refused = (errorCode: string, status = 400) =>
  Object.assign(new Error(errorCode), { status, code: errorCode });

describe('Sign-in page — social buttons', () => {
  it('one button per auth.socialSignIn entry, each to the API host with the return page', () => {
    renderAt(ROUTES.SIGN_IN);
    const google = screen.getByRole('link', { name: 'Continue with Google' });
    const github = screen.getByRole('link', { name: 'Continue with GitHub' });
    expect(google.getAttribute('href')).toBe(
      'https://api.norbix.test/v3/membership/auth/social/google?projectId=pr_1' +
        `&returnUrl=${encodeURIComponent(`${PORTAL}/oauth/callback?via=google`)}`,
    );
    expect(github.getAttribute('href')).toBe(
      'https://api.norbix.test/v3/membership/auth/social/github?projectId=pr_1&env=TEST' +
        `&returnUrl=${encodeURIComponent(`${PORTAL}/oauth/callback?via=github`)}`,
    );
    expect(screen.getByText('or continue with')).toBeTruthy();
  });

  it('an empty list shows no button and no "or continue with"', () => {
    renderAt(ROUTES.SIGN_IN, { config: CONFIG([]) });
    expect(screen.queryByRole('link', { name: /Continue with/ })).toBeNull();
    expect(screen.queryByText('or continue with')).toBeNull();
  });

  it('a config without the field (cached before it existed) shows no button', () => {
    const old = CONFIG();
    delete (old.auth as { socialSignIn?: unknown }).socialSignIn;
    renderAt(ROUTES.SIGN_IN, { config: old });
    expect(screen.queryByRole('link', { name: /Continue with/ })).toBeNull();
  });

  it('without the API host from echo there is nowhere to send the browser: no button', () => {
    renderAt(ROUTES.SIGN_IN, { echo: null });
    expect(screen.queryByRole('link', { name: /Continue with/ })).toBeNull();
  });
});

describe('/oauth/callback', () => {
  it('a sign-in code: exchanged, stored like a password sign-in, home; the code leaves the address bar', async () => {
    calls.exchangeAnswer = { bearerToken: 'social.jwt', userId: 'usr_9' };
    const store = renderAt(
      '/oauth/callback?via=google&code=c1&provider=google',
    );

    expect(await screen.findByText('Home screen')).toBeTruthy();
    expect(calls.exchange).toEqual([['google', 'c1']]);
    expect(store.getState().auth.token).toBe('social.jwt');
    expect(store.getState().auth.userId).toBe('usr_9');
    expect(store.getState().auth.loginName).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('a used or expired code: a plain message and the sign-in button', async () => {
    calls.exchangeError = refused('CM-ERRORS-MEMBERSHIP-051');
    const store = renderAt(
      '/oauth/callback?via=google&code=c1&provider=google',
    );

    expect(
      await screen.findByText(
        'This sign-in has expired or was already used. Please start again.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    expect(store.getState().auth.token).toBeNull();
  });

  it('a link code, signed in: finished as this user, back to Security with "Linked Google."', async () => {
    const store = renderAt(
      '/oauth/callback?via=google&link=1&intent=link&code=l1&provider=google',
      { signedIn: true },
    );

    expect(await screen.findByText('Linked Google.')).toBeTruthy();
    expect(calls.finish).toEqual([['usr_1', 'l1']]);
    expect(calls.exchange).toEqual([]);
    expect(store.getState().auth.token).toBe('old.token');
  });

  it('a link code for an account that belongs to someone else (409, 055): Security says so', async () => {
    calls.finishError = refused('CM-ERRORS-MEMBERSHIP-055', 409);
    renderAt(
      '/oauth/callback?via=google&link=1&intent=link&code=l1&provider=google',
      { signedIn: true },
    );

    expect(
      await screen.findByText('This Google account belongs to someone else.'),
    ).toBeTruthy();
    expect(screen.getByText('Sign-in methods')).toBeTruthy();
    expect(screen.queryByText('Linked Google.')).toBeNull();
  });

  it('a link code while signed out: never exchanged, asks to sign in first', async () => {
    renderAt(
      '/oauth/callback?via=google&link=1&intent=link&code=l1&provider=google',
    );
    expect(
      await screen.findByText(
        'Your session has ended. Sign in, then link Google again from Security.',
      ),
    ).toBeTruthy();
    expect(calls.exchange).toEqual([]);
    expect(calls.finish).toEqual([]);
  });

  it('email_in_use: sign in, then link the provider from Security', async () => {
    renderAt('/oauth/callback?via=github&error=email_in_use');
    expect(
      await screen.findByText(
        'This email already has an account. Sign in, then link GitHub from Security.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    expect(calls.exchange).toEqual([]);
    expect(window.location.search).toBe('');
  });

  it('state_mismatch: a plain message and the sign-in button', async () => {
    renderAt('/oauth/callback?via=google&error=state_mismatch');
    expect(
      await screen.findByText(
        'This sign-in was started in another browser or has expired. Please start again.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
  });

  it('any other reason: plain words, never the query text', async () => {
    renderAt('/oauth/callback?via=google&error=Click_here_now');
    expect(
      await screen.findByText(
        'Sign-in with Google did not complete. Please try again.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Click_here_now/)).toBeNull();
  });

  it('a link that failed at the provider, signed in: back to Security with the reason', async () => {
    renderAt('/oauth/callback?via=google&link=1&error=access_denied', {
      signedIn: true,
    });
    expect(
      await screen.findByText('Sign-in with Google was cancelled.'),
    ).toBeTruthy();
    expect(screen.getByText('Sign-in methods')).toBeTruthy();
  });
});

describe('/oauth/callback — passkey recovery link (#token=…)', () => {
  it('redeems the token, stores the recovery session (never the link token) and leads to a new passkey', async () => {
    const store = renderAt('/oauth/callback#token=link-token-1', {
      signedIn: true,
    });

    expect(
      await screen.findByText(/You signed in with a recovery link/),
    ).toBeTruthy();
    expect(calls.consume).toEqual(['link-token-1']);
    const authState = store.getState().auth;
    expect(authState.token).toBe('recovery.jwt');
    expect(authState.recovery).toBe(true);
    expect(JSON.stringify(authState)).not.toContain('link-token-1');
    expect(window.location.hash).toBe('');
    // Changing the password needs the current one: not offered here.
    expect(screen.queryByText('Change password')).toBeNull();
    expect(
      screen
        .getByRole('link', { name: 'set a new password by e-mail' })
        .getAttribute('href'),
    ).toBe('/sign-in/reset');
  });

  it('an expired or used link (CM-ERRORS-PASSKEY-016): plain message, nothing stored', async () => {
    calls.consumeError = refused('CM-ERRORS-PASSKEY-016');
    const store = renderAt('/oauth/callback#token=used-token');

    expect(
      await screen.findByText(
        'This recovery link has expired or was already used. Please ask for a new one.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
    expect(store.getState().auth.token).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('a link with no token: says it is incomplete and calls nothing', async () => {
    const store = renderAt('/oauth/callback#token=');
    expect(
      await screen.findByText(
        'This recovery link is incomplete. Please open the whole link from the e-mail, or ask for a new one.',
      ),
    ).toBeTruthy();
    expect(calls.consume).toEqual([]);
    expect(store.getState().auth.token).toBeNull();
  });

  it('an old session token in the URL is not stored', async () => {
    const store = renderAt('/oauth/callback?access_token=t1');
    expect(
      await screen.findByText('Sign-in did not complete. Please try again.'),
    ).toBeTruthy();
    expect(store.getState().auth.token).toBeNull();
  });
});

describe('Security → Sign-in methods', () => {
  it('"Link {provider}" per offered provider; a click sends the browser to the provider page', async () => {
    renderAt(ROUTES.SECURITY, { signedIn: true });
    expect(screen.getByRole('button', { name: 'Link GitHub' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Link Google' }));

    await waitFor(() =>
      expect(calls.goTo).toEqual([
        'https://accounts.google.test/o/oauth2/auth?x=1',
      ]),
    );
    expect(calls.start).toEqual([
      ['usr_1', 'google', `${PORTAL}/oauth/callback?via=google&link=1`],
    ]);
  });

  it('a refused start is worded plainly and the browser stays', async () => {
    calls.startError = refused('CM-ERRORS-MEMBERSHIP-049');
    renderAt(ROUTES.SECURITY, { signedIn: true });
    fireEvent.click(screen.getByRole('button', { name: 'Link GitHub' }));

    expect(
      await screen.findByText(
        'Sign-in with GitHub is not available for this project.',
      ),
    ).toBeTruthy();
    expect(calls.goTo).toEqual([]);
    expect(
      (screen.getByRole('button', { name: 'Link GitHub' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('no offered provider: no card', () => {
    renderAt(ROUTES.SECURITY, { signedIn: true, config: CONFIG([]) });
    expect(screen.queryByText('Sign-in methods')).toBeNull();
    expect(screen.getByText('Change password')).toBeTruthy();
  });
});
