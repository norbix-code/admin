// @vitest-environment jsdom
// Adding a passkey in a recovery-link session. That session's token carries
// no login id, so the profile e-mail cannot be read: the card asks for it,
// proves it with the e-mailed code (the gateway's registration is e-mail
// based) and, once the passkey exists, the recovery is over.
//
// The data hooks and the WebAuthn ceremony are mocked.
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
import auth, { signedIn } from '@/features/auth/slice';

const calls = vi.hoisted(() => ({
  start: [] as unknown[],
  confirm: [] as unknown[],
  verify: [] as unknown[],
}));

const mutation =
  (log: unknown[], answer: unknown = {}) =>
  () => [
    (body: unknown) => {
      log.push(body);
      return { unwrap: async () => answer };
    },
    { isLoading: false },
  ];

vi.mock('@/services/norbix', () => ({
  useGetUserQuery: () => ({ data: undefined, isLoading: false }),
  useListPasskeysQuery: () => ({ data: { passkeys: [] }, isLoading: false }),
  useRenamePasskeyMutation: () => [vi.fn(), { isLoading: false }],
  useRevokePasskeyMutation: () => [vi.fn(), { isLoading: false }],
  useStartEmailVerificationMutation: mutation(calls.start),
  useConfirmEmailVerificationMutation: mutation(calls.confirm, {
    verificationToken: 'vt',
  }),
  usePasskeyRegistrationOptionsMutation: mutation([], {
    ceremonyId: 'c1',
    optionsJson: '{}',
  }),
  useVerifyPasskeyRegistrationMutation: mutation(calls.verify),
}));

vi.mock('./webauthn', () => ({
  isWebAuthnAvailable: () => true,
  createPasskey: async () => '{"attestation":true}',
}));

const { PasskeysCard } = await import('./passkeys');

afterEach(() => {
  cleanup();
  calls.start.length = 0;
  calls.confirm.length = 0;
  calls.verify.length = 0;
});

describe('Passkeys card in a recovery session', () => {
  it('asks for the e-mail, registers the passkey and ends the recovery', async () => {
    const store = configureStore({ reducer: combineReducers({ auth }) });
    store.dispatch(
      signedIn({ token: 'recovery.jwt', userId: '', recovery: true }),
    );
    render(
      <Provider store={store}>
        <PasskeysCard />
      </Provider>,
    );

    const add = screen.getByRole('button', { name: 'Add a passkey' });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Your e-mail'), {
      target: { value: ' anna@shop.test ' },
    });
    fireEvent.click(add);

    fireEvent.change(await screen.findByLabelText('Verification code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add passkey' }));

    expect(await screen.findByText(/Passkey added/)).toBeTruthy();
    expect(calls.start).toEqual([{ email: 'anna@shop.test' }]);
    expect(calls.confirm).toEqual([
      { email: 'anna@shop.test', code: '123456' },
    ]);
    expect(calls.verify).toHaveLength(1);
    await waitFor(() => expect(store.getState().auth.recovery).toBe(false));
    // Still signed in with the recovery session's token.
    expect(store.getState().auth.token).toBe('recovery.jwt');
  });
});
