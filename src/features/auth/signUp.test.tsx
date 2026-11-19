// @vitest-environment jsdom
// The sign-up page: it sends the e-mail and password to the gateway, shows
// the gateway's own words when the project does not let anyone sign up, and
// checks the password against the project's rules before sending.
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
import type { ProjectConfig } from '@/types/projectConfig';

const gateway = vi.hoisted(() => ({
  calls: [] as unknown[],
  state: {} as { isSuccess?: boolean; error?: unknown },
}));

vi.mock('@/services/norbix', () => ({
  useSaveEmailUserMutation: () => [
    (body: unknown) => {
      gateway.calls.push(body);
      return { unwrap: async () => ({}) };
    },
    { isLoading: false, ...gateway.state },
  ],
}));

const { SignUp, signUpErrorMessage } = await import('./signUp');

const projectConfig = {
  projectId: 'pr_x',
  branding: { displayName: 'Acme' },
  auth: {
    passkey: false,
    methods: ['email'],
    passwordPolicy: { minLength: 8 },
    exposed: true,
  },
  links: {},
} as unknown as ProjectConfig;

const open = () =>
  render(
    <Provider
      store={configureStore({
        reducer: combineReducers({ auth, config, project }),
      })}
    >
      <MemoryRouter initialEntries={['/sign-up']}>
        <SignUp config={projectConfig} />
      </MemoryRouter>
    </Provider>,
  );

const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
};

afterEach(() => {
  cleanup();
  gateway.calls = [];
  gateway.state = {};
});

describe('SignUp', () => {
  it('sends the trimmed e-mail and the password', async () => {
    open();
    fill('  ana@example.com ', 'Correct-Horse-9');
    await waitFor(() =>
      expect(gateway.calls).toEqual([
        { email: 'ana@example.com', password: 'Correct-Horse-9' },
      ]),
    );
  });

  it("does not send a password that breaks the project's rules", async () => {
    open();
    fill('ana@example.com', 'short');
    expect(await screen.findByText('Minimum 8 characters')).toBeTruthy();
    expect(gateway.calls).toEqual([]);
  });

  it("shows the gateway's message when the project refuses the sign-up", () => {
    gateway.state = { error: { message: 'This project is invite-only.' } };
    open();
    expect(screen.getByText('This project is invite-only.')).toBeTruthy();
  });

  it('falls back to a plain message when the gateway gives none', () => {
    expect([
      signUpErrorMessage(undefined),
      signUpErrorMessage({ message: ' ' }),
    ]).toEqual([
      'Could not create the account. Please try again.',
      'Could not create the account. Please try again.',
    ]);
  });
});
