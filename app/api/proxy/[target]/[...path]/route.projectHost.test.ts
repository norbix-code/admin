// BFF proxy on an install with regions: the Hub's /echo announces
// `apiUrlTemplate`, so an API call goes to the project's own host
// (pr-<hex>.api.<domain>) and not to the shared API_BASE_URL, which refuses a
// project another region processes (CM-ERRORS-PROJECTS-040).
//
// A local HTTP server stands in for the Hub and for both API hosts. `fetch` is
// wrapped only to send the made-up host names to that server; the test reads
// the address the proxy asked for.
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
import { NextRequest } from 'next/server';

const PROJECT = 'pr_Igqs1AfB4AZIwIJ7K9xgs';
const LABEL = 'pr-75af6526cea04a7486d4be6198c6e709';

let server: Server;
let asked: string[] = [];
let echoReads = 0;
let seenHeaders: IncomingHttpHeaders = {};
let route: typeof import('./route');

beforeAll(async () => {
  server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    if (req.url === '/v3/echo') {
      echoReads++;
      res.end(
        JSON.stringify({
          apiUrl: 'http://api.norbix.test/v3',
          apiUrlTemplate: 'http://{projectHostLabel}.api.norbix.test/v3',
        }),
      );
      return;
    }
    seenHeaders = req.headers;
    res.end('{"ok":true}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  vi.stubEnv('HUB_BASE_URL', `http://127.0.0.1:${port}`);
  vi.stubEnv('API_BASE_URL', 'http://api.norbix.test');

  const realFetch = globalThis.fetch;
  vi.stubGlobal('fetch', (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname.endsWith('norbix.test')) {
      asked.push(url.href);
      url.hostname = '127.0.0.1';
      url.port = String(port);
    }
    return realFetch(url, init);
  });
  route = await import('./route');
});

beforeEach(() => {
  asked = [];
});

afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const call = (url: string, headers: Record<string, string>) =>
  route.GET(new NextRequest(url, { headers }), {
    params: Promise.resolve({
      target: 'api',
      path: ['v3', 'membership', 'users', 'me'],
    }),
  });

describe('BFF proxy, install with per-project API hosts', () => {
  it("sends a project's call to the project's own API host", async () => {
    const res = await call(
      'http://portal.test/api/proxy/api/v3/membership/users/me?x=1',
      { 'norbix-project-id': PROJECT, authorization: 'Bearer t1' },
    );

    expect(res.status).toBe(200);
    expect(asked).toEqual([
      `http://${LABEL}.api.norbix.test/v3/membership/users/me?x=1`,
    ]);
    expect(seenHeaders.authorization).toBe('Bearer t1');
    expect(seenHeaders['norbix-project-id']).toBe(PROJECT);
  });

  it("reads the project from the portal's own pr-<hex> host when no header names it", async () => {
    await call(`http://portal.test/api/proxy/api/v3/membership/users/me`, {
      host: `${LABEL}.admin.norbix.test`,
    });

    expect(asked).toEqual([
      `http://${LABEL}.api.norbix.test/v3/membership/users/me`,
    ]);
  });

  it('keeps the shared API host when the call names no project', async () => {
    await call('http://portal.test/api/proxy/api/v3/membership/users/me', {});

    expect(asked).toEqual(['http://api.norbix.test/v3/membership/users/me']);
  });

  it('keeps the shared API host for a project header that is not a project id', async () => {
    await call('http://portal.test/api/proxy/api/v3/membership/users/me', {
      'norbix-project-id': 'evil.example/x',
    });

    expect(asked).toEqual(['http://api.norbix.test/v3/membership/users/me']);
  });

  it('asks the Hub for the template once, not on every call', () => {
    expect(echoReads).toBe(1);
  });
});
