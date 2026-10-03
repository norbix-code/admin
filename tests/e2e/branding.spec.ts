import { expect, Page, test } from '@playwright/test';

/**
 * Project branding (item project-branding): the public config of the fake API
 * host (fake-api-host.mjs) names the project "E2E Shop" and exposes a logo
 * the fake host serves itself. Every screen shows that brand, and the browser
 * tab carries the project name.
 *
 * Goldens: the sign-in page, and the signed-in shell (sidebar + home).
 */

const NAME = 'E2E Shop';
const FAKE_API = `http://127.0.0.1:${process.env.FAKE_API_PORT ?? 3198}`;
const LOGO_URL = `${FAKE_API}/__assets/logo.svg`;

// The `next dev` overlay badge is not part of the product (see chat.spec.ts).
const hideDevOverlay = (page: Page) =>
  page.evaluate(() =>
    document.querySelectorAll('nextjs-portal').forEach((e) => e.remove()),
  );

/** The logo really loaded (a broken image has naturalWidth 0). */
const expectLoadedLogo = async (page: Page) => {
  const logo = page.getByRole('img', { name: NAME });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', LOGO_URL);
  await expect
    .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  return logo;
};

test.beforeEach(async ({ page }) => {
  const res = await page.request.post(`${FAKE_API}/__reset`, { data: {} });
  expect(res.ok()).toBe(true);
});

test('sign-in shows the project logo, the name and the tab title', async ({
  page,
}) => {
  await page.goto('/sign-in');
  await expect(
    page.getByRole('heading', { name: `Sign in to ${NAME}` }),
  ).toBeVisible();
  await expectLoadedLogo(page);
  await expect(page).toHaveTitle(NAME);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    LOGO_URL,
  );

  await page.mouse.move(0, 0);
  await hideDevOverlay(page);
  await expect(page).toHaveScreenshot('branding-sign-in.png');
});

test('password reset shows the project logo', async ({ page }) => {
  await page.goto('/sign-in/reset');
  await expect(
    page.getByRole('heading', { name: 'Reset password' }),
  ).toBeVisible();
  await expectLoadedLogo(page);
  await expect(page).toHaveTitle(NAME);
});

test('the signed-in shell shows the project logo in the sidebar', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'persist:norbix-admin',
      JSON.stringify({
        auth: JSON.stringify({ token: 'e2e-token', userId: 'usr_e2e' }),
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      }),
    );
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Your account' }),
  ).toBeVisible();

  const brand = page.getByTestId('sidebar-brand');
  await expect(brand.getByRole('img', { name: NAME })).toBeVisible();
  await expectLoadedLogo(page);
  // The old hard-coded header is gone; "Account" stays only as the account menu.
  await expect(brand).not.toContainText('Account');
  await expect(page).toHaveTitle(NAME);

  await page.mouse.move(0, 0);
  await hideDevOverlay(page);
  await expect(page).toHaveScreenshot('branding-shell.png');
});
