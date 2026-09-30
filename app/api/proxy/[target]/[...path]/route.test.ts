// BFF proxy route: forwards the project header the API host reads and passes
// server-sent events through as a live stream (tracker step 28). A real local
// HTTP server stands in for the gateway.
import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

let upstream: Server;
let seen: { url?: string; headers?: IncomingHttpHeaders } = {};
let releaseSecondEvent: () => void = () => {};

type RouteModule = typeof import('./route');
let route: RouteModule;

beforeAll(async () => {
  upstream = createServer((req, res) => {
    seen = { url: req.url, headers: req.headers };
    if (req.url?.startsWith('/event-stream')) {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'private',
      });
      res.write('data: cmd.onConnect {"id":"sub1"}\n\n');
      // The second event is written only when the test asks for it — so the
      // test proves the first one arrived before the upstream finished.
      releaseSecondEvent = () => {
        res.write('data: cmd.ai.chat.turn.token {"text":"Hi"}\n\n');
        res.end();
      };
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  });
  await new Promise<void>((resolve) =>
    upstream.listen(0, '127.0.0.1', resolve),
  );
  const { port } = upstream.address() as AddressInfo;
  vi.stubEnv('API_BASE_URL', `http://127.0.0.1:${port}`);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  route = await import('./route');
});

afterAll(() => {
  upstream.close();
  vi.unstubAllEnvs();
});

const call = (path: string[], headers: Record<string, string>) =>
  route.GET(
    new NextRequest(`http://portal.test/api/proxy/api/${path.join('/')}`, {
      headers,
    }),
    { params: Promise.resolve({ target: 'api', path }) },
  );

describe('BFF proxy', () => {
  it('forwards nb-project-id, the bearer token and the SSE reconnect id; drops cookies', async () => {
    const res = await call(['v3', 'ai', 'chat', 'availability'], {
      'nb-project-id': 'pr_abc',
      'norbix-project-id': 'pr_abc',
      authorization: 'Bearer t1',
      'last-event-id': '42',
      cookie: 'portal=secret',
      'x-norbix-project': 'pr_abc',
    });

    expect(res.status).toBe(200);
    expect(seen.url).toBe('/v3/ai/chat/availability');
    expect({
      nbProjectId: seen.headers?.['nb-project-id'],
      norbixProjectId: seen.headers?.['norbix-project-id'],
      authorization: seen.headers?.authorization,
      lastEventId: seen.headers?.['last-event-id'],
      cookie: seen.headers?.cookie,
      xNorbixProject: seen.headers?.['x-norbix-project'],
    }).toEqual({
      nbProjectId: 'pr_abc',
      norbixProjectId: 'pr_abc',
      authorization: 'Bearer t1',
      lastEventId: '42',
      cookie: undefined,
      xNorbixProject: undefined,
    });
  });

  it('streams an event stream as it is written, uncached and unbuffered', async () => {
    const res = await call(['event-stream'], { authorization: 'Bearer t1' });

    expect(res.headers.get('content-type')).toBe(
      'text/event-stream; charset=utf-8',
    );
    expect(res.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(res.headers.get('x-accel-buffering')).toBe('no');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const first = decoder.decode((await reader.read()).value);
    expect(first).toBe('data: cmd.onConnect {"id":"sub1"}\n\n');

    releaseSecondEvent();
    let rest = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      rest += decoder.decode(value);
    }
    expect(rest).toBe('data: cmd.ai.chat.turn.token {"text":"Hi"}\n\n');
  });

  it('leaves the cache header of a normal JSON answer alone', async () => {
    const res = await call(['v3', 'ai', 'chat', 'sessions'], {});
    expect(res.headers.get('cache-control')).toBeNull();
    expect(res.headers.get('x-accel-buffering')).toBeNull();
  });
});
