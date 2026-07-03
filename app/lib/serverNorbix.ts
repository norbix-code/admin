// Server-only Norbix client for the portal backend.
//
// This module MUST never be imported by browser code: it reads the service-user
// API key from the server environment and authenticates to the Hub/API with it.
// The key grants a narrow, read-only catalog scope (project roles + marketing-
// preference structure + brand/auth config) — see docs/backend.md.
//
// `import 'server-only'` makes the build fail loudly if a client component ever
// pulls this in, so the key can never leak into the bundle.
import 'server-only';
import { Norbix, NORBIX_HUB_URL, NORBIX_API_URL } from '@norbix.ai/ts';

/** Hub base URL the backend talks to (server-side). Default from the SDK. */
const HUB_BASE_URL = process.env.HUB_BASE_URL ?? NORBIX_HUB_URL;
/** API base URL the backend talks to (server-side). Default from the SDK. */
const API_BASE_URL = process.env.API_BASE_URL ?? NORBIX_API_URL;
/** Service-user API key with the read-only catalog scope. Server env only. */
const SERVICE_API_KEY = process.env.API_KEY;

const API_VERSION = process.env.API_VERSION ?? 'v3';
const HUB_VERSION = process.env.HUB_VERSION ?? 'v3';

/**
 * Project environment to target (sent as the `norbix-env` header). Optional.
 * If unset, requests target PROD. A self-hosted staging portal sets ENV=staging
 * (or test); managed deployments derive the environment from the host instead.
 */
export const NORBIX_ENV: string | undefined =
  process.env.ENV && process.env.ENV.length > 0 ? process.env.ENV : undefined;

/**
 * Build a Norbix client authenticated as the service user for one project.
 * The API key is sent as a bearer token by the SDK transport; it never reaches
 * the browser because this runs only in server route handlers.
 *
 * Throws when the key is not configured, so a misconfigured deployment fails
 * fast instead of silently calling the Hub unauthenticated.
 */
export function serviceClientForProject(projectId: string): Norbix {
  if (!SERVICE_API_KEY) {
    throw new Error(
      'API_KEY is not set. The portal backend needs a service-user API key ' +
        'with the read-only catalog scope to fetch project roles + preferences.',
    );
  }
  return new Norbix({
    projectId,
    apiKey: SERVICE_API_KEY,
    apiVersion: API_VERSION,
    hubVersion: HUB_VERSION,
    env: NORBIX_ENV,
    baseUrl: { api: API_BASE_URL, hub: HUB_BASE_URL },
  });
}

/** True when the service key is configured (used to degrade gracefully). */
export const hasServiceKey = (): boolean => Boolean(SERVICE_API_KEY);
