// Which project this portal shows, and the two spellings of a project id.
//
// The project comes ONLY from configuration: the server variable PROJECT_ID.
// The server reads it per request and the root layout writes it into the page
// as <meta name="norbix-project"> (app/layout.tsx, app/lib/portalSetup.ts).
// The browser reads that tag. The address the portal is opened at never
// decides the project.

// ProjectId.HostLabel: "pr-" + the Guid as 32 hex digits ("N" format). It is
// the first label of a project's own API host (pr-<hex>.api.<domain>).
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

// ProjectId.ViewId: "pr_" + base62 of a 128-bit number (at most 22 digits).
const VIEW_ID = /^pr_([0-9A-Za-z]{1,22})$/;

/**
 * The reverse of viewIdFromHex: a `pr_{base62}` view id → the gateway's
 * ProjectId.HostLabel, `pr-` + the Guid as 32 lower-case hex digits. Null for
 * anything that is not a view id of a Guid, so a made-up value can never
 * become part of a host name.
 */
export function hostLabelFromViewId(viewId: string): string | null {
  const match = VIEW_ID.exec(viewId.trim());
  if (!match) return null;
  let value = 0n;
  for (const ch of match[1]) {
    value = value * 62n + BigInt(BASE62.indexOf(ch));
  }
  if (value >> 128n !== 0n) return null;
  // Little-endian bytes, in Guid.ToByteArray() order.
  const bytes: string[] = [];
  for (let i = 0; i < 16; i++) {
    bytes.push((value & 0xffn).toString(16).padStart(2, '0'));
    value >>= 8n;
  }
  // ToByteArray order → display order: reverse bytes 0-3, 4-5 and 6-7.
  const order = [3, 2, 1, 0, 5, 4, 7, 6, 8, 9, 10, 11, 12, 13, 14, 15];
  return `pr-${order.map((i) => bytes[i]).join('')}`;
}

/**
 * A host label (`pr-` + 32 hex digits, any case) → the `pr_{base62}` view id.
 * Null for anything else. Used to accept a PROJECT_ID written as a host label.
 */
export function viewIdFromHostLabel(label: string): string | null {
  const match = HOST_LABEL.exec(label.trim());
  return match ? viewIdFromHex(match[1]) : null;
}

/**
 * The configured project, as the server wrote it into the page. Null when the
 * portal is not set up (the server then shows the setup page instead of the
 * app, so the app does not normally see null).
 */
export function resolveProjectId(): string | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="norbix-project"]');
  const content = meta?.getAttribute('content')?.trim();
  return content && content.length > 0 ? content : null;
}
