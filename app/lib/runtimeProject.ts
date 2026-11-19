// The PROJECT_ID value, checked.
//
// The server reads PROJECT_ID at request time (never baked into the build), so
// one image works for any project on any address. The root layout writes the
// checked id into the page as <meta name="norbix-project" content="…">, which
// the browser reads (src/config/project.ts).
import { viewIdFromHostLabel } from '@/config/project';

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
  return viewIdFromHostLabel(value);
}
