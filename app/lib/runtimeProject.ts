// Runtime project pin for self-hosted installs (server env, read per request).
//
// NEXT_PUBLIC_ADMIN_PROJECT_ID is inlined into the browser bundle at BUILD
// time, so a public image (community-admin) cannot carry a customer's project.
// Instead the server reads PROJECT_ID at request time and the root layout
// emits it as <meta name="norbix-project" content="…">, which the client
// resolver already reads (src/config/project.ts, step 3). One image, any
// customer, any domain.
import { parseProjectIdFromHost } from '@/config/project';

// The gateway's ProjectId.ViewId: "pr_" + base62.
const VIEW_ID = /^pr_[0-9A-Za-z]{1,40}$/;

/**
 * Normalise a PROJECT_ID env value. Accepts the view id (`pr_{base62}`) or the
 * host label (`pr-{32 hex}`, converted to the view id). Anything else → null,
 * so a typo never reaches the gateway as a project header.
 */
export function runtimeProjectId(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (VIEW_ID.test(value)) return value;
  return parseProjectIdFromHost(value);
}
