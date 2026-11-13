import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

const s256 = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

/**
 * Social sign-in and identity linking against the fake API host
 * (fake-api-host.mjs, reset with {"social":true}): the public config offers
 * Google; the fake answers the start with the redirect the gateway sends after
 * the provider round (a one-time code), the exchange with a bearer token, and
 * the link start with a "provider" page that comes straight back.
 *
 * Functional only: no goldens (the branding sign-in golden is taken without
 * social buttons and stays as it is).
 */

const FAKE_API = `http://127.0.0.1:${process.env.FAKE_API_PORT ?? 3198}`;

const state = async (page: import('@playwright/test').Page) =>
  (await (await page.request.get(`${FAKE_API}/__state`)).json()) as {
    socialStarts: {
      provider: string;
      projectId: string;
      returnUrl: string;
      codeChallenge: string | null;
    }[];
    socialExchanges: {
      code: string;
      codeVerifier: string | null;
      authorization: string | null;
      project: string | null;
    }[];
    linkStarts: {
      userId: string;
      provider: string;
      returnUrl: string;
      codeChallenge?: string;
    }[];
    linkFinishes: {
      userId: string;
      code: string;
      codeVerifier?: string;
      authorization: string;
    }[];
  };

const signedInAs = (page: import('@playwright/test').Page) =>
  page.addInitScript(() => {
    window.localStorage.setItem(
      'persist:norbix-admin',
      JSON.stringify({
        auth: JSON.stringify({ token: 'e2e-token', userId: 'usr_e2e' }),
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      }),
    );
  });

test('Continue with Google: start on the API host, code back, exchanged, signed in', async ({
  page,
  baseURL,
}) => {
  const res = await page.request.post(`${FAKE_API}/__reset`, {
    data: { social: true },
  });
  expect(res.ok()).toBe(true);

  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Continue with Google' }).click();

  await expect(
    page.getByRole('heading', { name: 'Your account' }),
  ).toBeVisible();
  // The code left the address bar.
  await expect(page).toHaveURL(`${baseURL}/`);

  const s = await state(page);
  expect(s.socialStarts).toMatchObject([
    {
      provider: 'google',
      projectId: 'pr_e2e',
      returnUrl: `${baseURL}/oauth/callback?via=google`,
    },
  ]);
  // PKCE: an S256 challenge on the start, its verifier on the exchange.
  const challenge = s.socialStarts[0].codeChallenge;
  expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  // Through the proxy, with the project header and no credentials.
  expect(s.socialExchanges).toMatchObject([
    {
      provider: 'google',
      code: 'e2e-social-code',
      authorization: null,
      project: 'pr_e2e',
    },
  ]);
  expect(s256(s.socialExchanges[0].codeVerifier!)).toBe(challenge);
  // The verifier is gone from the tab.
  expect(await page.evaluate(() => window.sessionStorage.length)).toBe(0);
});

test('PKCE: the code URL opened in another browser is refused (058)', async ({
  page,
  browser,
}) => {
  await page.request.post(`${FAKE_API}/__reset`, { data: { social: true } });
  // The start runs for real on the fake host (it records the challenge);
  // the browser does not follow its redirect: the code URL is "handed
  // over" to another browser instead.
  let codeUrl = '';
  await page.route(
    `${FAKE_API}/v3/membership/auth/social/**`,
    async (route) => {
      const answer = await route.fetch({ maxRedirects: 0 });
      codeUrl = answer.headers()['location'] ?? '';
      await route.abort();
    },
  );
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect.poll(() => codeUrl).toContain('code=e2e-social-code');

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(codeUrl);
  await expect(
    otherPage.getByText(
      'This sign-in link was started in another browser or tab. Please start again.',
    ),
  ).toBeVisible();
  await other.close();

  const s = await state(page);
  expect(s.socialExchanges).toMatchObject([{ codeVerifier: null }]);
});

test('no social sign-in in the config: no button', async ({ page }) => {
  await page.request.post(`${FAKE_API}/__reset`, { data: {} });
  await page.goto('/sign-in');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continue with/ })).toHaveCount(
    0,
  );
});

test('Security → Link Google: provider page, back, finished as the user, "Linked Google."', async ({
  page,
  baseURL,
}) => {
  await page.request.post(`${FAKE_API}/__reset`, { data: { social: true } });
  await signedInAs(page);

  await page.goto('/security');
  await page.getByRole('button', { name: 'Link Google' }).click();

  await expect(page.getByText('Linked Google.')).toBeVisible();
  await expect(page).toHaveURL(`${baseURL}/security`);

  const s = await state(page);
  expect(s.linkStarts).toMatchObject([
    {
      userId: 'usr_e2e',
      provider: 'google',
      returnUrl: `${baseURL}/oauth/callback?via=google&link=1`,
    },
  ]);
  expect(s.linkFinishes).toMatchObject([
    {
      userId: 'usr_e2e',
      code: 'e2e-link-code',
      authorization: 'Bearer e2e-token',
    },
  ]);
  // PKCE on the link: challenge on the start, its verifier on the finish.
  expect(s.linkStarts[0].codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(s256(s.linkFinishes[0].codeVerifier!)).toBe(
    s.linkStarts[0].codeChallenge,
  );
});

test('Security → Link Google, account of someone else (409): says so', async ({
  page,
}) => {
  await page.request.post(`${FAKE_API}/__reset`, {
    data: { social: true, linkConflict: true },
  });
  await signedInAs(page);

  await page.goto('/security');
  await page.getByRole('button', { name: 'Link Google' }).click();

  await expect(
    page.getByText('This Google account belongs to someone else.'),
  ).toBeVisible();
  await expect(page.getByText('Linked Google.')).toHaveCount(0);
});

test('a stale token still in the browser is not sent on the exchange', async ({
  page,
  baseURL,
}) => {
  await page.request.post(`${FAKE_API}/__reset`, { data: { social: true } });
  await signedInAs(page);

  await page.goto(
    '/oauth/callback?via=google&code=e2e-social-code&provider=google',
  );
  await expect(
    page.getByRole('heading', { name: 'Your account' }),
  ).toBeVisible();
  await expect(page).toHaveURL(`${baseURL}/`);

  const s = await state(page);
  expect(s.socialExchanges).toMatchObject([
    { code: 'e2e-social-code', authorization: null, project: 'pr_e2e' },
  ]);
});

test('passkey recovery link: redeemed with no credentials, recovery session on Security; a second use is refused', async ({
  page,
  baseURL,
}) => {
  await page.request.post(`${FAKE_API}/__reset`, { data: {} });
  // A stale session is still in the browser.
  await signedInAs(page);

  await page.goto('/oauth/callback#token=e2e-recovery-token');
  await expect(
    page.getByText(/You signed in with a recovery link/),
  ).toBeVisible();
  await expect(page).toHaveURL(`${baseURL}/security`);
  const stored = await page.evaluate(() =>
    window.localStorage.getItem('persist:norbix-admin'),
  );
  expect(stored).toContain('e2e-recovery-session');
  expect(stored).not.toContain('e2e-recovery-token');

  // The same link again: refused, worded plainly.
  await page.goto('/oauth/callback#token=e2e-recovery-token');
  await expect(
    page.getByText(
      'This recovery link has expired or was already used. Please ask for a new one.',
    ),
  ).toBeVisible();

  const res = await page.request.get(`${FAKE_API}/__state`);
  const s = (await res.json()) as {
    recoveryConsumes: {
      token: string;
      authorization: string | null;
      project: string | null;
      ok: boolean;
    }[];
  };
  expect(s.recoveryConsumes).toEqual([
    {
      token: 'e2e-recovery-token',
      authorization: null,
      project: 'pr_e2e',
      ok: true,
    },
    {
      token: 'e2e-recovery-token',
      authorization: null,
      project: 'pr_e2e',
      ok: false,
    },
  ]);
});
