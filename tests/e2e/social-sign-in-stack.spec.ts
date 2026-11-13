import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  Developer,
  EndUser,
  Json,
  RUN,
  apiCall,
  apiSignIn,
  errorCodeOf,
  preparePortal,
  registerEndUser,
} from './membership-stack-lib';
import { env, must, project, publicConfig, rows, until } from './stack-lib';

/**
 * Social sign-in against the real gateway, up to the provider (gateway
 * membership-social + hardening rounds; admin a80bfc6 … a45ca64). Google and
 * GitHub integrations with made-up client ids are saved through the Hub; the
 * provider's own token exchange cannot run here (it needs the real Google /
 * GitHub), so every check stops at the 302 to the provider or works on the
 * gateway's own answers.
 *
 * The stack serves the portal and the Api over plain http on `.test` names.
 * The gateway allows a plain-http returnUrl only on loopback
 * (SocialSignInRules.CheckReturnUrl) and sets `nb_social` with `Secure` on a
 * non-loopback callback — so the click as it is cannot reach the provider
 * here (finding F1 in the proof report, test.fixme below). To prove the rest
 * of the browser leg, the start the portal builds is replayed with the same
 * returnUrl on https (the production shape), an origin saved as an Allowed
 * Origin; and Chromium treats the http portal as a secure context
 * (`--unsafely-treat-insecure-origin-as-secure`), as https would be, so Web
 * Crypto can make the PKCE pair.
 */

test.describe.configure({ mode: 'serial' });

const PORTAL = new URL(env.base).origin; // http://admin.<item>.norbix.test
const PORTAL_HTTPS = PORTAL.replace(/^http:/, 'https:');
const API_ORIGIN = new URL(env.api).origin; // http://<item>.norbix.test:5002

// `channel: 'chromium'` = the full Chromium in new headless mode; the default
// headless shell ignores this flag (seen on the stack, Chromium 149).
test.use({
  channel: 'chromium',
  launchOptions: { args: [`--unsafely-treat-insecure-origin-as-secure=${PORTAL},${API_ORIGIN}`] },
});

const MODE = {
  name: 'Web',
  callbackUrl: 'https://shop.example.test/signed-in',
  failureRedirectUrl: 'https://shop.example.test/failed',
};

const INTEGRATIONS = [
  { name: 'Google sign-in (stack)', enabled: true, body: { provider: 'Google', clientId: 'stack-client.apps.googleusercontent.com', clientSecret: 'stack-secret' } },
  { name: 'GitHub sign-in (stack)', enabled: true, body: { provider: 'GitHub', clientId: 'stack-github-client', clientSecret: 'stack-secret' } },
  { name: 'Facebook sign-in (stack, off)', enabled: false, body: { provider: 'Facebook', appId: 'stack-facebook-app', appSecret: 'stack-secret' } },
];

let dev: Developer;
let apiUrl = ''; // the /echo apiUrl, e.g. http://proof.norbix.test:5002/v3
let alice: EndUser;
let bob: EndUser;

/** Save each integration once (found by name on a rerun). */
async function ensureIntegrations(dev: Developer): Promise<void> {
  const list = async () => rows(must(await dev.hub('GET', '/membership/integrations'), 'GET membership integrations'));
  const existing = await list();
  for (const it of INTEGRATIONS) {
    if (existing.some((x) => x.integrationName === it.name)) continue;
    must(
      await dev.hub('POST', '/membership/integrations', {
        integration: { ...it.body, integrationName: it.name, isEnabled: it.enabled, oAuthModes: [MODE] },
      }),
      `SaveMembershipIntegration ${it.name}`,
    );
  }
  await until('the three sign-in integrations in the list', async () => {
    const names = (await list()).map((x) => x.integrationName);
    return INTEGRATIONS.every((it) => names.includes(it.name));
  });
}

/** The https form of the stack portal as an Allowed Origin (keeps every origin already there). */
async function ensureHttpsPortalOrigin(dev: Developer): Promise<void> {
  const current = ((await project(dev)).allowedOrigins as string[] | undefined) ?? [];
  if (current.some((o) => o.replace(/\/+$/, '') === PORTAL_HTTPS)) return;
  must(await dev.hub('PATCH', `/account/projects/${dev.projectId}/settings/origins`, { origins: [...current, PORTAL_HTTPS] }), 'UpdateProjectAllowedOrigins');
  await until(`${PORTAL_HTTPS} in the allowed origins`, async () =>
    (((await project(dev)).allowedOrigins as string[] | undefined) ?? []).some((o) => o.replace(/\/+$/, '') === PORTAL_HTTPS),
  );
}

/** One request, redirects NOT followed, no cookie jar (Node fetch). */
async function raw(url: string, init: { method?: string; cookie?: string; body?: Json } = {}) {
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    redirect: 'manual',
    headers: {
      accept: 'application/json',
      'norbix-project-id': env.projectId,
      ...(init.cookie ? { cookie: init.cookie } : {}),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let json: Json = {};
  try {
    json = text ? (JSON.parse(text) as Json) : {};
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, location: res.headers.get('location') ?? '', cookies: res.headers.getSetCookie(), json };
}

const startUrl = (provider: string, query: Record<string, string> = {}, host = apiUrl) =>
  `${host}/membership/auth/social/${provider}?${new URLSearchParams({ projectId: env.projectId, ...query })}`;

const nbSocial = (cookies: string[]) => cookies.find((c) => c.startsWith('nb_social='));
const cookieValue = (setCookie: string) => setCookie.split(';')[0];
const s256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

test.beforeAll(async () => {
  dev = await preparePortal();
  await ensureIntegrations(dev);
  await ensureHttpsPortalOrigin(dev);
  apiUrl = String(must(await apiCall('GET', '/echo'), 'GET echo').apiUrl).replace(/\/+$/, '');
  await until('the public config offers Google and GitHub', async () => {
    const offered = (((await publicConfig(dev.ctx, dev.projectId)).auth as Json | undefined)?.socialSignIn as Json[] | undefined) ?? [];
    return offered.some((x) => x.provider === 'google') && offered.some((x) => x.provider === 'github');
  });
  alice = await registerEndUser(dev, `alice.${RUN}@example.test`, 'Alice-pass-2026');
  bob = await registerEndUser(dev, `bob.${RUN}@example.test`, 'Bobby-pass-2026');
});

test('the sign-in page shows a button per ENABLED integration from auth.socialSignIn', async ({ page }) => {
  const offered = ((await publicConfig(dev.ctx, dev.projectId)).auth as Json).socialSignIn as Json[];
  expect(offered.map((x) => ({ provider: x.provider, displayName: x.displayName, startPath: x.startPath }))).toEqual([
    { provider: 'google', displayName: 'Google', startPath: `/v3/membership/auth/social/google?projectId=${env.projectId}` },
    { provider: 'github', displayName: 'GitHub', startPath: `/v3/membership/auth/social/github?projectId=${env.projectId}` },
  ]);

  await page.goto('/sign-in');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
  // the disabled Facebook integration has no button
  await expect(page.getByRole('button', { name: /Continue with (Facebook|Meta)/ })).toHaveCount(0);
});

for (const [label, provider, providerHost] of [
  ['Google', 'google', 'accounts.google.com'],
  ['GitHub', 'github', 'github.com'],
] as const) {
  test(`Continue with ${label}: the portal starts on the API host with PKCE; the gateway answers 302 to ${providerHost} and sets nb_social`, async ({ page }) => {
    let started = '';
    let verifier: string | null = null;
    let gateway: { status: number; location: string; setCookies: string[] } | null = null;

    // Stop at the start: record what the portal built, replay it (https returnUrl, see the
    // header comment) without following the redirect, and never let the browser reach the provider.
    await page.route(
      (url) => url.pathname.endsWith(`/membership/auth/social/${provider}`),
      async (route) => {
        started = route.request().url();
        const replay = new URL(started);
        replay.searchParams.set('returnUrl', replay.searchParams.get('returnUrl')!.replace(PORTAL, PORTAL_HTTPS));
        const res = await route.fetch({ url: replay.toString(), maxRedirects: 0 });
        gateway = {
          status: res.status(),
          location: res.headers().location ?? '',
          setCookies: res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value),
        };
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>stopped before the provider</p>' });
      },
    );

    await page.goto('/sign-in');
    await page.getByRole('button', { name: `Continue with ${label}` }).click();
    await expect.poll(() => gateway !== null, { message: 'the start was intercepted' }).toBe(true);

    // Back on the portal in the same tab: the verifier waits in sessionStorage for the return.
    await page.goto('/sign-in');
    verifier = await page.evaluate((key) => window.sessionStorage.getItem(key), `norbix:pkce:signIn:${provider}`);

    // What the portal built: {echo apiUrl host}{startPath}&returnUrl=…&codeChallenge=…
    const start = new URL(started);
    const challenge = start.searchParams.get('codeChallenge') ?? '';
    expect({
      at: `${start.origin}${start.pathname}`,
      projectId: start.searchParams.get('projectId'),
      returnUrl: start.searchParams.get('returnUrl'),
      challengeIsS256: /^[A-Za-z0-9_-]{43}$/.test(challenge),
      verifierKept: typeof verifier === 'string' && (verifier as string).length >= 43,
      verifierMatches: verifier ? s256(verifier) === challenge : false,
    }).toEqual({
      at: `${apiUrl}/membership/auth/social/${provider}`,
      projectId: env.projectId,
      returnUrl: `${PORTAL}/oauth/callback?via=${provider}`,
      challengeIsS256: true,
      verifierKept: true,
      verifierMatches: true,
    });

    // What the gateway answered.
    const g = gateway!;
    const to = new URL(g.location);
    const cookie = nbSocial(g.setCookies) ?? '';
    expect({
      status: g.status,
      host: to.host,
      redirectUri: to.searchParams.get('redirect_uri'),
      hasState: (to.searchParams.get('state') ?? '').length > 20,
      clientId: to.searchParams.get('client_id'),
      cookieHttpOnly: /;\s*HttpOnly/i.test(cookie),
      cookiePath: /;\s*Path=([^;]+)/i.exec(cookie)?.[1],
      cookieMaxAge: /;\s*Max-Age=(\d+)/i.exec(cookie)?.[1],
    }).toEqual({
      status: 302,
      host: providerHost,
      redirectUri: `${apiUrl}/membership/auth/social/${provider}/callback/${env.projectId}`,
      hasState: true,
      clientId: provider === 'google' ? 'stack-client.apps.googleusercontent.com' : 'stack-github-client',
      cookieHttpOnly: true,
      cookiePath: `${new URL(apiUrl).pathname}/membership/auth/social/${provider}/callback/${env.projectId}`,
      cookieMaxAge: '600',
    });
    // The provider-side PKCE (gateway ↔ provider) is Google's; GitHub's OAuth app flow has none.
    if (provider === 'google') {
      expect({ method: to.searchParams.get('code_challenge_method'), hasChallenge: (to.searchParams.get('code_challenge') ?? '').length >= 43 }).toEqual({
        method: 'S256',
        hasChallenge: true,
      });
    }
  });
}

test.fixme('F1: the click as it is reaches the provider on the stack (http portal returnUrl)', async () => {
  // Today: 302 to the mode's failure page with error=return_url_not_allowed — plain http is
  // allowed only on loopback (gateway SocialSignInRules.cs:170), and the stack portal is
  // http://admin.<item>.norbix.test. Production portals are https.
  const r = await raw(startUrl('google', { returnUrl: `${PORTAL}/oauth/callback?via=google` }));
  expect(new URL(r.location).host).toBe('accounts.google.com');
});

test.fixme('F1: the hosted portal origin (pr-<hex> admin host) is accepted as returnUrl on the stack', async () => {
  // The project's own hosted portal is in the allowed set (round 3 step 14), but on the stack
  // it is http://pr-<hex>.<item>.norbix.test:3000 — refused by the same http rule.
  const hosted = new URL(String((await project(dev)).canonicalAdminUrl)).origin;
  const r = await raw(startUrl('google', { returnUrl: `${hosted}/oauth/callback?via=google` }));
  expect(new URL(r.location).host).toBe('accounts.google.com');
});

test('a returnUrl on a foreign origin goes to the mode failure page with error=return_url_not_allowed; no state, no cookie', async () => {
  const r = await raw(startUrl('google', { returnUrl: 'https://evil.example.test/steal' }));
  expect({ status: r.status, location: r.location, cookie: nbSocial(r.cookies) ?? null }).toEqual({
    status: 302,
    location: `${MODE.failureRedirectUrl}?error=return_url_not_allowed`,
    cookie: null,
  });
});

test('an allowed https portal origin is accepted (302 to the provider)', async () => {
  const r = await raw(startUrl('google', { returnUrl: `${PORTAL_HTTPS}/oauth/callback?via=google` }));
  expect({ status: r.status, host: new URL(r.location).host, cookie: Boolean(nbSocial(r.cookies)) }).toEqual({
    status: 302,
    host: 'accounts.google.com',
    cookie: true,
  });
});

test('a start on another host name hops once to the public API address (nb_hop=1), then goes to the provider', async () => {
  // The ingress also answers api.<item>.norbix.test on port 80 — not the /echo apiUrl host.
  const other = `http://api.${new URL(apiUrl).hostname}/v3`;
  const first = await raw(startUrl('google', {}, other));
  const hop = new URL(first.location);
  expect({
    status: first.status,
    to: `${hop.origin}${hop.pathname}`,
    projectId: hop.searchParams.get('projectId'),
    marker: hop.searchParams.get('nb_hop'),
    cookie: nbSocial(first.cookies) ?? null,
  }).toEqual({
    status: 302,
    to: `${apiUrl}/membership/auth/social/google`,
    projectId: env.projectId,
    marker: '1',
    cookie: null,
  });
  const second = await raw(first.location);
  expect({ status: second.status, host: new URL(second.location).host, cookie: Boolean(nbSocial(second.cookies)) }).toEqual({
    status: 302,
    host: 'accounts.google.com',
    cookie: true,
  });
});

test('a callback with a missing or wrong nb_social cookie → error=state_mismatch; the state is spent', async () => {
  const returnUrl = `${PORTAL_HTTPS}/oauth/callback?via=google`;
  const callbackOf = (location: string) => {
    const to = new URL(location);
    return `${to.searchParams.get('redirect_uri')}?code=made-up-code&state=${encodeURIComponent(to.searchParams.get('state') ?? '')}`;
  };

  // missing
  const s1 = await raw(startUrl('google', { returnUrl }));
  const missing = await raw(callbackOf(s1.location));
  // wrong
  const s2 = await raw(startUrl('google', { returnUrl }));
  const wrong = await raw(callbackOf(s2.location), { cookie: 'nb_social=not-the-nonce' });
  // the same state again, now WITH the right cookie: already spent → 051 (no page to go to)
  const again = await raw(callbackOf(s2.location), { cookie: cookieValue(nbSocial(s2.cookies)!) });

  const cleared = (cookies: string[]) => /Max-Age=0/i.test(nbSocial(cookies) ?? '');
  expect({
    missing: { status: missing.status, location: missing.location, cleared: cleared(missing.cookies) },
    wrong: { status: wrong.status, location: wrong.location, cleared: cleared(wrong.cookies) },
    again: { status: again.status, code: errorCodeOf({ status: again.status, json: again.json }) },
  }).toEqual({
    missing: { status: 302, location: `${returnUrl}&error=state_mismatch`, cleared: true },
    wrong: { status: 302, location: `${returnUrl}&error=state_mismatch`, cleared: true },
    again: { status: 400, code: 'CM-ERRORS-MEMBERSHIP-051' },
  });
});

test('an exchange with a made-up code → 400 CM-ERRORS-MEMBERSHIP-051', async () => {
  const r = await apiCall('POST', '/membership/auth/social/google/exchange', {
    projectId: env.projectId,
    provider: 'google',
    code: 'made-up-code',
    codeVerifier: 'dBjftJeZ4CVP-mJ92K9jXMXwiwtNe7pKzMCIEuaLdK8',
  });
  expect({ status: r.status, code: errorCodeOf(r) }).toEqual({ status: 400, code: 'CM-ERRORS-MEMBERSHIP-051' });
});

test('a link start for another user → 403 CM-ERRORS-MEMBERSHIP-056', async () => {
  const signIn = await apiSignIn(alice.email, alice.password);
  const token = String(signIn.json.bearerToken);
  const forBob = await apiCall(
    'POST',
    `/membership/auth/${bob.id}/link-identity/start`,
    { provider: 'google', returnUrl: `${PORTAL_HTTPS}/oauth/callback?via=google&link=1` },
    { authorization: `Bearer ${token}` },
  );
  const forSelf = await apiCall(
    'POST',
    `/membership/auth/${alice.id}/link-identity/start`,
    { provider: 'google', returnUrl: `${PORTAL_HTTPS}/oauth/callback?via=google&link=1` },
    { authorization: `Bearer ${token}` },
  );
  expect({
    other: { status: forBob.status, code: errorCodeOf(forBob) },
    self: { status: forSelf.status, toGoogle: String(forSelf.json.authorizeUrl ?? '').startsWith('https://accounts.google.com/') },
  }).toEqual({
    other: { status: 403, code: 'CM-ERRORS-MEMBERSHIP-056' },
    self: { status: 200, toGoogle: true },
  });
});
