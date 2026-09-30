import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ChatStream,
  parseServiceStackData,
  SseParser,
  StreamStatus,
} from './realtime';

describe('SseParser', () => {
  it('parses frames split across chunks, with ids, CRLF and comments', () => {
    const p = new SseParser();
    expect(p.push(':heartbeat\r\nid: 1\r\ndata: cmd.onConnect {"a"')).toEqual(
      [],
    );
    expect(p.push(':1}\r\n\r\nid: 2\ndata: line1\ndata: line2\n\n')).toEqual([
      { id: '1', event: 'message', data: 'cmd.onConnect {"a":1}' },
      { id: '2', event: 'message', data: 'line1\nline2' },
    ]);
  });
});

describe('parseServiceStackData', () => {
  it('splits the cmd selector from the JSON envelope', () => {
    expect(
      parseServiceStackData(
        'cmd.ai.chat.turn.token {"eventName":"ai.chat.turn.token","payload":{"text":"Hi"}}',
      ),
    ).toEqual({
      selector: 'ai.chat.turn.token',
      body: { eventName: 'ai.chat.turn.token', payload: { text: 'Hi' } },
    });
  });

  it('accepts a bare JSON envelope and ignores anything else', () => {
    expect(parseServiceStackData('{"eventName":"x","payload":1}')).toEqual({
      selector: 'x',
      body: { eventName: 'x', payload: 1 },
    });
    expect(parseServiceStackData('hello')).toBeUndefined();
  });
});

/** A fetch fake: each call takes the next scripted answer. */
const scripted = (
  answers: Array<Response | Error | ((url: string) => Response)>,
) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const next = answers.shift();
    if (!next) return new Promise<Response>(() => {}); // hang
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next(url) : next;
  });
  return { impl: impl as unknown as typeof fetch, calls };
};

const streamOf = (text: string) =>
  new Response(new Blob([text]).stream(), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

const open = (answers: Parameters<typeof scripted>[0], onEvent = vi.fn()) => {
  const f = scripted(answers);
  const statuses: StreamStatus[] = [];
  const stream = new ChatStream({
    proxyBase: '/api/proxy/api',
    channel: 'ai-chat:pr_1:usr_1',
    headers: () => ({ Authorization: 'Bearer t', 'nb-project-id': 'pr_1' }),
    onEvent,
    onStatus: (s) => statuses.push(s),
    fetchImpl: f.impl,
    backoffMs: () => 5,
  });
  stream.start();
  return { stream, statuses, calls: f.calls, onEvent };
};

const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
};

let current: ChatStream | undefined;
afterEach(() => current?.close());

describe('ChatStream', () => {
  it('stops on 403 (AiChatChannelRefused) — no reconnect, status refused', async () => {
    const s = open([
      new Response('{"responseStatus":{"errorCode":"AiChatChannelRefused"}}', {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    ]);
    current = s.stream;
    await until(() => s.statuses.includes('refused'));
    await new Promise((r) => setTimeout(r, 40));

    expect(s.statuses).toEqual(['connecting', 'refused']);
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0].url).toBe(
      '/api/proxy/api/event-stream?channels=ai-chat%3Apr_1%3Ausr_1',
    );
    expect(s.calls[0].init?.headers).toMatchObject({
      Authorization: 'Bearer t',
      'nb-project-id': 'pr_1',
      Accept: 'text/event-stream',
    });
  });

  it('reconnects after a 5xx and after a network error, then delivers events', async () => {
    const s = open([
      new Response('down', { status: 502 }),
      new TypeError('Failed to fetch'),
      streamOf(
        'id: 7\ndata: cmd.ai.chat.turn.token {"eventName":"ai.chat.turn.token","payload":{"turnId":"trn_1","sessionId":"aics_1","entryId":"ent_2","text":"Hel"}}\n\n',
      ),
    ]);
    current = s.stream;
    await until(() => s.onEvent.mock.calls.length > 0);

    expect(s.statuses.slice(0, 5)).toEqual([
      'connecting',
      'reconnecting', // after 502
      'reconnecting', // attempt 2
      'reconnecting', // after the network error
      'reconnecting', // attempt 3
    ]);
    expect(s.statuses).toContain('open');
    expect(s.onEvent).toHaveBeenCalledWith('ai.chat.turn.token', {
      eventName: 'ai.chat.turn.token',
      payload: {
        turnId: 'trn_1',
        sessionId: 'aics_1',
        entryId: 'ent_2',
        text: 'Hel',
      },
    });
  });

  it('reconnects when the stream ends, sending Last-Event-ID', async () => {
    const s = open([streamOf('id: 41\ndata: cmd.onJoin {}\n\n'), streamOf('')]);
    current = s.stream;
    await until(() => s.calls.length >= 2);

    expect(s.calls[1].init?.headers).toMatchObject({ 'Last-Event-ID': '41' });
  });

  it('posts the ServiceStack heartbeat through the proxy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(
            new TextEncoder().encode(
              'data: cmd.onConnect {"heartbeatUrl":"http://10.0.0.5:5002/event-heartbeat?id=sub9","heartbeatIntervalMs":"1000"}\n\n',
            ),
          );
          // stays open
        },
      });
      const s = open([
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
        new Response('', { status: 200 }),
      ]);
      current = s.stream;
      await until(() => s.statuses.includes('open'));
      await vi.advanceTimersByTimeAsync(1100);

      expect(s.calls[1].url).toBe('/api/proxy/api/event-heartbeat?id=sub9');
      expect(s.calls[1].init).toMatchObject({
        method: 'POST',
        headers: { Authorization: 'Bearer t', 'nb-project-id': 'pr_1' },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
