// Server-only Norbix client for the portal backend.
//
// This module MUST never be imported by browser code: it authenticates to the
// Hub/API with the service user's API key (API_KEY), which lives only in the
// server environment. The key belongs to the project's Admin Portal service
// user (role AdminPortalManager) — see docs/backend.md.
//
// `import 'server-only'` makes the build fail loudly if a client component ever
// pulls this in, so the key can never leak into the bundle.
import 'server-only';
import { Norbix, NORBIX_HUB_URL, NORBIX_API_URL } from '@norbix.ai/ts';

/** Hub base URL the backend talks to (server-side). Default from the SDK. */
const HUB_BASE_URL = process.env.HUB_BASE_URL ?? NORBIX_HUB_URL;
/** API base URL the backend talks to (server-side). Default from the SDK. */
const API_BASE_URL = process.env.API_BASE_URL ?? NORBIX_API_URL;

const API_VERSION = process.env.API_VERSION ?? 'v3';
const HUB_VERSION = process.env.HUB_VERSION ?? 'v3';

/**
 * Project environment to target (sent as the `norbix-env` header). Optional.
 * If unset, requests target PROD. A staging portal sets ENV=staging (or test).
 */
export const NORBIX_ENV: string | undefined =
  process.env.ENV && process.env.ENV.length > 0 ? process.env.ENV : undefined;

/**
 * A Norbix client that acts as the service user of the configured project.
 * Takes the checked setup (app/lib/portalSetup.ts), so it cannot be built for
 * a project the browser named. The SDK sends the key as a bearer token; it
 * never reaches the browser because this runs only in server route handlers.
 */
export function serviceClient(setup: {
  projectId: string;
  apiKey: string;
}): Norbix {
  return new Norbix({
    projectId: setup.projectId,
    apiKey: setup.apiKey,
    apiVersion: API_VERSION,
    hubVersion: HUB_VERSION,
    env: NORBIX_ENV,
    baseUrl: { api: API_BASE_URL, hub: HUB_BASE_URL },
  });
}
