// A fake Norbix API host + Hub for the chat smoke test. It stands BEHIND the
// portal's real BFF proxy (HUB_BASE_URL / API_BASE_URL point here), so the
// test also proves the proxy forwards `nb-project-id` + the bearer token and
// streams server-sent events as they are written.
//
// Shapes follow the gateway (ai/two-audiences, item api-chat-endpoints):
// camelCase JSON, `/v3/ai/chat/*`, the SSE frame `data: cmd.{event} {envelope}`.
//
//   node tests/e2e/fake-api-host.mjs            (port FAKE_API_PORT, default 3198)
//   GET  /__state   → what the portal sent (feedback, stream requests …)
//   POST /__reset   → back to the first-visit state; body {"refuseStream":true}
//                     makes /event-stream answer 403 AiChatChannelRefused

import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_API_PORT ?? 3198);
const PROJECT = 'pr_e2e';
const TOKEN = 'e2e-token';
const CHANNEL = `ai-chat:${PROJECT}:usr_e2e`;

// The answer the assistant streams: markdown + a norbix-view table, so the
// golden shows the output factory, not just plain text.
const REPLY = [
  '## Your last order',
  '',
  '- **Order:** #42',
  '- **Status:** left the warehouse today',
  '',
  '```norbix-view type=table',
  '[{"item":"Sneakers","qty":1,"price":"59.00"},{"item":"Socks","qty":3,"price":"9.00"}]',
  '```',
];
const TOKENS = REPLY.map((line, i) => (i === 0 ? line : `\n${line}`));

let state;
const reset = (opts = {}) => {
  state = {
    refuseStream: !!opts.refuseStream,
    sessions: [],
    entries: [],
    feedback: [],
    streamRequests: 0,
    heartbeats: 0,
    badRequests: [],
    streams: new Set(),
  };
};
reset();

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const refuse = (res, message, errorCode = 'CM-ERRORS-AI-CHAT-009') =>
  json(res, 400, {
    responseStatus: { isSuccess: false, errors: [{ message, errorCode }] },
  });

const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });

// The real gateway prefixes the selector with the channel the message was
// published on (`<channel>@cmd.<event>`); only cmd.onConnect comes bare.
const envelope = (eventName, payload) =>
  `data: ${CHANNEL}@cmd.${eventName} ${JSON.stringify({
    channel: 'ai-chat',
    eventName,
    projectId: PROJECT,
    createdAtUtc: '2026-09-30T10:00:00Z',
    payload,
  })}\n\n`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run one turn: stream it to every open stream, then persist it. */
const runTurn = async (sessionId, message) => {
  const turnId = 'trn_e2e';
  const userSeq = state.entries.length + 1;
  const user = {
    kind: 'user.message',
    id: `ent_${userSeq}`,
    seq: userSeq,
    atUtc: '2026-09-30T10:00:00Z',
    text: message,
    attachments: [],
  };
  state.entries.push(user);
  const reply = {
    kind: 'assistant.text',
    id: `ent_${userSeq + 1}`,
    seq: userSeq + 1,
    atUtc: '2026-09-30T10:00:01Z',
    text: '',
    isStreaming: true,
  };

  const send = (frame) => state.streams.forEach((s) => s.write(frame));
  // The portal opens its stream after the turn response (it learns the
  // channel from it): wait for it, so the tokens really stream.
  for (let i = 0; i < 100 && state.streams.size === 0; i++) await sleep(100);
  await sleep(200);
  send(
    envelope('ai.chat.turn.started', { type: 'aiChatTurn', turnId, sessionId }),
  );
  send(
    envelope('ai.chat.progress', {
      type: 'aiChatEntry',
      step: 'ai.chat.entry',
      sessionId,
      seq: user.seq,
      entry: user,
    }),
  );
  for (const token of TOKENS) {
    await sleep(120);
    reply.text += token;
    send(
      envelope('ai.chat.turn.token', {
        type: 'aiChatTurn',
        turnId,
        sessionId,
        entryId: reply.id,
        text: token,
      }),
    );
  }
  reply.isStreaming = false;
  state.entries.push(reply);
  const session = state.sessions.find((s) => s.id === sessionId);
  if (session) session.title = 'Order status';
  send(
    envelope('ai.chat.turn.completed', {
      type: 'aiChatTurn',
      turnId,
      sessionId,
      entryId: reply.id,
      text: reply.text,
    }),
  );
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const auth = req.headers.authorization;
  const project = req.headers['nb-project-id'];

  // ── test control ──
  if (path === '/__reset') {
    reset(await readBody(req));
    return json(res, 200, { ok: true });
  }
  if (path === '/__state') {
    const { streams: _streams, ...rest } = state;
    return json(res, 200, rest);
  }

  // ── Hub /echo + public project config (no auth) ──
  if (path === '/v3/echo') {
    return json(res, 200, {
      apiUrl: `http://127.0.0.1:${PORT}/v3`,
      apiVersion: 'v3',
      release: 'Community',
      runtime: 'Development',
      regions: [],
    });
  }
  if (path === `/v3/public/projects/${PROJECT}/config`) {
    return json(res, 200, {
      displayName: 'E2E Shop',
      adminPortalEnabled: true,
      auth: { socialProviders: [], passkey: false },
      aiChat: {
        enabled: true,
        assistants: [
          {
            id: 'ast_support',
            name: 'Support',
            welcome: 'Hi! Ask me about your orders.',
          },
          {
            id: 'ast_billing',
            name: 'Billing',
            welcome: 'Questions about invoices?',
          },
        ],
      },
    });
  }

  // ── realtime ──
  if (path === '/event-stream') {
    state.streamRequests += 1;
    if (auth !== `Bearer ${TOKEN}`) return json(res, 401, {});
    const channel = url.searchParams.get('channels');
    if (state.refuseStream || channel !== CHANNEL) {
      return json(res, 403, {
        responseStatus: {
          errorCode: 'AiChatChannelRefused',
          message: `Not authorized for channel '${channel}'. Do not retry.`,
        },
      });
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
    });
    res.write(
      `data: cmd.onConnect ${JSON.stringify({
        id: 'sub_e2e',
        heartbeatUrl: `http://127.0.0.1:${PORT}/event-heartbeat?id=sub_e2e`,
        heartbeatIntervalMs: 2000,
      })}\n\n`,
    );
    state.streams.add(res);
    req.on('close', () => state.streams.delete(res));
    return;
  }
  if (path === '/event-heartbeat') {
    state.heartbeats += 1;
    return json(res, 200, {});
  }

  // ── /v3/ai/chat/* — the caller must be signed in and scoped to the project ──
  if (path.startsWith('/v3/ai/chat')) {
    if (auth !== `Bearer ${TOKEN}` || project !== PROJECT) {
      state.badRequests.push({ path, auth: !!auth, project: project ?? null });
      return refuse(res, 'No project on the request.', 'CM-ERRORS-AI-CHAT-001');
    }

    if (path === '/v3/ai/chat/availability') {
      return json(res, 200, {
        enabled: true,
        available: true,
        defaultAssistantId: 'ast_support',
        assistants: [
          {
            id: 'ast_support',
            name: 'Support',
            welcomeMessage: 'Hi! Ask me about your orders.',
            isDefault: true,
            memoryEnabled: true,
          },
          {
            id: 'ast_billing',
            name: 'Billing',
            welcomeMessage: 'Questions about invoices?',
            isDefault: false,
            memoryEnabled: false,
          },
        ],
      });
    }
    if (path === '/v3/ai/chat/sessions' && req.method === 'GET') {
      return json(res, 200, { sessions: state.sessions });
    }
    if (path === '/v3/ai/chat/turn' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.message?.trim()) return refuse(res, 'Write a message first.');
      let sessionId = body.sessionId;
      if (!sessionId) {
        sessionId = 'aics_e2e';
        state.sessions.unshift({
          id: sessionId,
          assistantId: body.assistantId ?? 'ast_support',
          title: null,
          isPinned: false,
          isArchived: false,
          lastSeq: 0,
          createdAtUtc: '2026-09-30T10:00:00Z',
          updatedAtUtc: '2026-09-30T10:00:00Z',
        });
      }
      void runTurn(sessionId, body.message);
      return json(res, 200, { turnId: 'trn_e2e', sessionId, channel: CHANNEL });
    }
    const entries = /^\/v3\/ai\/chat\/sessions\/([^/]+)\/entries$/.exec(path);
    if (entries && req.method === 'GET') {
      return json(res, 200, {
        sessionId: entries[1],
        entries: state.entries,
        lastSeq: state.entries.length,
        hasMore: false,
      });
    }
    const feedback =
      /^\/v3\/ai\/chat\/sessions\/([^/]+)\/entries\/([^/]+)\/feedback$/.exec(
        path,
      );
    if (feedback && req.method === 'PUT') {
      const body = await readBody(req);
      state.feedback.push({ entryId: feedback[2], feedback: body.feedback });
      const entry = state.entries.find((e) => e.id === feedback[2]);
      if (entry) entry.feedback = body.feedback || null;
      return json(res, 200, {});
    }
    const pin = /^\/v3\/ai\/chat\/sessions\/([^/]+)\/pin$/.exec(path);
    if (pin && req.method === 'PUT') {
      const body = await readBody(req);
      const s = state.sessions.find((x) => x.id === pin[1]);
      if (s) s.isPinned = !!body.pinned;
      return json(res, 200, {});
    }
    if (path === '/v3/ai/chat/memory' && req.method === 'GET') {
      return json(res, 200, {
        notes: [
          {
            id: 'mem_1',
            sessionId: 'aics_old',
            kind: 'preference',
            text: 'Prefers delivery to the office.',
            createdAtUtc: '2026-09-29T09:00:00Z',
          },
        ],
      });
    }
  }

  json(res, 404, {
    responseStatus: { isSuccess: false, errors: [{ message: 'Not found' }] },
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`fake API host on http://127.0.0.1:${PORT}`);
});
