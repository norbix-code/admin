// @vitest-environment jsdom
// The invitation link (/sign-up/invitation#token=…): the page reads the
// one-time token from the fragment, takes it out of the address bar at once
// and sends it only in the finish POST body (gateway registration-settings).
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

const finish = vi.hoisted(() => ({
  calls: [] as unknown[],
  state: { isLoading: false, isSuccess: false, isError: false } as Record<
    string,
    unknown
  >,
}));

vi.mock('@/services/publicApi', () => ({
  useFinishInvitationMutation: () => [
    (body: unknown) => {
      finish.calls.push(body);
      return { unwrap: async () => ({}) };
    },
    finish.state,
  ],
}));

const { InvitationFinish } = await import('./invitation');

const open = (entry: string) =>
  render(
    <Provider
      store={configureStore({
        reducer: combineReducers({ auth, config, project }),
      })}
    >
      <MemoryRouter initialEntries={[entry]}>
        <InvitationFinish />
      </MemoryRouter>
    </Provider>,
  );

afterEach(() => {
  cleanup();
  finish.calls = [];
  finish.state = { isLoading: false, isSuccess: false, isError: false };
  vi.restoreAllMocks();
});

describe('InvitationFinish', () => {
  it('token from the fragment, address bar cleaned, token only in the POST body', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    open('/sign-up/invitation#token=In%2Bv%3D');

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][2]).toBe('/sign-up/invitation');

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Happy-Tummy-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));

    // No names typed: nothing but the token and the password is sent, so the
    // gateway keeps the names the admin entered.
    await waitFor(() =>
      expect(finish.calls).toEqual([
        { token: 'In+v=', password: 'Happy-Tummy-2026!' },
      ]),
    );
  });

  // Owner decision 2026-10-15 #3: the e-mail is shown read-only (it cannot
  // change); the user may override the full name and the salutation.
  it('shows the e-mail read-only and sends the full name and salutation the user typed', async () => {
    const replace = vi.spyOn(window.history, 'replaceState');
    open('/sign-up/invitation#token=abc&email=ona%40happytummy.lt');

    // Both the token and the e-mail leave the address bar.
    expect(replace.mock.calls[0][2]).toBe('/sign-up/invitation');

    const email = screen.getByLabelText('E-mail') as HTMLInputElement;
    expect(email.value).toBe('ona@happytummy.lt');
    expect(email.readOnly).toBe(true);
    expect(email.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Full name (optional)'), {
      target: { value: '  Ona   Petraitė ' },
    });
    fireEvent.change(screen.getByLabelText('Salutation (optional)'), {
      target: { value: ' Ona ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Happy-Tummy-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));

    await waitFor(() =>
      expect(finish.calls).toEqual([
        {
          token: 'abc',
          password: 'Happy-Tummy-2026!',
          fullName: 'Ona Petraitė',
          salutation: 'Ona',
        },
      ]),
    );
  });

  it('without an e-mail in the link the page still works (older links)', () => {
    open('/sign-up/invitation#token=abc');

    expect(screen.queryByLabelText('E-mail')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Create my account' }),
    ).toBeTruthy();
  });

  it('a link without a token shows an error and no form', () => {
    open('/sign-up/invitation');

    expect(
      screen.getByText(/This invitation link is not complete/),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Create my account' }),
    ).toBeNull();
  });

  it("shows the gateway's reason when the link is refused", () => {
    finish.state = {
      isLoading: false,
      isSuccess: false,
      isError: true,
      error: {
        data: {
          responseStatus: {
            errors: [
              {
                message:
                  'This invitation link is not valid or has expired. Ask for a new invitation.',
              },
            ],
          },
        },
      },
    };
    open('/sign-up/invitation#token=used');

    expect(
      screen.getByText(
        'This invitation link is not valid or has expired. Ask for a new invitation.',
      ),
    ).toBeTruthy();
  });

  it('after success it offers sign-in', () => {
    finish.state = { isLoading: false, isSuccess: true, isError: false };
    open('/sign-up/invitation#token=ok');

    expect(screen.getByText(/Your account is ready/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
  });
});
