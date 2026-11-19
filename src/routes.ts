export const ROUTES = {
  HOME: '/',
  // Auth (unauthenticated)
  SIGN_IN: '/sign-in',
  SIGN_UP: '/sign-up',
  PASSWORD_RESET: '/sign-in/reset',
  PASSWORD_RESET_CONFIRM: '/sign-in/reset/confirm',
  OAUTH_CALLBACK: '/oauth/callback',
  // An invited user finishes registration (link in the invitation e-mail,
  // token in the fragment — gateway MembershipPortalLinks.InvitationPath).
  INVITATION_FINISH: '/sign-up/invitation',
  // Public legal (canonical) + short aliases that redirect to them
  // Behind the footer links of a sent email (no sign-in: the signed hash in
  // the link is the key). The *-test paths are what a template preview links to.
  EMAIL_PREFERENCES: '/notifications/preferences',
  EMAIL_UNSUBSCRIBE: '/notifications/email-unsubscribe',
  EMAIL_PREVIEW: '/notifications/emails/preview',
  EMAIL_PREFERENCES_TEST: '/notifications/preferences-from-test',
  EMAIL_UNSUBSCRIBE_TEST: '/notifications/unsubscribe-from-category-test',
  EMAIL_PREVIEW_TEST: '/notifications/emails/preview-from-test',
  LEGAL_TERMS: '/legal/terms',
  LEGAL_PRIVACY: '/legal/privacy',
  TERMS_ALIAS: '/terms',
  POLICIES_ALIAS: '/policies',
  // Authed
  PROFILE: '/profile',
  SECURITY: '/security',
  SECURITY_PASSWORD: '/security/password',
  PREFERENCES: '/preferences',
} as const;
