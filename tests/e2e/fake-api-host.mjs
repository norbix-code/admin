// A fake Norbix API host + Hub for the browser tests. It stands BEHIND the
// portal's real backend proxy (HUB_BASE_URL / API_BASE_URL point here), so
// the tests also prove the proxy forwards the project headers and the bearer
// token.
//
//   node tests/e2e/fake-api-host.mjs            (port FAKE_API_PORT, default 3198)
//   GET  /__state   → what the portal sent on the social and recovery routes
//   GET  /__assets/logo.svg → the project's brand logo (public config logoUrl)
//   POST /__reset   → back to the first-visit state; body {"social":true}
//                     offers Google sign-in in the public config;
//                     {"linkConflict":true} answers the link finish with 409
//                     CM-ERRORS-MEMBERSHIP-055
//   GET  /__provider?next=… → the "provider": sends the browser on to `next`
//   PKCE: a code whose start carried `codeChallenge` is
//        exchanged / finished only with the matching `codeVerifier`, else
//        CM-ERRORS-MEMBERSHIP-058; a code started without one needs none
//   POST /v3/membership/userauth/recovery/magic-link/consume → token
//        "e2e-recovery-token" answers a recovery session once; anything else
//        (or a second use) is CM-ERRORS-PASSKEY-016

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

const PORT = Number(process.env.FAKE_API_PORT ?? 3198);
const PROJECT = 'pr_e2e';
const TOKEN = 'e2e-token';
// The project's brand logo + icon, served by this host itself (no external
// URL): a small SVG — a green rounded square with "E2E" — so the branding
// golden shows a real image, not a broken-image icon.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" viewBox="0 0 120 32"><rect width="32" height="32" rx="6" fill="#1f7a4d"/><text x="16" y="21" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">E2E</text><text x="40" y="22" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#1f7a4d">Shop</text></svg>`;
const LOGO_URL = `http://127.0.0.1:${PORT}/__assets/logo.svg`;

let state;
const reset = (opts = {}) => {
  state = {
    social: !!opts.social,
    linkConflict: !!opts.linkConflict,
    // What the portal sent on the social routes (social sign-in spec).
    socialStarts: [],
    socialExchanges: [],
    linkStarts: [],
    linkFinishes: [],
    // The challenge of the last sign-in start and link start (PKCE).
    signInChallenge: null,
    linkChallenge: null,
    // Passkey recovery link redemptions (social sign-in spec).
    recoveryConsumes: [],
  };
};
reset();

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const refuse = (res, message, errorCode) =>
  json(res, 400, {
    responseStatus: { isSuccess: false, errors: [{ message, errorCode }] },
  });

// PKCE S256 as the gateway checks it: a challenge needs the verifier whose
// base64url(SHA-256) it is; a verifier with no challenge is refused too.
const pkceMatches = (challenge, verifier) => {
  if (!challenge) return !verifier;
  if (!verifier) return false;
  return (
    createHash('sha256').update(verifier).digest('base64url') === challenge
  );
};

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

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  const auth = req.headers.authorization;

  // ── test control ──
  if (path === '/__reset') {
    reset(await readBody(req));
    return json(res, 200, { ok: true });
  }
  if (path === '/__state') {
    return json(res, 200, state);
  }

  if (path === '/__assets/logo.svg') {
    res.writeHead(200, {
      'content-type': 'image/svg+xml',
      'cache-control': 'no-cache',
    });
    return res.end(LOGO_SVG);
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
      // Brand exposed: logo + icon only. No colours, so the goldens keep
      // the default token colours.
      branding: {
        displayName: 'E2E Shop',
        logoUrl: LOGO_URL,
        iconUrl: LOGO_URL,
      },
      auth: {
        socialProviders: state.social ? ['google'] : [],
        socialSignIn: state.social
          ? [
              {
                provider: 'google',
                displayName: 'Google',
                startPath: `/v3/membership/auth/social/google?projectId=${PROJECT}`,
              },
            ]
          : [],
        passkey: false,
      },
    });
  }

  // ── Passkey recovery link (MembershipPortalLinks.MagicLink) ──
  if (
    path === '/v3/membership/userauth/recovery/magic-link/consume' &&
    req.method === 'POST'
  ) {
    const body = await readBody(req);
    const used = state.recoveryConsumes.some((c) => c.ok);
    const ok = body.token === 'e2e-recovery-token' && !used;
    state.recoveryConsumes.push({
      token: body.token,
      authorization: auth ?? null,
      project: req.headers['norbix-project-id'] ?? null,
      ok,
    });
    if (!ok) {
      return refuse(
        res,
        'The recovery link is invalid or has already been used',
        'CM-ERRORS-PASSKEY-016',
      );
    }
    return json(res, 200, {
      accessToken: 'e2e-recovery-session',
      refreshToken: 'e2e-refresh',
      expiresInSeconds: 900,
      remainingCodes: 0,
    });
  }

  // ── Social sign-in + link identity (gateway feat/membership-social) ──
  // The start is a browser navigation straight to this host (not through the
  // portal proxy): answer what the gateway answers after the provider round,
  // a redirect to the return page with a one-time code.
  const socialStart = /^\/v3\/membership\/auth\/social\/([a-z]+)$/.exec(path);
  if (socialStart && req.method === 'GET') {
    const returnUrl = url.searchParams.get('returnUrl') ?? '';
    state.signInChallenge = url.searchParams.get('codeChallenge');
    state.socialStarts.push({
      provider: socialStart[1],
      projectId: url.searchParams.get('projectId'),
      returnUrl,
      codeChallenge: state.signInChallenge,
    });
    const back = new URL(returnUrl);
    back.searchParams.set('code', 'e2e-social-code');
    back.searchParams.set('provider', socialStart[1]);
    res.writeHead(302, {
      location: back.toString(),
      'cache-control': 'no-store',
    });
    return res.end();
  }
  if (path === '/__provider') {
    res.writeHead(302, { location: url.searchParams.get('next') ?? '/' });
    return res.end();
  }
  const exchange = /^\/v3\/membership\/auth\/social\/([a-z]+)\/exchange$/.exec(
    path,
  );
  if (exchange && req.method === 'POST') {
    const body = await readBody(req);
    state.socialExchanges.push({
      provider: exchange[1],
      code: body.code,
      codeVerifier: body.codeVerifier ?? null,
      authorization: auth ?? null,
      project: req.headers['norbix-project-id'] ?? null,
    });
    if (body.code !== 'e2e-social-code') {
      return refuse(res, 'expired', 'CM-ERRORS-MEMBERSHIP-051');
    }
    if (!pkceMatches(state.signInChallenge, body.codeVerifier)) {
      return refuse(res, 'verifier mismatch', 'CM-ERRORS-MEMBERSHIP-058');
    }
    return json(res, 200, {
      bearerToken: TOKEN,
      userId: 'usr_e2e',
      displayName: 'E2E User',
      meta: { credentialVersion: 'v0' },
    });
  }
  const linkStart =
    /^\/v3\/membership\/auth\/([^/]+)\/link-identity\/start$/.exec(path);
  if (linkStart && req.method === 'POST') {
    const body = await readBody(req);
    state.linkChallenge = body.codeChallenge ?? null;
    state.linkStarts.push({
      userId: linkStart[1],
      ...body,
      authorization: auth ?? null,
    });
    const back = new URL(body.returnUrl);
    back.searchParams.set('intent', 'link');
    back.searchParams.set('code', 'e2e-link-code');
    back.searchParams.set('provider', body.provider);
    return json(res, 200, {
      authorizeUrl: `http://127.0.0.1:${PORT}/__provider?next=${encodeURIComponent(back.toString())}`,
    });
  }
  const linkFinish = /^\/v3\/membership\/auth\/([^/]+)\/link-identity$/.exec(
    path,
  );
  if (linkFinish && req.method === 'POST') {
    const body = await readBody(req);
    state.linkFinishes.push({
      userId: linkFinish[1],
      ...body,
      authorization: auth ?? null,
    });
    if (!pkceMatches(state.linkChallenge, body.codeVerifier)) {
      return refuse(res, 'verifier mismatch', 'CM-ERRORS-MEMBERSHIP-058');
    }
    if (state.linkConflict) {
      return json(res, 409, {
        responseStatus: {
          isSuccess: false,
          errors: [
            {
              message: 'The provider account is linked to another user.',
              errorCode: 'CM-ERRORS-MEMBERSHIP-055',
            },
          ],
        },
      });
    }
    return json(res, 200, {});
  }

  json(res, 404, {
    responseStatus: { isSuccess: false, errors: [{ message: 'Not found' }] },
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.warn(`fake API host on http://127.0.0.1:${PORT}`);
});
