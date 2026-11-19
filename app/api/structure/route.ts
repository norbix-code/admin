// Structure endpoint — returns the Admin Portal layout the UI renders its nav
// from.
//
// The backend calls the Hub's
//   GET {hub}/{v}/account/projects/{projectId}/admin-portal/structure
// (gateway GetAdminPortalStructure) through the SDK, as the project's Admin
// Portal service user (API_KEY). The project is the configured one
// (PROJECT_ID); nothing the browser sends can change it. The key never reaches
// the browser: this runs only on the server. When the call fails we return a
// minimal default layout so the portal still renders.
import 'server-only';
import { NextResponse } from 'next/server';
import { serviceClient } from '../../lib/serverNorbix';
import { notSetUpResponse, readyPortalSetup } from '../../lib/portalSetup';
// Type-only import (erased at build) — the single admin-repo definition of the
// structure shapes lives in portalApi.
import type {
  AdminPortalModule,
  AdminPortalStructure,
} from '@/services/portalApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The standard end-user modules the portal always knows how to render. Used as
// the fallback layout when the structure call fails.
const DEFAULT_MODULES: AdminPortalModule[] = [
  { key: 'profile', displayName: 'Profile', enabled: true },
  { key: 'security', displayName: 'Security', enabled: true },
  { key: 'preferences', displayName: 'Preferences', enabled: true },
  { key: 'legal', displayName: 'Privacy & data', enabled: true },
];

export async function GET(): Promise<Response> {
  const setup = readyPortalSetup();
  if (!setup) return notSetUpResponse();
  const { projectId } = setup;

  try {
    // The SDK fills {projectId} into
    // /{v}/account/projects/{projectId}/admin-portal/structure and sends the
    // key as the bearer token, plus the project and env headers.
    const structure = await serviceClient(
      setup,
    ).hub.account.getAdminPortalStructure({ projectId });
    // Backfill a usable shape if the gateway returned a sparse/empty body.
    const body: AdminPortalStructure = {
      projectId,
      displayName: structure.displayName ?? '',
      modules:
        structure.modules && structure.modules.length > 0
          ? structure.modules
          : DEFAULT_MODULES,
    };
    return NextResponse.json(body, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        projectId,
        displayName: '',
        modules: DEFAULT_MODULES,
        warnings: ['structure-unreachable'],
      },
      { status: 200 },
    );
  }
}
