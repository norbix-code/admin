// BFF bootstrap endpoint — the ONE trusted server-side call the portal makes
// before sign-in.
//
// It returns, in a single response:
//   • brand + auth config       (public, but served here so the portal needs
//                                 only one call)
//   • project roles catalog     (PRIVILEGED — display names/ids only)
//   • marketing-preferences      (PRIVILEGED — the group/channel/tag structure
//     catalog                     a user opts in/out of)
//
// The privileged catalogs are fetched with the SERVICE-USER API KEY held only
// on the server (see app/lib/serverNorbix.ts). The browser never sees the key
// and never calls these privileged Hub endpoints directly. The user's OWN
// preference values stay a direct browser→API call with the user's JWT.
//
// Runtime is Node (not edge) because the SDK + the key live server-side.
import { NextRequest, NextResponse } from 'next/server';
import { serviceClientForProject, hasServiceKey } from '@/app/lib/serverNorbix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BootstrapResponse {
  projectId: string;
  // Brand + auth (mirrors the public /config shape the SPA already consumes).
  branding: unknown | null;
  auth: unknown | null;
  // Privileged catalogs.
  roles: Array<{ id: string; name: string; displayName?: string }>;
  marketingPreferences: unknown | null;
  // Soft flags so the UI can render partial state instead of failing hard.
  warnings: string[];
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const warnings: string[] = [];
  const out: BootstrapResponse = {
    projectId,
    branding: null,
    auth: null,
    roles: [],
    marketingPreferences: null,
    warnings,
  };

  if (!hasServiceKey()) {
    // Without the key the BFF can still serve the public brand/auth (below),
    // but not the privileged catalogs — flag it rather than 500.
    warnings.push('service-key-missing');
  }

  // 1) Brand + auth — public, no key needed. Failure is non-fatal.
  try {
    const client = serviceClientForProject(projectId);
    const config = await client.api.public.config({ projectId });
    out.branding = config.branding ?? null;
    out.auth = config.auth ?? null;
  } catch {
    warnings.push('config-unavailable');
  }

  // 2) Privileged catalogs — only attempt with the service key.
  if (hasServiceKey()) {
    const client = serviceClientForProject(projectId);

    try {
      const rolesResp = await client.hub.membership.getRoles({});
      out.roles = (rolesResp.roles ?? []).map((r) => ({
        id: r.viewId,
        name: r.name,
        displayName: r.displayName ?? undefined,
      }));
    } catch {
      warnings.push('roles-unavailable');
    }

    try {
      // The marketing-preference STRUCTURE rides on the project read model
      // (NotificationSettings). We return only the catalog, never any user's
      // values.
      const projectResp = await client.hub.account.getProject({ projectId });
      out.marketingPreferences =
        projectResp.item?.notificationSettings ?? null;
    } catch {
      warnings.push('preferences-unavailable');
    }
  }

  return NextResponse.json(out, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  });
}
