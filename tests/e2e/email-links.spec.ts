import { expect, test } from '@playwright/test';

/**
 * The public pages behind the footer links of a sent email, against the fake
 * Norbix (fake-api-host.mjs). No sign-in: the signed `hash` is the key.
 * Opening the unsubscribe page changes nothing; the button does. A bad link
 * shows the gateway's refusal. The pages show the project's name.
 */

const FAKE_API = `http://127.0.0.1:${process.env.FAKE_API_PORT ?? 3198}`;

const state = async (
  request: import('@playwright/test').APIRequestContext,
): Promise<{ emailLinkTokens: string[]; unsubscribed: boolean }> =>
  (await request.get(`${FAKE_API}/__state`)).json();

test.beforeEach(async ({ page }) => {
  const res = await page.request.post(`${FAKE_API}/__reset`, { data: {} });
  expect(res.ok()).toBe(true);
});

test('unsubscribe: opening changes nothing, the button unsubscribes', async ({
  page,
}) => {
  await page.goto('/notifications/email-unsubscribe?hash=good-key');
  await expect(
    page.getByText('ana@example.com receives marketing emails.'),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: 'E2E Shop' })).toBeVisible();
  expect((await state(page.request)).unsubscribed).toBe(false);

  await page
    .getByRole('button', { name: 'Unsubscribe from all marketing emails' })
    .click();
  await expect(
    page.getByText('You have been unsubscribed from marketing emails.'),
  ).toBeVisible();
  await expect(
    page.getByText('ana@example.com is unsubscribed from marketing emails.'),
  ).toBeVisible();
  expect((await state(page.request)).unsubscribed).toBe(true);
});

test('preferences: a made-up link shows the refusal', async ({ page }) => {
  await page.goto('/notifications/preferences?hash=made-up');
  await expect(page.getByText('This link is not valid.')).toBeVisible();
  expect((await state(page.request)).emailLinkTokens).toContain('made-up');
});

test('view in web: subject as text, body in a sandboxed frame; expired link says so', async ({
  page,
}) => {
  await page.goto('/notifications/emails/preview?hash=good-key');
  await expect(page.getByText('Subject: Your order shipped')).toBeVisible();
  const frame = page.frameLocator('iframe[title="Email"]');
  await expect(frame.getByRole('heading', { name: 'Order #42' })).toBeVisible();
  await expect(page.locator('iframe[title="Email"]')).toHaveAttribute(
    'sandbox',
    'allow-popups allow-popups-to-escape-sandbox',
  );

  await page.goto('/notifications/emails/preview?hash=old');
  await expect(
    page.getByText(
      'This preview link has expired. Ask the sender for a new email.',
    ),
  ).toBeVisible();
});
