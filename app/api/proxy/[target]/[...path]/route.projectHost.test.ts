// BFF proxy when the Hub's /echo announces `apiUrlTemplate`: an API call goes
// to the CONFIGURED project's own host (pr-<hex>.api.<domain>) and not to the
// shared API_BASE_URL, which refuses a project another region processes
// (CM-ERRORS-PROJECTS-040). The project is PROJECT_ID only: not the address
// the portal was opened at; a header naming another project is refused.
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
// Another project: its id as a header, its label as the portal's host.
const OTHER_PROJECT = 'pr_5R4dlqJeXx943tOzSDEwbS';
const OTHER_LABEL = 'pr-4c0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2';

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
  vi.stubEnv('PROJECT_ID', PROJECT);
  vi.stubEnv('API_KEY', 'svc-key');

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

describe('BFF proxy, Hub with per-project API hosts', () => {
  it("sends a call to the configured project's own API host", async () => {
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

  it('ignores the host label the portal was opened at', async () => {
    await call(`http://portal.test/api/proxy/api/v3/membership/users/me`, {
      host: `${OTHER_LABEL}.admin.norbix.test`,
    });

    expect(asked).toEqual([
      `http://${LABEL}.api.norbix.test/v3/membership/users/me`,
    ]);
  });

  it('refuses a call whose project header names another project, and calls nothing', async () => {
    const res = await call(
      'http://portal.test/api/proxy/api/v3/membership/users/me',
      { 'norbix-project-id': OTHER_PROJECT },
    );

    expect([res.status, await res.json(), asked]).toEqual([
      400,
      {
        error: 'other-project',
        message: 'This portal serves only its own project.',
      },
      [],
    ]);
  });

  it('accepts the configured project written as its host label', async () => {
    const res = await call(
      'http://portal.test/api/proxy/api/v3/membership/users/me',
      { 'nb-project-id': LABEL },
    );

    expect(res.status).toBe(200);
  });

  it('uses the configured project when the call names none', async () => {
    await call('http://portal.test/api/proxy/api/v3/membership/users/me', {});

    expect(asked).toEqual([
      `http://${LABEL}.api.norbix.test/v3/membership/users/me`,
    ]);
  });

  it('asks the Hub for the template once, not on every call', () => {
    expect(echoReads).toBe(1);
  });
});
