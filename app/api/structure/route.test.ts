// Structure route: the backend calls the gateway's
// GET /{v}/account/projects/{projectId}/admin-portal/structure
// (GetAdminPortalStructure) as the service user, for the CONFIGURED project.
// A real local HTTP server stands in for the Hub, so the test sees the exact
// path and headers.
import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { resetSetupLogForTests } from '../../lib/portalSetup';

vi.mock('server-only', () => ({}));

let hub: Server;
let seen: { url?: string; headers?: IncomingHttpHeaders } = {};
let hubCalls = 0;
let route: typeof import('./route');

beforeAll(async () => {
  hub = createServer((req, res) => {
    hubCalls++;
    seen = { url: req.url, headers: req.headers };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        projectId: 'pr_1',
        displayName: 'Shop',
        modules: [{ key: 'profile', displayName: 'Profile', enabled: true }],
      }),
    );
  });
  await new Promise<void>((resolve) => hub.listen(0, '127.0.0.1', resolve));
  const { port } = hub.address() as AddressInfo;
  vi.stubEnv('HUB_BASE_URL', `http://127.0.0.1:${port}`);
  vi.stubEnv('API_BASE_URL', `http://127.0.0.1:${port}`);
  route = await import('./route');
});

beforeEach(() => {
  hubCalls = 0;
  seen = {};
  vi.stubEnv('PROJECT_ID', 'pr_1');
  vi.stubEnv('API_KEY', 'svc-key');
  resetSetupLogForTests();
});

afterAll(() => {
  hub.close();
  vi.unstubAllEnvs();
});

describe('GET /api/structure', () => {
  it('calls /v3/account/projects/{projectId}/admin-portal/structure with the service key', async () => {
    const res = await route.GET();

    expect(seen.url).toBe('/v3/account/projects/pr_1/admin-portal/structure');
    expect(seen.headers?.authorization).toBe('Bearer svc-key');
    expect(seen.headers?.['norbix-project-id']).toBe('pr_1');
    expect(await res.json()).toEqual({
      projectId: 'pr_1',
      displayName: 'Shop',
      modules: [{ key: 'profile', displayName: 'Profile', enabled: true }],
    });
  });

  it.each([
    ['PROJECT_ID', 'API_KEY'],
    ['API_KEY', 'PROJECT_ID'],
  ])(
    'answers 503 naming %s when it is missing, and does not call the Hub',
    async (missing) => {
      vi.stubEnv(missing, '');
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await route.GET();

      expect(res.status).toBe(503);
      const body = (await res.json()) as { missing: string[]; message: string };
      expect(body.missing).toEqual([missing]);
      expect(body.message).toContain(`${missing} is not set`);
      expect(body.message).not.toContain('svc-key');
      expect(hubCalls).toBe(0);
      expect(log).toHaveBeenCalledTimes(1);
      log.mockRestore();
    },
  );
});
