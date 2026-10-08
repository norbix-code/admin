// Resolve which project this portal instance is showing.
//
// Resolution order (first hit wins):
//   1. Build-time pin (VITE_ADMIN_PROJECT_ID) — self-hosted / custom-domain
//      builds. No network call: you set it, the portal knows its project.
//   2. The managed host label — pr-{32 lower-case hex}.admin.norbix.ai, the
//      gateway's ProjectId.HostLabel (DNS-safe: no '_', one case). It is turned
//      back into the pr_{base62} id (ProjectId.ViewId) the gateway reads.
//   3. A <meta name="norbix-project"> tag, if an edge/host injected one.
//   4. Custom domain (e.g. admin.laimingaspilvukas.lt): the host carries no
//      pr- label, so ASK the managed service — GET hub.norbix.ai/{v}/admin-portal-id
//      ?host=<host> → { projectId } or 404. Only the managed-service Hub answers
//      (it owns the host→project map); self-hosted Hubs do not. This is async,
//      so it lives in resolveProjectIdAsync.
//   5. null → render the blank "no project" placeholder.

import { NORBIX_HUB_URL } from '@norbix.ai/ts';
import { PINNED_PROJECT_ID } from './env';

// ProjectId.HostLabel: "pr-" + the Guid as 32 hex digits ("N" format). The
// gateway parses it case-insensitively (ProjectId.TryParseHostLabel); browsers
// lower-case the host anyway. The older pr_{base62} host form cannot work in a
// browser: '_' is not a legal host character and lower-casing breaks base62.
const HOST_LABEL = /^pr-([0-9a-f]{32})$/i;

/**
 * The request headers that carry the project to the gateway. The API host's
 * global request filter reads `nb-project-id` (after the host, before the
 * query and the body — gateway CodeMashAppHostBase.cs); the sign-in provider
 * reads `norbix-project-id`. Send both so every call is scoped the same way.
 * (`X-Norbix-Project` was sent before and is read by nothing.)
 */
export function setProjectHeaders(
  headers: Headers,
  projectId: string | null | undefined,
): Headers {
  if (projectId) {
    headers.set('nb-project-id', projectId);
    headers.set('norbix-project-id', projectId);
  }
  return headers;
}

// The managed-service Hub that owns the custom-domain → projectId mapping. The
// host is the SDK's canonical public Hub URL (NOT a configurable env): a
// self-hosted hub is not the managed service and would not answer
// /admin-portal-id. Resolution by custom domain is a managed-service feature.
const MANAGED_SERVICE_HUB_ROOT = `${NORBIX_HUB_URL}/v3`;

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Turn the 32 hex digits of a Guid into the gateway's `pr_{base62}` view id —
 * the same steps as IdUtility.GenerateId / Base62Converter.ToBase62String:
 * .NET Guid.ToByteArray() order (the first three groups little-endian), read
 * as one unsigned little-endian number, written in base62.
 */
export function viewIdFromHex(hex: string): string {
  const h = hex.toLowerCase();
  const byteAt = (i: number) => h.slice(i * 2, i * 2 + 2);
  // Display order → ToByteArray order: reverse bytes 0-3, 4-5 and 6-7.
  const order = [3, 2, 1, 0, 5, 4, 7, 6, 8, 9, 10, 11, 12, 13, 14, 15];
  // Little-endian: the last byte of the array is the most significant.
  let value = 0n;
  for (let i = order.length - 1; i >= 0; i--) {
    value = (value << 8n) | BigInt(parseInt(byteAt(order[i]), 16));
  }
  let out = '';
  while (value > 0n) {
    out = BASE62[Number(value % 62n)] + out;
    value /= 62n;
  }
  return `pr_${out}`;
}

/**
 * Read the project from a managed host (`pr-<hex>.admin.norbix.ai`, any case,
 * optional port). Returns the `pr_{base62}` view id, or null when the first
 * label is not a host label.
 */
export function parseProjectIdFromHost(host: string): string | null {
  const firstLabel = host.split(':')[0].split('.')[0] ?? '';
  const match = HOST_LABEL.exec(firstLabel);
  return match ? viewIdFromHex(match[1]) : null;
}

function projectFromMetaTag(): string | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="norbix-project"]');
  const content = meta?.getAttribute('content')?.trim();
  return content && content.length > 0 ? content : null;
}

/** Synchronous resolution: pin → host label → meta tag. No network. */
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
