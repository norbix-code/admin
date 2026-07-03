// Pure mapping from an Admin Portal structure → the dashboard nav cards.
// Fetching is owned by the RTK Query `portalApi.getStructure` endpoint; this
// module only turns the result into renderable nav, with a default fallback.

import { ROUTES } from '@/routes';
import type { AdminPortalStructure } from '@/services/portalApi';

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
    desc: 'Password and two-factor authentication.',
  },
  preferences: {
    to: ROUTES.PREFERENCES,
    desc: 'Choose which messages you receive.',
  },
  legal: { to: ROUTES.PRIVACY, desc: 'Export or delete your data.' },
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
  { to: ROUTES.PRIVACY, title: 'Privacy & data', desc: MODULE_ROUTES.legal.desc },
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
