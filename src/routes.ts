export const ROUTES = {
  HOME: '/',
  // Auth (unauthenticated)
  SIGN_IN: '/sign-in',
  PASSWORD_RESET: '/sign-in/reset',
  PASSWORD_RESET_CONFIRM: '/sign-in/reset/confirm',
  OAUTH_CALLBACK: '/oauth/callback',
  // Public legal (canonical) + short aliases that redirect to them
  LEGAL_TERMS: '/legal/terms',
  LEGAL_PRIVACY: '/legal/privacy',
  TERMS_ALIAS: '/terms',
  POLICIES_ALIAS: '/policies',
  // Authed
  PROFILE: '/profile',
  SECURITY: '/security',
  SECURITY_PASSWORD: '/security/password',
  SECURITY_2FA: '/security/2fa',
  PREFERENCES: '/preferences',
  PRIVACY: '/privacy',
} as const;
