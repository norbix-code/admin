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
const TEMPLATE = /^(https?):\/\/\{projectHostLabel\}\.([^/?#]+)(\/[^?#]*)?$/;

/** scheme, the host after the placeholder (with its port) and the path. */
function parts(
  apiUrlTemplate: string | null | undefined,
): { scheme: string; host: string; path: string } | null {
  const match = TEMPLATE.exec(apiUrlTemplate?.trim() ?? '');
  if (!match || match[2].includes(PLACEHOLDER)) return null;
  return { scheme: match[1], host: match[2], path: match[3] ?? '' };
}

/**
 * The shared API host a template stands on: `api.norbix.ai` for
 * `https://{projectHostLabel}.api.norbix.ai/v3` (with the port, if any). Null
 * for no template or one of another shape.
 */
export function sharedApiHostOf(
  apiUrlTemplate: string | null | undefined,
): string | null {
  return parts(apiUrlTemplate)?.host.toLowerCase() ?? null;
}

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
  if (!projectId) return null;
  const template = parts(apiUrlTemplate);
  const label = hostLabelFromViewId(projectId);
  if (!template || !label) return null;

  try {
    const url = new URL(
      `${template.scheme}://${label}.${template.host}${template.path}`,
    );
    if (!url.hostname.startsWith(`${label}.`)) return null;
    const path = url.pathname.replace(/\/+$/, '').replace(/\/v\d+$/, '');
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}
