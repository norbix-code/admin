// BFF proxy pointed at the API by an in-network address (a Docker stack, a
// private service name) while the Hub announces per-project hosts: the proxy
// keeps API_BASE_URL. The public project host may not be reachable from where
// the portal runs, and the address was chosen by whoever deployed it.
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

let server: Server;
let apiCalls: string[] = [];
let route: typeof import('./route');

beforeAll(async () => {
  server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    if (req.url === '/v3/echo') {
      res.end(
        JSON.stringify({
          apiUrlTemplate: 'https://{projectHostLabel}.api.norbix.test/v3',
        }),
      );
      return;
    }
    apiCalls.push(req.url ?? '');
    res.end('{"ok":true}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  vi.stubEnv('HUB_BASE_URL', `http://127.0.0.1:${port}`);
  vi.stubEnv('API_BASE_URL', `http://127.0.0.1:${port}`);
  route = await import('./route');
});

afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
});

describe('BFF proxy, API_BASE_URL is not the shared host of the template', () => {
  it('keeps API_BASE_URL for a project call', async () => {
    apiCalls = [];
    const res = await route.GET(
      new NextRequest('http://portal.test/api/proxy/api/v3/auth', {
        headers: { 'norbix-project-id': 'pr_Igqs1AfB4AZIwIJ7K9xgs' },
      }),
      { params: Promise.resolve({ target: 'api', path: ['v3', 'auth'] }) },
    );

    expect(res.status).toBe(200);
    expect(apiCalls).toEqual(['/v3/auth']);
  });
});
