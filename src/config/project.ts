// Resolve which project this portal instance is showing.
//
// Resolution order (first hit wins):
//   1. Build-time pin (VITE_ADMIN_PROJECT_ID) — self-hosted / custom-domain
//      builds. No network call: you set it, the portal knows its project.
//   2. The pr_{base62} subdomain prefix — managed multi-tenant
//      (pr_x.admin.norbix.ai). Extracted from the hostname.
//   3. A <meta name="norbix-project"> tag, if an edge/host injected one.
//   4. Custom domain (e.g. admin.laimingaspilvukas.lt): the host carries no
//      pr_ id, so ASK the managed service — GET hub.norbix.ai/{v}/admin-portal-id
//      ?host=<host> → { projectId } or 404. Only the managed-service Hub answers
//      (it owns the host→project map); self-hosted Hubs do not. This is async,
//      so it lives in resolveProjectIdAsync.
//   5. null → render the blank "no project" placeholder.

import { NORBIX_HUB_URL } from '@norbix.ai/ts';
import { PINNED_PROJECT_ID } from './env';

const PR_PREFIX = /^pr_([0-9A-Za-z]+)$/;

// The managed-service Hub that owns the custom-domain → projectId mapping. The
// host is the SDK's canonical public Hub URL (NOT a configurable env): a
// self-hosted hub is not the managed service and would not answer
// /admin-portal-id. Resolution by custom domain is a managed-service feature.
const MANAGED_SERVICE_HUB_ROOT = `${NORBIX_HUB_URL}/v3`;

export function parseProjectIdFromHost(host: string): string | null {
  const firstLabel = host.split('.')[0] ?? '';
  const match = PR_PREFIX.exec(firstLabel);
  return match ? match[1] : null;
}

function projectFromMetaTag(): string | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="norbix-project"]');
  const content = meta?.getAttribute('content')?.trim();
  return content && content.length > 0 ? content : null;
}

/** Synchronous resolution: pin → subdomain → meta tag. No network. */
export function resolveProjectId(host?: string): string | null {
  if (PINNED_PROJECT_ID) return PINNED_PROJECT_ID;

  const h =
    host ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  const fromHost = parseProjectIdFromHost(h);
  if (fromHost) return fromHost;

  return projectFromMetaTag();
}

/**
 * Ask the managed service which project a custom domain maps to. Bare GET with
 * no custom headers, so it stays a CORS "simple request" (no preflight); the
 * managed Hub returns the id-only body with a permissive CORS header. Returns
 * null on 404 / network error / non-managed deployment.
 */
export async function resolveProjectIdByHost(
  host: string,
): Promise<string | null> {
  try {
    const url = `${MANAGED_SERVICE_HUB_ROOT}/admin-portal-id?host=${encodeURIComponent(host)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as { projectId?: string };
    const id = body.projectId?.trim();
    return id && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Full resolution: the synchronous paths first, then — for a custom domain —
 * the managed-service host lookup. This is what App boot calls.
 */
export async function resolveProjectIdAsync(
  host?: string,
): Promise<string | null> {
  const sync = resolveProjectId(host);
  if (sync) return sync;

  const h =
    host ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  if (!h) return null;
  return resolveProjectIdByHost(h);
}
