// Portal backend reverse proxy: the browser talks ONLY to this same-origin
// endpoint and never to the gateway directly. The gateway host (Hub / API)
// lives only on the server here, with fallbacks to hub.norbix.ai / api.norbix.ai.
//
//   browser  →  /api/proxy/api/v3/membership/...   →  API_BASE_URL/v3/...
//   browser  →  /api/proxy/hub/v3/echo             →  HUB_BASE_URL/v3/...
//
// The user's own JWT is forwarded as-is (Authorization), so authenticated user
// data still flows on the user's behalf — the backend does not inject the
// service key here (that is only for the privileged catalog in /api/bootstrap).
// The proxy is transparent: same method, path, query, body, and the handful of
// Norbix headers the SDK sends. If the request has no `norbix-env` header and
// the server sets ENV (a self-hosted staging/test portal), the proxy stamps it.
import { NextRequest } from 'next/server';
import { NORBIX_HUB_URL, NORBIX_API_URL } from '@norbix.ai/ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HUB_BASE = (process.env.HUB_BASE_URL ?? NORBIX_HUB_URL).replace(
  /\/$/,
  '',
);
const API_BASE = (process.env.API_BASE_URL ?? NORBIX_API_URL).replace(
  /\/$/,
  '',
);

/** Optional Norbix environment for self-hosted staging/test portals. */
const SERVER_ENV =
  process.env.ENV && process.env.ENV.length > 0 ? process.env.ENV : undefined;

// Only these request headers are forwarded upstream. Everything else (host,
// cookies the gateway doesn't use, etc.) is dropped so the proxy stays a clean
// pass-through of the Norbix wire contract.
const FORWARD_REQUEST_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  // Canonical tenant-scope headers (AuthStatics.*HeaderKey on the gateway).
  // The credentials auth provider only reads `norbix-project-id`; without it
  // login falls into the account-root scope and fails with
  // "Invalid Username or Password" on self-hosted builds.
  'norbix-project-id',
  'norbix-account-id',
  'norbix-db-id',
  // Legacy names kept for older gateways.
  'x-cm-projectid',
  'x-cm-accountid',
  'norbix-env',
  'nb-region',
];

// Response headers we strip (hop-by-hop / re-set by Next).
const STRIP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
]);

function baseFor(target: string): string | null {
  if (target === 'api') return API_BASE;
  if (target === 'hub') return HUB_BASE;
  return null;
}

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ target: string; path?: string[] }> },
): Promise<Response> {
  const { target, path } = await ctx.params;
  const base = baseFor(target);
  if (!base) {
    return new Response('Unknown proxy target', { status: 404 });
  }

  const upstreamPath = (path ?? []).map(encodeURIComponent).join('/');
  const search = req.nextUrl.search; // includes leading '?' or ''
  const upstreamUrl = `${base}/${upstreamPath}${search}`;

  // TEMP DIAGNOSTIC (remove after debugging): prove which host the proxy
  // forwards to. If a local login shows api.norbix.ai here, API_BASE_URL is not
  // in effect — restart `next dev` after setting it in .env.
  console.log(`[PROXY-DEBUG] ${req.method} ${target} -> ${upstreamUrl}`);

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  // Self-hosted staging/test portals set ENV on the server; stamp it as the
  // norbix-env header when the browser didn't send one. Managed portals derive
  // the environment from the host (e.g. test.pr_x.admin.norbix.ai) instead.
  if (SERVER_ENV && !headers.has('norbix-env')) {
    headers.set('norbix-env', SERVER_ENV);
  }

  // GET/HEAD have no body; everything else streams the request body through.
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: 'manual',
      // @ts-expect-error: Node fetch needs duplex for streamed bodies; harmless here.
      duplex: hasBody ? 'half' : undefined,
    });
  } catch {
    return new Response('Upstream gateway unreachable', { status: 502 });
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
