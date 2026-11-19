// A project's own API host.
//
// An install with regions gives every project its own API host,
// pr-<32 hex>.api.<domain>, and announces it in the Hub's /echo as
// `apiUrlTemplate` (https://{projectHostLabel}.api.<domain>/v3). DNS sends
// that host to the region that processes the project. The shared host
// (api.<domain>) refuses a project of another region (CM-ERRORS-PROJECTS-040),
// so a call for a project must go to the project's host.
//
// An install that announces no template (self-hosted, staging) has one API
// host for everything: these functions answer null and the caller keeps it.

import { hostLabelFromViewId } from './project';

const PLACEHOLDER = '{projectHostLabel}';

/**
 * The project's API base without the version (`https://pr-<hex>.api.<domain>`),
 * or null when the install has no template, the template is not an http(s)
 * address with the placeholder as its first host label, or the id is not a
 * project view id. The host is built only from the template the Hub announced
 * and the 32 hex digits of the id — never from text a caller sent.
 */
export function projectApiBase(
  apiUrlTemplate: string | null | undefined,
  projectId: string | null | undefined,
): string | null {
  if (!apiUrlTemplate || !projectId) return null;
  const label = hostLabelFromViewId(projectId);
  if (!label) return null;

  const template = apiUrlTemplate.trim();
  const match =
    /^(https?):\/\/\{projectHostLabel\}\.([^/?#]+)(\/[^?#]*)?$/.exec(template);
  if (!match || match[2].includes(PLACEHOLDER)) return null;

  try {
    const url = new URL(`${match[1]}://${label}.${match[2]}${match[3] ?? ''}`);
    if (!url.hostname.startsWith(`${label}.`)) return null;
    const path = url.pathname.replace(/\/+$/, '').replace(/\/v\d+$/, '');
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}
