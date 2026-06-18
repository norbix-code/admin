// Resolve which project this portal instance is showing.
//
// Resolution order:
//   1. Build-time pin (VITE_ADMIN_PROJECT_ID) — self-hosted custom-domain builds.
//   2. The pr_{base62} subdomain prefix — managed service.
//   3. An X-Norbix-Project value injected by the edge for CNAME custom domains,
//      surfaced to the SPA via a <meta name="norbix-project"> tag.
//   4. null → render the blank placeholder.

import { PINNED_PROJECT_ID } from './env';

const PR_PREFIX = /^pr_([0-9A-Za-z]+)$/;

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

export function resolveProjectId(host?: string): string | null {
  if (PINNED_PROJECT_ID) return PINNED_PROJECT_ID;

  const h =
    host ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  const fromHost = parseProjectIdFromHost(h);
  if (fromHost) return fromHost;

  return projectFromMetaTag();
}
