import { describe, expect, it } from 'vitest';
import {
  isServedWhileDisabled,
  norbixBranded,
} from '@/config/disabledPortal';
import type { ProjectConfig } from '@/types/projectConfig';

// Owner decision 2026-10-15 #4: a turned-off managed portal still serves the
// password-reset and invitation link pages, Norbix-branded.
describe('a turned-off portal', () => {
  it('serves only the password-reset and invitation link pages', () => {
    expect({
      resetConfirm: isServedWhileDisabled('/sign-in/reset/confirm'),
      resetConfirmSlash: isServedWhileDisabled('/sign-in/reset/confirm/'),
      invitation: isServedWhileDisabled('/sign-up/invitation'),
      magicLink: isServedWhileDisabled('/oauth/callback'),
      signIn: isServedWhileDisabled('/sign-in'),
      resetRequest: isServedWhileDisabled('/sign-in/reset'),
      home: isServedWhileDisabled('/'),
    }).toEqual({
      resetConfirm: true,
      resetConfirmSlash: true,
      invitation: true,
      magicLink: false,
      signIn: false,
      resetRequest: false,
      home: false,
    });
  });

  it('drops the project look but keeps its password policy', () => {
    const project = {
      branding: {
        displayName: 'Laimingas pilvukas',
        mainColor: '#ff0066',
        logoUrl: 'https://cdn.example/logo.png',
      },
      auth: {
        socialProviders: [],
        passkey: false,
        methods: ['email'],
        passwordPolicy: { minLength: 12, minSpecial: 1 },
        exposed: true,
      },
      links: { website: 'https://laimingaspilvukas.lt' },
    } as unknown as ProjectConfig;

    const branded = norbixBranded(project);
    expect({
      branding: branded.branding,
      links: branded.links,
      passwordPolicy: branded.auth.passwordPolicy,
    }).toEqual({
      branding: { displayName: 'Norbix' },
      links: {},
      passwordPolicy: { minLength: 12, minSpecial: 1 },
    });
  });
});
