// Pure mapping from an Admin Portal structure → the dashboard nav cards.
// Fetching is owned by the RTK Query `portalApi.getStructure` endpoint; this
// module only turns the result into renderable nav, with a default fallback.

import { ROUTES } from '@/routes';
import type { AdminPortalStructure } from '@/services/portalApi';

/**
 * The Privacy & data page (export / delete my data) calls /me/compliance,
 * /me/compliance/export and /me/compliance/delete, which the gateway does not
 * have (404). Cloud must define the privacy flows first (Project Settings →
 * Access / legal documents, Compliance settings); the portal then renders what
 * Cloud defines. Until then the page, its nav entry and its Home card are
 * hidden. The public /legal/terms and /legal/privacy pages are not affected.
 */
export const PRIVACY_PAGE_ENABLED = false;

export interface NavCard {
  to: string;
  title: string;
  desc: string;
}

// Maps a structure module key → the portal route + copy. Unknown keys are
// skipped (the portal only renders modules it has a screen for).
const MODULE_ROUTES: Record<string, { to: string; desc: string }> = {
  profile: { to: ROUTES.PROFILE, desc: 'Update your contact information.' },
  security: {
    to: ROUTES.SECURITY,
    // Two-factor sign-in is not built yet (Membership task) — do not promise it.
    desc: 'Password and passkeys.',
  },
  preferences: {
    to: ROUTES.PREFERENCES,
    desc: 'Choose which messages you receive.',
  },
  ...(PRIVACY_PAGE_ENABLED
    ? { legal: { to: ROUTES.PRIVACY, desc: 'Export or delete your data.' } }
    : {}),
};

// The layout the portal falls back to when structure can't be loaded — the
// standard end-user modules, all on.
export const DEFAULT_NAV_CARDS: NavCard[] = [
  { to: ROUTES.PROFILE, title: 'Profile', desc: MODULE_ROUTES.profile.desc },
  { to: ROUTES.SECURITY, title: 'Security', desc: MODULE_ROUTES.security.desc },
  {
    to: ROUTES.PREFERENCES,
    title: 'Preferences',
    desc: MODULE_ROUTES.preferences.desc,
  },
  ...(PRIVACY_PAGE_ENABLED
    ? [
        {
          to: ROUTES.PRIVACY,
          title: 'Privacy & data',
          desc: 'Export or delete your data.',
        },
      ]
    : []),
];

/** Turn a structure into the nav cards the dashboard renders. */
export function navCardsFromStructure(
  structure: AdminPortalStructure | undefined,
): NavCard[] {
  if (!structure || structure.modules.length === 0) return DEFAULT_NAV_CARDS;

  const cards = structure.modules
    .filter((m) => m.enabled && MODULE_ROUTES[m.key])
    .map((m) => ({
      to: MODULE_ROUTES[m.key].to,
      title: m.displayName,
      desc: MODULE_ROUTES[m.key].desc,
    }));

  return cards.length > 0 ? cards : DEFAULT_NAV_CARDS;
}
