// Bootstrap route: the privileged catalogs are read as the service user for
// the CONFIGURED project. A project named in the query is ignored, and with a
// missing setting the route answers 503 without calling the Hub.
import { createServer, Server } from 'node:http';
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

let gateway: Server;
let asked: { url: string; project?: string; authorization?: string }[] = [];
let route: typeof import('./route');

beforeAll(async () => {
  gateway = createServer((req, res) => {
    asked.push({
      url: req.url ?? '',
      project: req.headers['norbix-project-id'] as string | undefined,
      authorization: req.headers.authorization,
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
  });
  await new Promise<void>((resolve) => gateway.listen(0, '127.0.0.1', resolve));
  const { port } = gateway.address() as AddressInfo;
  vi.stubEnv('HUB_BASE_URL', `http://127.0.0.1:${port}`);
  vi.stubEnv('API_BASE_URL', `http://127.0.0.1:${port}`);
  route = await import('./route');
});

beforeEach(() => {
  asked = [];
  vi.stubEnv('PROJECT_ID', 'pr_1');
  vi.stubEnv('API_KEY', 'svc-key');
  resetSetupLogForTests();
});

afterAll(() => {
  gateway.close();
  vi.unstubAllEnvs();
});

describe('GET /api/bootstrap', () => {
  it('reads every catalog for the configured project, with the service key', async () => {
    const res = await route.GET();

    expect(res.status).toBe(200);
    expect(((await res.json()) as { projectId: string }).projectId).toBe(
      'pr_1',
    );
    expect(asked.length).toBeGreaterThan(0);
    for (const call of asked) {
      expect(call.project).toBe('pr_1');
      expect(call.authorization).toBe('Bearer svc-key');
      expect(call.url).not.toContain('pr_other');
    }
    expect(asked.map((c) => c.url)).toContain('/v3/account/projects/pr_1');
  });

  it('answers 503 naming API_KEY when it is missing, and does not call the gateway', async () => {
    vi.stubEnv('API_KEY', '');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await route.GET();

    expect(res.status).toBe(503);
    expect(((await res.json()) as { missing: string[] }).missing).toEqual([
      'API_KEY',
    ]);
    expect(asked).toEqual([]);
    log.mockRestore();
  });
});
