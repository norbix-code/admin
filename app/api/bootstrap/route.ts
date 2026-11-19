// Bootstrap endpoint — the ONE trusted server-side call the portal makes
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
// on the server (API_KEY, see app/lib/serverNorbix.ts), for the configured
// project (PROJECT_ID) — nothing the browser sends can change the project.
// The browser never sees the key and never calls these privileged Hub
// endpoints directly. The user's OWN preference values stay a call with the
// user's JWT through the proxy.
//
// Runtime is Node (not edge) because the SDK + the key live server-side.
import { NextResponse } from 'next/server';
import { serviceClient } from '../../lib/serverNorbix';
import { notSetUpResponse, readyPortalSetup } from '../../lib/portalSetup';

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

export async function GET(): Promise<Response> {
  const setup = readyPortalSetup();
  if (!setup) return notSetUpResponse();
  const { projectId } = setup;
  const client = serviceClient(setup);

  const warnings: string[] = [];
  const out: BootstrapResponse = {
    projectId,
    branding: null,
    auth: null,
    roles: [],
    marketingPreferences: null,
    warnings,
  };

  // 1) Brand + auth — the public config. Failure is non-fatal.
  try {
    const config = await client.api.public.getPublicProjectConfig({
      projectId,
    });
    out.branding = config.branding ?? null;
    out.auth = config.auth ?? null;
  } catch {
    warnings.push('config-unavailable');
  }

  // 2) Privileged catalogs, as the service user.
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
    out.marketingPreferences = projectResp.item?.notificationSettings ?? null;
  } catch {
    warnings.push('preferences-unavailable');
  }

  return NextResponse.json(out, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  });
}
