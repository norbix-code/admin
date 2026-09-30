/**
 * The chat's realtime stream: the caller's own SSE channel on the API host
 * (`ai-chat:{projectId}:{authId}`), read through the same-origin BFF proxy
 * (`/api/proxy/api/event-stream`).
 *
 * Why `fetch` and not the browser `EventSource` (item file, Findings):
 *  - `EventSource` cannot send headers; the API host authenticates the stream
 *    with the bearer token only (no token cookie, no token in the URL).
 *  - `EventSource` cannot see the HTTP status. The gateway answers a channel
 *    that is not the caller's with 403 before the stream starts, and the
 *    client must STOP then — not reconnect forever.
 *
 * Rules:
 *  - 401 / 403 / 404 on connect → status `refused`, no retry ("chat unavailable").
 *  - network error, 5xx, or the stream ending → back off (1 s … 30 s, jitter)
 *    and reconnect, sending `Last-Event-ID`.
 *  - ServiceStack drops a subscriber that sends no heartbeat for 30 s: after
 *    `cmd.onConnect` we POST its `heartbeatUrl` (re-targeted to the proxy)
 *    every `heartbeatIntervalMs`. A heartbeat that fails with 404 means the
 *    subscription is gone → reconnect.
 */

import type { RealtimeEnvelope } from './types';

/** One parsed SSE frame. */
export interface SseFrame {
  id?: string;
  event: string;
  data: string;
}

/**
 * Incremental SSE parser (WHATWG event-stream format). Feed it decoded text
 * chunks; it returns the frames completed by that chunk. Handles CRLF, split
 * lines, multi-line data and comment lines.
 */
export class SseParser {
  private buffer = '';
  private data: string[] = [];
  private event = '';
  private id: string | undefined;

  push(chunk: string): SseFrame[] {
    this.buffer += chunk;
    const frames: SseFrame[] = [];
    for (;;) {
      const nl = this.buffer.search(/\r\n|\r|\n/);
      if (nl < 0) break;
      const line = this.buffer.slice(0, nl);
      const sepLength = this.buffer.startsWith('\r\n', nl) ? 2 : 1;
      this.buffer = this.buffer.slice(nl + sepLength);
      const frame = this.line(line);
      if (frame) frames.push(frame);
    }
    return frames;
  }

  private line(line: string): SseFrame | undefined {
    if (line === '') {
      if (this.data.length === 0) {
        this.event = '';
        return undefined;
      }
      const frame: SseFrame = {
        id: this.id,
        event: this.event || 'message',
        data: this.data.join('\n'),
      };
      this.data = [];
      this.event = '';
      return frame;
    }
    if (line.startsWith(':')) return undefined; // comment
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') this.data.push(value);
    else if (field === 'event') this.event = value;
    else if (field === 'id') this.id = value;
    return undefined;
  }
}

/** A ServiceStack message: `cmd.{selector} {json}` in the data field. */
export interface ServiceStackMessage {
  /** Without the `cmd.` prefix, e.g. `ai.chat.turn.token`, `onConnect`. */
  selector: string;
  body: unknown;
}

export const parseServiceStackData = (
  data: string,
): ServiceStackMessage | undefined => {
  const space = data.indexOf(' ');
  const head = space < 0 ? data : data.slice(0, space);
  const json = space < 0 ? '' : data.slice(space + 1);
  if (!head.startsWith('cmd.')) {
    // Plain JSON envelope (no selector) — accept it too.
    try {
      const body = JSON.parse(data) as RealtimeEnvelope;
      return typeof body?.eventName === 'string'
        ? { selector: body.eventName, body }
        : undefined;
    } catch {
      return undefined;
    }
  }
  let body: unknown;
  try {
    body = json ? JSON.parse(json) : undefined;
  } catch {
    body = json;
  }
  return { selector: head.slice('cmd.'.length), body };
};

export type StreamStatus = 'connecting' | 'open' | 'reconnecting' | 'refused';

export interface ChatStreamOptions {
  /** Same-origin proxy base, e.g. `/api/proxy/api`. */
  proxyBase: string;
  channel: string;
  /** Headers for every request (Authorization, nb-project-id …). */
  headers: () => Record<string, string>;
  onEvent: (eventName: string, envelope: RealtimeEnvelope) => void;
  onStatus: (status: StreamStatus) => void;
  fetchImpl?: typeof fetch;
  /** Reconnect delay (ms) for the n-th failure in a row; jittered by default. */
  backoffMs?: (attempt: number) => number;
}

/** Statuses that mean "you may not listen here" — never retried. */
const REFUSED = new Set([401, 403, 404]);

const defaultBackoff = (attempt: number) =>
  Math.round(Math.min(30_000, 1000 * 2 ** attempt) * (0.5 + Math.random() / 2));

export class ChatStream {
  private closed = false;
  private abort?: AbortController;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private lastEventId?: string;
  private attempt = 0;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: ChatStreamOptions) {
    this.fetchImpl = opts.fetchImpl ?? ((...a) => fetch(...a));
  }

  start(): void {
    void this.connect();
  }

  close(): void {
    this.closed = true;
    this.stopHeartbeat();
    clearTimeout(this.retryTimer);
    this.abort?.abort();
  }

  private url(): string {
    const q = new URLSearchParams({ channels: this.opts.channel });
    return `${this.opts.proxyBase}/event-stream?${q.toString()}`;
  }

  private async connect(): Promise<void> {
    if (this.closed) return;
    this.opts.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');
    this.abort = new AbortController();
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(), {
        method: 'GET',
        headers: {
          ...this.opts.headers(),
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...(this.lastEventId ? { 'Last-Event-ID': this.lastEventId } : {}),
        },
        signal: this.abort.signal,
      });
    } catch {
      this.retry();
      return;
    }

    if (REFUSED.has(res.status)) {
      // Pre-stream refusal (AiChatChannelRefused, expired login): stop.
      this.closed = true;
      this.opts.onStatus('refused');
      return;
    }
    if (!res.ok || !res.body) {
      this.retry();
      return;
    }

    this.attempt = 0;
    this.opts.onStatus('open');
    await this.pump(res.body);
    this.stopHeartbeat();
    this.retry();
  }

  private async pump(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done || this.closed) break;
        for (const frame of parser.push(
          decoder.decode(value, { stream: true }),
        ))
          this.frame(frame);
      }
    } catch {
      /* dropped / aborted — the caller reconnects unless closed */
    }
  }

  private frame(frame: SseFrame): void {
    if (frame.id) this.lastEventId = frame.id;
    const msg = parseServiceStackData(frame.data);
    if (!msg) return;
    if (msg.selector === 'onConnect') {
      this.startHeartbeat(msg.body as ConnectBody);
      return;
    }
    if (msg.selector.startsWith('on')) return; // onJoin / onLeave / onHeartbeat …
    const envelope = msg.body as RealtimeEnvelope;
    if (!envelope || typeof envelope !== 'object') return;
    this.opts.onEvent(envelope.eventName ?? msg.selector, envelope);
  }

  private startHeartbeat(body: ConnectBody | undefined): void {
    this.stopHeartbeat();
    const url = body?.heartbeatUrl ? this.viaProxy(body.heartbeatUrl) : null;
    if (!url) return;
    const every = Math.max(1000, Number(body?.heartbeatIntervalMs) || 10_000);
    this.heartbeatTimer = setInterval(() => {
      void this.fetchImpl(url, {
        method: 'POST',
        headers: this.opts.headers(),
      })
        .then((r) => {
          // The server forgot this subscription: open a new stream.
          if (r.status === 404 && !this.closed) this.abort?.abort();
        })
        .catch(() => {
          /* the stream itself notices a real outage */
        });
    }, every);
  }

  private stopHeartbeat(): void {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  /** `http://gateway/event-heartbeat?id=x` → `/api/proxy/api/event-heartbeat?id=x`. */
  private viaProxy(absolute: string): string | null {
    try {
      const u = new URL(absolute, 'http://placeholder');
      return `${this.opts.proxyBase}${u.pathname}${u.search}`;
    } catch {
      return null;
    }
  }

  private retry(): void {
    if (this.closed) return;
    const wait = (this.opts.backoffMs ?? defaultBackoff)(this.attempt);
    this.attempt += 1;
    this.opts.onStatus('reconnecting');
    this.retryTimer = setTimeout(() => void this.connect(), wait);
  }
}

interface ConnectBody {
  heartbeatUrl?: string;
  heartbeatIntervalMs?: number | string;
}
