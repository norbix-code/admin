// @vitest-environment jsdom
// The password-reset link (/sign-in/reset/confirm#token=…): the page reads
// the one-time token from the fragment (query for links sent before), takes
// it out of the address bar at once and sends it only in the confirm POST
// body (gateway docs/tasks/link-tokens-in-fragment.md).
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
import { MemoryRouter } from 'react-router-dom';
import auth from '@/features/auth/slice';
import config from '@/config/slice';
import project from '@/features/project/slice';

const confirm = vi.hoisted(() => ({ calls: [] as unknown[] }));

vi.mock('@/services/norbix', () => ({
  useRequestPasswordResetMutation: () => [vi.fn(), {}],
  useConfirmPasswordResetMutation: () => [
    (body: unknown) => {
      confirm.calls.push(body);
      return { unwrap: async () => ({}) };
    },
    { isLoading: false, isSuccess: false, isError: false },
  ],
}));

const { PasswordResetConfirm } = await import('./passwordReset');

const open = (entry: string) =>
  render(
    <Provider
      store={configureStore({
        reducer: combineReducers({ auth, config, project }),
      })}
    >
      <MemoryRouter initialEntries={[entry]}>
        <PasswordResetConfirm />
      </MemoryRouter>
    </Provider>,
  );

const submit = () => {
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'Correct-Horse-9' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
};

afterEach(() => {
  cleanup();
  confirm.calls = [];
  vi.restoreAllMocks();
});

describe('PasswordResetConfirm', () => {
  it('new link: token from the fragment, address bar cleaned, token only in the POST body', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    open('/sign-in/reset/confirm#token=Ab%2Bc%3D');

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][2]).toBe('/sign-in/reset/confirm');

    submit();
    await waitFor(() =>
      expect(confirm.calls).toEqual([
        { token: 'Ab+c=', newPassword: 'Correct-Horse-9' },
      ]),
    );
  });

  it('link sent before: token from the query, query token removed', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    open('/sign-in/reset/confirm?token=old-1');

    expect(replace.mock.calls[0][2]).toBe('/sign-in/reset/confirm');

    submit();
    await waitFor(() =>
      expect(confirm.calls).toEqual([
        { token: 'old-1', newPassword: 'Correct-Horse-9' },
      ]),
    );
  });
});
