// Server-only Norbix client for the BFF.
//
// This module MUST never be imported by browser code: it reads the service-user
// API key from the server environment and authenticates to the Hub/API with it.
// The key grants a narrow, read-only catalog scope (project roles + marketing-
// preference structure + brand/auth config) — see docs/bff-architecture.md.
//
// `import 'server-only'` makes the build fail loudly if a client component ever
// pulls this in, so the key can never leak into the bundle.
import 'server-only';
import { Norbix } from '@norbix.ai/ts';

/** Hub base URL the BFF talks to (server-side). e.g. https://hub.norbix.ai */
const HUB_BASE_URL = process.env.ADMIN_BFF_HUB_BASE_URL ?? 'https://hub.norbix.ai';
/** API base URL (echo-discovered in the browser; the BFF pins it from env). */
const API_BASE_URL = process.env.ADMIN_BFF_API_BASE_URL ?? 'https://api.norbix.ai';
/** Service-user API key with the read-only catalog scope. Server env only. */
const SERVICE_API_KEY = process.env.ADMIN_BFF_API_KEY;

const API_VERSION = process.env.ADMIN_BFF_API_VERSION ?? 'v3';
const HUB_VERSION = process.env.ADMIN_BFF_HUB_VERSION ?? 'v3';

/**
 * Build a Norbix client authenticated as the service user for one project.
 * The API key is sent as a bearer token by the SDK transport; it never reaches
 * the browser because this runs only in BFF route handlers.
 *
 * Throws when the key is not configured, so a misconfigured deployment fails
 * fast instead of silently calling the Hub unauthenticated.
 */
export function serviceClientForProject(projectId: string): Norbix {
  if (!SERVICE_API_KEY) {
    throw new Error(
      'ADMIN_BFF_API_KEY is not set. The BFF needs a service-user API key with ' +
        'the read-only catalog scope to fetch project roles + preferences.',
    );
  }
  return new Norbix({
    projectId,
    apiKey: SERVICE_API_KEY,
    apiVersion: API_VERSION,
    hubVersion: HUB_VERSION,
    baseUrl: { api: API_BASE_URL, hub: HUB_BASE_URL },
  });
}

/** True when the service key is configured (used to degrade gracefully). */
export const hasServiceKey = (): boolean => Boolean(SERVICE_API_KEY);
