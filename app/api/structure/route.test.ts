// Structure route, self-hosted path (F40): with API_KEY set, the backend calls
// the gateway's GET /{v}/account/projects/{projectId}/admin-portal/structure
// (GetAdminPortalStructure) as the service user. A real local HTTP server
// stands in for the Hub, so the test sees the exact path and headers.
import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

let hub: Server;
let seen: { url?: string; headers?: IncomingHttpHeaders } = {};
let route: typeof import('./route');

beforeAll(async () => {
  hub = createServer((req, res) => {
    seen = { url: req.url, headers: req.headers };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        projectId: 'pr_1',
        adminPortalEnabled: true,
        displayName: 'Shop',
        modules: [{ key: 'profile', displayName: 'Profile', enabled: true }],
      }),
    );
  });
  await new Promise<void>((resolve) => hub.listen(0, '127.0.0.1', resolve));
  const { port } = hub.address() as AddressInfo;
  vi.stubEnv('HUB_BASE_URL', `http://127.0.0.1:${port}`);
  vi.stubEnv('API_BASE_URL', `http://127.0.0.1:${port}`);
  vi.stubEnv('API_KEY', 'svc-key');
  route = await import('./route');
});

afterAll(() => {
  hub.close();
  vi.unstubAllEnvs();
});

describe('GET /api/structure (self-hosted)', () => {
  it('calls /v3/account/projects/{projectId}/admin-portal/structure with the service key', async () => {
    const res = await route.GET(
      new NextRequest('http://portal.test/api/structure?projectId=pr_1'),
    );

    expect(seen.url).toBe('/v3/account/projects/pr_1/admin-portal/structure');
    expect(seen.headers?.authorization).toBe('Bearer svc-key');
    expect(seen.headers?.['norbix-project-id']).toBe('pr_1');
    expect(await res.json()).toEqual({
      projectId: 'pr_1',
      adminPortalEnabled: true,
      displayName: 'Shop',
      modules: [{ key: 'profile', displayName: 'Profile', enabled: true }],
    });
  });
});
