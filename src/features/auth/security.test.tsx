// @vitest-environment jsdom
// The Security page's "Change password" card. A password change ends the
// session it was made with: the gateway refuses a token that names an older
// credential version (cm_cv). So after a successful change the card signs in
// again with the login name of the password sign-in and the new password, and
// stays on the Security page with "Password changed." Without a login name
// (passkey or social sign-in) the user is signed out and sent to sign in.
//
// The data hooks are mocked (RTK Query cannot fetch under jsdom here).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import auth, { signedIn } from '@/features/auth/slice';
import config from '@/config/slice';
import project from '@/features/project/slice';
import { ROUTES } from '@/routes';

const api = vi.hoisted(() => ({
  loginAnswers: [] as unknown[],
  loginCalls: [] as unknown[],
  changeCalls: [] as unknown[],
  changeError: null as unknown,
}));

vi.mock('@/services/norbix', () => ({
  useLoginMutation: () => [
    (body: unknown) => {
      api.loginCalls.push(body);
      const answer = api.loginAnswers.shift();
      return { unwrap: async () => answer };
    },
    { isLoading: false },
  ],
  useChangePasswordMutation: () => [
    (body: unknown) => {
      api.changeCalls.push(body);
      return {
        unwrap: async () => {
          if (api.changeError) throw api.changeError;
          return {};
        },
      };
    },
    { isLoading: false, isError: false },
  ],
}));

// The passkeys card has its own data and tests.
vi.mock('./passkeys', () => ({ PasskeysCard: () => null }));

const { SecurityOverview } = await import('./security');

function renderSecurity(loginName?: string) {
  const store = configureStore({
    reducer: combineReducers({ auth, config, project }),
  });
  store.dispatch(signedIn({ token: 'old.token', userId: 'usr_1', loginName }));
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[ROUTES.SECURITY]}>
        <Routes>
          <Route path={ROUTES.SECURITY} element={<SecurityOverview />} />
          <Route path={ROUTES.SIGN_IN} element={<p>Sign-in screen</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

const changeTo = (next: string) => {
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: 'old-password' },
  });
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: next },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
};

afterEach(() => {
  cleanup();
  api.loginAnswers = [];
  api.loginCalls = [];
  api.changeCalls = [];
  api.changeError = null;
});

describe('Security → Change password', () => {
  it('signs in again with the new password and stays here with "Password changed."', async () => {
    const store = renderSecurity('anna@shop.test');
    api.loginAnswers.push({ bearerToken: 'new.token', userId: 'usr_1' });
    changeTo('new-password-1');

    expect(await screen.findByText('Password changed.')).toBeTruthy();
    expect(api.changeCalls).toEqual([
      { currentPassword: 'old-password', newPassword: 'new-password-1' },
    ]);
    expect(api.loginCalls).toEqual([
      {
        provider: 'credentials',
        userName: 'anna@shop.test',
        password: 'new-password-1',
      },
    ]);
    expect(store.getState().auth.token).toBe('new.token');
  });

  it('without a login name (passkey or social sign-in) signs out and goes to sign in', async () => {
    const store = renderSecurity(undefined);
    changeTo('new-password-1');

    expect(await screen.findByText('Sign-in screen')).toBeTruthy();
    expect(api.loginCalls).toHaveLength(0);
    expect(store.getState().auth.token).toBeNull();
  });

  it('when the new sign-in fails, signs out and goes to sign in', async () => {
    const store = renderSecurity('anna@shop.test');
    api.loginAnswers.push(undefined);
    changeTo('new-password-1');

    expect(await screen.findByText('Sign-in screen')).toBeTruthy();
    expect(store.getState().auth.token).toBeNull();
  });

  it('a refused change says why, stays signed in and does not sign in again', async () => {
    const store = renderSecurity('anna@shop.test');
    api.changeError = {
      status: 400,
      data: {
        responseStatus: {
          errors: [
            {
              errorCode: 'CM-ERRORS-MEMBERSHIP-USERS-024',
              message: 'Email or current password is invalid',
            },
          ],
        },
      },
    };
    changeTo('new-password-1');

    expect(
      await screen.findByText('The current password is not right.'),
    ).toBeTruthy();
    expect(api.loginCalls).toHaveLength(0);
    expect(store.getState().auth.token).toBe('old.token');
  });
});
