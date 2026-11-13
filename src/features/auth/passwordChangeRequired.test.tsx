// @vitest-environment jsdom
// passwordChangeRequired: a project password sign-in whose typed password
// breaks the project's current rules still succeeds, and the gateway says so
// in `meta.passwordChangeRequired: "true"`. The sign-in screen then goes to
// the change-password step instead of home; the step changes the password,
// signs in again with the new one (the change ends the old session) and goes
// home.
//
// The data hooks are mocked (RTK Query cannot fetch under jsdom here); the
// screens' own rules are what is under test.
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
import config from '@/config/slice';
import project from '@/features/project/slice';
import { ROUTES } from '@/routes';
import type { ProjectConfig } from '@/types/projectConfig';

const api = vi.hoisted(() => ({
  loginAnswers: [] as unknown[],
  loginCalls: [] as unknown[],
  changeCalls: [] as unknown[],
  changeFails: false,
}));

vi.mock('@/services/publicApi', () => ({
  useGetLegalDocumentQuery: () => ({ data: { available: false } }),
}));

vi.mock('@/services/norbix', () => ({
  useLoginMutation: () => [
    (body: unknown) => {
      api.loginCalls.push(body);
      const answer = api.loginAnswers.shift();
      return { unwrap: async () => answer };
    },
    { isLoading: false, isError: false },
  ],
  useChangePasswordMutation: () => [
    (body: unknown) => {
      api.changeCalls.push(body);
      return {
        unwrap: async () => {
          if (api.changeFails) throw new Error('400');
          return {};
        },
      };
    },
    { isLoading: false },
  ],
  usePasskeyAuthenticationOptionsMutation: () => [vi.fn()],
  useVerifyPasskeyAuthenticationMutation: () => [vi.fn()],
}));

const { Login } = await import('./login');
const { PasswordChangeRequired } = await import('./passwordChangeRequired');
const { RequireAuth } = await import('./requireAuth');

const CONFIG = {
  projectId: 'pr_1',
  branding: { displayName: 'Shop' },
  auth: {
    socialProviders: [],
    passkey: false,
    methods: ['email'],
    passwordPolicy: { minLength: 6 },
    exposed: false,
  },
  links: {},
} as ProjectConfig;

function renderApp(entry: string, { signedInAlready = false } = {}) {
  const store = configureStore({
    reducer: combineReducers({ auth, config, project }),
  });
  if (signedInAlready) {
    store.dispatch(signedIn({ token: 'old.token', userId: 'usr_1' }));
  }
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={ROUTES.SIGN_IN} element={<Login config={CONFIG} />} />
          <Route
            path={ROUTES.SECURITY_PASSWORD}
            element={
              <RequireAuth>
                <PasswordChangeRequired config={CONFIG} />
              </RequireAuth>
            }
          />
          <Route path={ROUTES.HOME} element={<p>Landing page</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

const signIn = (password: string) => {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'anna@shop.test' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

const REASON =
  "Your password does not meet the project's password rules any more. Please choose a new one.";

afterEach(() => {
  cleanup();
  api.loginAnswers = [];
  api.loginCalls = [];
  api.changeCalls = [];
  api.changeFails = false;
});

describe('sign-in with meta.passwordChangeRequired', () => {
  it('"true" sends the user to the change-password step with the reason', async () => {
    api.loginAnswers.push({
      bearerToken: 'old.token',
      userId: 'usr_1',
      meta: { credentialVersion: 'v1', passwordChangeRequired: 'true' },
    });
    renderApp(ROUTES.SIGN_IN);
    signIn('abc');

    expect(await screen.findByText(REASON)).toBeTruthy();
    expect(screen.queryByText('Landing page')).toBeNull();
  });

  it('absent goes to the landing page as before', async () => {
    api.loginAnswers.push({
      bearerToken: 'old.token',
      userId: 'usr_1',
      meta: { credentialVersion: 'v1' },
    });
    renderApp(ROUTES.SIGN_IN);
    signIn('long-enough');

    expect(await screen.findByText('Landing page')).toBeTruthy();
    expect(screen.queryByText(REASON)).toBeNull();
  });

  it('a password shorter than the current rule is still sent (only the gateway decides)', async () => {
    api.loginAnswers.push({ bearerToken: 'old.token', userId: 'usr_1' });
    renderApp(ROUTES.SIGN_IN);
    signIn('abc');

    await waitFor(() => expect(api.loginCalls).toHaveLength(1));
    expect(api.loginCalls[0]).toMatchObject({
      userName: 'anna@shop.test',
      password: 'abc',
    });
  });
});

describe('the change-password step', () => {
  const reachStep = async () => {
    api.loginAnswers.push({
      bearerToken: 'old.token',
      userId: 'usr_1',
      meta: { passwordChangeRequired: 'true' },
    });
    renderApp(ROUTES.SIGN_IN);
    signIn('abc');
    await screen.findByText(REASON);
  };

  const choose = (current: string, next: string) => {
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: current },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: next },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
  };

  it('changes the password, signs in again with the new one, then goes home', async () => {
    await reachStep();
    api.loginAnswers.push({ bearerToken: 'new.token', userId: 'usr_1' });
    choose('abc', 'new-password-1');

    expect(await screen.findByText('Landing page')).toBeTruthy();
    expect(api.changeCalls).toEqual([
      { currentPassword: 'abc', newPassword: 'new-password-1' },
    ]);
    expect(api.loginCalls[1]).toMatchObject({
      provider: 'credentials',
      userName: 'anna@shop.test',
      password: 'new-password-1',
    });
  });

  it('checks the new password against the project rule before sending', async () => {
    await reachStep();
    choose('abc', 'short');

    expect(await screen.findByText('Minimum 6 characters')).toBeTruthy();
    expect(api.changeCalls).toHaveLength(0);
  });

  it('stays on the step with an error when the change is refused', async () => {
    await reachStep();
    api.changeFails = true;
    choose('wrong', 'new-password-1');

    expect(
      await screen.findByText(/Could not change the password/),
    ).toBeTruthy();
    expect(screen.getByText(REASON)).toBeTruthy();
    expect(api.loginCalls).toHaveLength(1);
  });

  it('opened directly, without the sign-in answer behind it, goes home', async () => {
    renderApp(ROUTES.SECURITY_PASSWORD, { signedInAlready: true });

    expect(await screen.findByText('Landing page')).toBeTruthy();
    expect(screen.queryByText(REASON)).toBeNull();
  });
});
