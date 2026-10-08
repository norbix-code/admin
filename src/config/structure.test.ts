import { describe, it, expect } from 'vitest';
import { DEFAULT_NAV_CARDS, navCardsFromStructure } from './structure';
import { ROUTES } from '@/routes';
import type { AdminPortalStructure } from '@/services/portalApi';

const structure = (keys: string[]): AdminPortalStructure =>
  ({
    projectId: 'pr_x',
    adminPortalEnabled: true,
    displayName: '',
    modules: keys.map((key) => ({ key, displayName: key, enabled: true })),
  }) as AdminPortalStructure;

describe('navCardsFromStructure', () => {
  it('hides the Privacy & data card while the compliance API is missing', () => {
    const cards = navCardsFromStructure(
      structure(['profile', 'security', 'preferences', 'legal']),
    );
    expect(cards.map((c) => c.to)).toEqual([
      ROUTES.PROFILE,
      ROUTES.SECURITY,
      ROUTES.PREFERENCES,
    ]);
  });

  it('has no Privacy & data card in the default layout either', () => {
    expect(DEFAULT_NAV_CARDS.map((c) => c.to)).not.toContain(ROUTES.PRIVACY);
  });

  it('does not promise two-factor on the Security card (not built yet)', () => {
    const security = DEFAULT_NAV_CARDS.find((c) => c.to === ROUTES.SECURITY);
    expect(security?.desc).toBe('Password and passkeys.');
    expect(security?.desc.toLowerCase()).not.toContain('two-factor');
  });
});
