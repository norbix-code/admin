// Structure endpoint — returns the Admin Portal layout the UI renders its nav
// from. TWO access paths (gateway handoff Decision 5), chosen by the SERVER's
// own config — the presence of API_KEY — NOT a client hint and NOT a mode flag:
//
//   API_KEY set   → self-hosted → call the PUBLIC Hub endpoint
//       GET {hub}/{v}/admin-portal/structure
//     authenticated as the project's AdminPortalManager service user.
//
//   API_KEY unset → managed     → call the PRIVATE internal endpoint
//       GET {hub}/internal/admin-portal/structure?projectId=…
//     over Norbix's internal network — NO key (the network is the gate).
//
// (A managed deployment never holds a per-project key, so key-presence IS the
// flavour.) The service key NEVER reaches the browser: this runs only on the
// server. On any failure we return a minimal default layout so the portal still
// renders.
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { NORBIX_HUB_URL } from '@norbix.ai/ts';
// Type-only import (erased at build) — the single admin-repo definition of the
// structure shapes lives in portalApi. Both will be replaced by the generated
// @norbix.ai/ts DTOs after the gateway SDK regen (G7).
import type {
  AdminPortalModule,
  AdminPortalStructure,
} from '@/services/portalApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HUB_BASE = (process.env.HUB_BASE_URL ?? NORBIX_HUB_URL).replace(/\/$/, '');
const HUB_VERSION = process.env.HUB_VERSION ?? 'v3';
const API_KEY = process.env.API_KEY;
const NORBIX_ENV =
  process.env.ENV && process.env.ENV.length > 0 ? process.env.ENV : undefined;

// The standard end-user modules the portal always knows how to render. Used as
// the fallback layout when the structure call fails or is skipped.
const DEFAULT_MODULES: AdminPortalModule[] = [
  { key: 'profile', displayName: 'Profile', enabled: true },
  { key: 'security', displayName: 'Security', enabled: true },
  { key: 'preferences', displayName: 'Preferences', enabled: true },
  { key: 'legal', displayName: 'Privacy & data', enabled: true },
];

function defaultStructure(projectId: string): AdminPortalStructure {
  return {
    projectId,
    adminPortalEnabled: true,
    displayName: '',
    modules: DEFAULT_MODULES,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400 },
    );
  }

  // Managed vs self-hosted is derived from the SERVER's own config — the
  // presence of API_KEY — NOT a client-supplied hint and NOT a mode flag.
  //   API_KEY set   → self-hosted: call the PUBLIC endpoint with the key.
  //   API_KEY unset → managed: call the PRIVATE internal endpoint (no key;
  //                   the cluster network is the gate).
  // This is the real distinguishing fact: a managed deployment never holds a
  // per-project key.
  const isSelfHosted = Boolean(API_KEY);

  const headers: Record<string, string> = { accept: 'application/json' };
  if (NORBIX_ENV) headers['norbix-env'] = NORBIX_ENV;

  let url: string;
  if (isSelfHosted) {
    // Public endpoint — authenticate as the service user.
    headers.authorization = `Bearer ${API_KEY}`;
    headers['x-cm-projectid'] = projectId;
    url = `${HUB_BASE}/${HUB_VERSION}/admin-portal/structure`;
  } else {
    // Managed: private internal endpoint — network-trusted, no key.
    url = `${HUB_BASE}/internal/admin-portal/structure?projectId=${encodeURIComponent(projectId)}`;
  }

  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { ...defaultStructure(projectId), warnings: ['structure-unavailable'] },
        { status: 200 },
      );
    }
    const structure = (await res.json()) as Partial<AdminPortalStructure>;
    // Backfill a usable shape if the gateway returned a sparse/empty body.
    return NextResponse.json(
      {
        projectId,
        adminPortalEnabled: structure.adminPortalEnabled ?? true,
        displayName: structure.displayName ?? '',
        modules:
          structure.modules && structure.modules.length > 0
            ? structure.modules
            : DEFAULT_MODULES,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { ...defaultStructure(projectId), warnings: ['structure-unreachable'] },
      { status: 200 },
    );
  }
}
