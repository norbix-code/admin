// Which API host the portal backend calls for a project.
//
// Norbix processes a project in one region, and the shared API host refuses a
// project that another region processes (CM-ERRORS-PROJECTS-040). The Hub's
// /echo announces the per-project host as `apiUrlTemplate`; this module reads
// it once (cached) and builds the configured project's own host from it. An
// install that announces no template has one API host: API_BASE_URL is used.
//
// No setting switches this on: it follows what the Hub says.
import { NORBIX_HUB_URL, NORBIX_API_URL } from '@norbix.ai/ts';
import { projectApiBase, sharedApiHostOf } from '@/config/projectApiHost';

const HUB_BASE = (process.env.HUB_BASE_URL ?? NORBIX_HUB_URL).replace(
  /\/$/,
  '',
);
const API_BASE = (process.env.API_BASE_URL ?? NORBIX_API_URL).replace(
  /\/$/,
  '',
);
const HUB_VERSION = process.env.HUB_VERSION ?? 'v3';

/** How long an answer of /echo is kept. The template changes only with a deploy. */
const KEEP_MS = 5 * 60_000;
/** How soon a failed read is tried again. The last good answer is used meanwhile. */
const RETRY_MS = 30_000;
const ECHO_TIMEOUT_MS = 5_000;

let template: string | null = null;
let readAgainAt = 0;
let reading: Promise<void> | null = null;

async function readTemplate(): Promise<void> {
  try {
    const res = await fetch(`${HUB_BASE}/${HUB_VERSION}/echo`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(ECHO_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`echo answered ${res.status}`);
    const echo = (await res.json()) as { apiUrlTemplate?: string | null };
    template =
      typeof echo.apiUrlTemplate === 'string' && echo.apiUrlTemplate.length > 0
        ? echo.apiUrlTemplate
        : null;
    readAgainAt = Date.now() + KEEP_MS;
  } catch {
    // Keep the last good template: a Hub restart must not send a region's
    // project back to the shared host.
    readAgainAt = Date.now() + RETRY_MS;
  }
}

/** The install's `apiUrlTemplate` from the Hub's /echo; null when it has none. */
export async function apiUrlTemplate(): Promise<string | null> {
  if (Date.now() >= readAgainAt) {
    reading ??= readTemplate().finally(() => {
      reading = null;
    });
    await reading;
  }
  return template;
}

/** The host (with port) of API_BASE_URL; null when it is not an address. */
function ownApiHost(): string | null {
  try {
    return new URL(API_BASE).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The API base (no version) for a project: its own host when the install has
 * per-project hosts and the id is a real project id, else the shared
 * API_BASE_URL.
 *
 * Only when API_BASE_URL is the same shared host the template stands on
 * (api.<domain> and {label}.api.<domain>). A portal pointed at the API by
 * another address — an in-network name in a Docker stack, a private service
 * name — keeps that address: the public project host may not be reachable
 * from where it runs.
 */
export async function apiBaseForProject(
  projectId: string | null | undefined,
): Promise<string> {
  if (!projectId) return API_BASE;
  const template = await apiUrlTemplate();
  if (!template || sharedApiHostOf(template) !== ownApiHost()) return API_BASE;
  return projectApiBase(template, projectId) ?? API_BASE;
}
