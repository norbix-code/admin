// The e-mail link pages while a project's Admin Portal is turned off.
//
// The gateway builds the password-reset and invitation links on the project's
// own portal (pr-<hex>.admin.<domain>) even when the project turned its
// portal off — owner decision 2026-10-15 #4 (gateway
// docs/tasks/owner-answers-2-3-0.md): "otherwise ... it shows the
// Norbix-branded portal instead of the personalised one". So a turned-off
// managed portal still serves these pages, with the Norbix look (no project
// name, colours or logo), and nothing else.
//
// Not the magic link (/oauth/callback): it signs the user in to the portal so
// they can add a new passkey there — with the portal off there is nothing to
// do after it, so it shows "Portal unavailable" like every other page.

import { ROUTES } from '@/routes';
import type { ProjectConfig } from '@/types/projectConfig';

/** The pages a turned-off portal still serves. */
export const PAGES_SERVED_WHILE_DISABLED: readonly string[] = [
  ROUTES.PASSWORD_RESET_CONFIRM,
  ROUTES.INVITATION_FINISH,
];

/** True when `pathname` is one of those pages (a trailing slash is allowed). */
export const isServedWhileDisabled = (pathname: string): boolean => {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PAGES_SERVED_WHILE_DISABLED.includes(path);
};

/** The project's config with the Norbix look: project branding and links dropped. */
export const norbixBranded = (config: ProjectConfig): ProjectConfig => ({
  ...config,
  branding: { displayName: 'Norbix' },
  links: {},
});
