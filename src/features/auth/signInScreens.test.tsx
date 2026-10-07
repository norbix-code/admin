// @vitest-environment jsdom
// F38 — the sign-in screens: no empty "or continue with" when the browser has
// no WebAuthn, Terms / Privacy links filled from the published legal docs, and
// the reset form says "sent" only when the call succeeded.
//
// The data hooks are mocked: RTK Query cannot fetch under jsdom here (its
// AbortSignal is not the one Node's Request accepts), and the screens' own
// rules are what is under test.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import auth from '@/features/auth/slice';
import config from '@/config/slice';
import project from '@/features/project/slice';
import type { ProjectConfig } from '@/types/projectConfig';

const legal = vi.hoisted(() => ({
  available: { terms: false, privacy: false } as Record<string, boolean>,
}));
const reset = vi.hoisted(() => ({ fails: false }));

vi.mock('@/services/publicApi', () => ({
  useGetLegalDocumentQuery: (kind: 'terms' | 'privacy') => ({
    data: { kind, body: '', available: legal.available[kind] },
  }),
}));

vi.mock('@/services/norbix', async () => {
  const { useState } = await import('react');
  return {
    useLoginMutation: () => [vi.fn(), { isLoading: false, isError: false }],
    usePasskeyAuthenticationOptionsMutation: () => [vi.fn()],
    useVerifyPasskeyAuthenticationMutation: () => [vi.fn()],
    useConfirmPasswordResetMutation: () => [vi.fn(), {}],
    useRequestPasswordResetMutation: () => {
      const [isError, setError] = useState(false);
      const request = () => ({
        unwrap: async () => {
          if (reset.fails) {
            setError(true);
            throw new Error('500');
          }
        },
      });
      return [request, { isLoading: false, isError }];
    },
  };
});

const { Login } = await import('./login');
const { PasswordResetRequest } = await import('./passwordReset');

const CONFIG = {
  projectId: 'pr_1',
  branding: { displayName: 'Shop' },
  auth: {
    socialProviders: [],
    passkey: true,
    methods: ['email'],
    passwordPolicy: { minLength: 3 },
    exposed: false,
  },
  links: {},
} as ProjectConfig;

const renderWith = (ui: React.ReactElement) =>
  render(
    <Provider
      store={configureStore({
        reducer: combineReducers({ auth, config, project }),
      })}
    >
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>,
  );

afterEach(() => {
  cleanup();
  legal.available = { terms: false, privacy: false };
  reset.fails = false;
});

describe('Login', () => {
  it('shows no "or continue with" when passkeys are on but WebAuthn is missing', () => {
    renderWith(<Login config={CONFIG} />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByText('or continue with')).toBeNull();
  });

  it('links the published Terms page and leaves out an unpublished Privacy page', () => {
    legal.available = { terms: true, privacy: false };
    renderWith(<Login config={CONFIG} />);
    const terms = screen.getByRole('link', { name: 'Terms' });
    expect(terms.getAttribute('href')).toBe('/legal/terms');
    expect(screen.queryByRole('link', { name: 'Privacy' })).toBeNull();
  });

  it('a link set in the project config wins', () => {
    legal.available = { terms: true, privacy: true };
    renderWith(
      <Login
        config={{ ...CONFIG, links: { privacyUrl: 'https://x.test/p' } }}
      />,
    );
    expect(
      screen.getByRole('link', { name: 'Privacy' }).getAttribute('href'),
    ).toBe('https://x.test/p');
  });
});

describe('PasswordResetRequest', () => {
  const submit = () => {
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'a@b.co' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  };

  it('says the link is on its way only after the call succeeded', async () => {
    renderWith(<PasswordResetRequest />);
    submit();
    expect(await screen.findByText(/a reset link is on its way/)).toBeTruthy();
  });

  it('keeps the form and shows an error when the call fails', async () => {
    reset.fails = true;
    renderWith(<PasswordResetRequest />);
    submit();
    expect(
      await screen.findByText(/Could not send the reset link/),
    ).toBeTruthy();
    expect(screen.queryByText(/a reset link is on its way/)).toBeNull();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });
});
