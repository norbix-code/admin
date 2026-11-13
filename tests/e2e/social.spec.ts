import { expect, test } from '@playwright/test';

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
    socialStarts: { provider: string; projectId: string; returnUrl: string }[];
    socialExchanges: {
      code: string;
      authorization: string | null;
      project: string | null;
    }[];
    linkStarts: { userId: string; provider: string; returnUrl: string }[];
    linkFinishes: { userId: string; code: string; authorization: string }[];
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
  await page.getByRole('link', { name: 'Continue with Google' }).click();

  await expect(
    page.getByRole('heading', { name: 'Your account' }),
  ).toBeVisible();
  // The code left the address bar.
  await expect(page).toHaveURL(`${baseURL}/`);

  const s = await state(page);
  expect(s.socialStarts).toEqual([
    {
      provider: 'google',
      projectId: 'pr_e2e',
      returnUrl: `${baseURL}/oauth/callback?via=google`,
    },
  ]);
  // Through the proxy, with the project header and no credentials.
  expect(s.socialExchanges).toEqual([
    {
      provider: 'google',
      code: 'e2e-social-code',
      authorization: null,
      project: 'pr_e2e',
    },
  ]);
});

test('no social sign-in in the config: no button', async ({ page }) => {
  await page.request.post(`${FAKE_API}/__reset`, { data: {} });
  await page.goto('/sign-in');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Continue with/ })).toHaveCount(
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
