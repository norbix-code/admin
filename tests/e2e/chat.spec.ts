import { expect, Page, test } from '@playwright/test';

/**
 * End-user AI chat smoke (item admin-chat): sign-in state is seeded, the
 * public config turns the chat on, a turn is sent and its answer STREAMS in
 * through the BFF proxy from the fake API host (fake-api-host.mjs).
 *
 * Goldens: the drawer with the streamed answer, and the full screen with the
 * session list — both after a green functional run in the same test.
 */

// The `next dev` overlay badge is not part of the product — keep it out of
// goldens. Its shadow root wins any page CSS, so the element is removed.
const hideDevOverlay = (page: Page) =>
  page.evaluate(() =>
    document.querySelectorAll('nextjs-portal').forEach((e) => e.remove()),
  );

const FAKE_API = `http://127.0.0.1:${process.env.FAKE_API_PORT ?? 3198}`;

const resetFake = async (page: Page, opts: { refuseStream?: boolean } = {}) => {
  const res = await page.request.post(`${FAKE_API}/__reset`, { data: opts });
  expect(res.ok()).toBe(true);
};

const fakeState = async (page: Page) =>
  (await (await page.request.get(`${FAKE_API}/__state`)).json()) as {
    feedback: { entryId: string; feedback: string }[];
    streamRequests: number;
    badRequests: unknown[];
  };

/** A signed-in end user: the persisted auth slice redux-persist restores. */
const signIn = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'persist:norbix-admin',
      JSON.stringify({
        auth: JSON.stringify({ token: 'e2e-token', userId: 'usr_e2e' }),
        _persist: JSON.stringify({ version: -1, rehydrated: true }),
      }),
    );
  });
};

const openDrawer = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask the assistant' }).click();
  return page.getByRole('region', { name: 'Assistant chat' });
};

test.beforeEach(async ({ page }) => {
  await resetFake(page);
  await signIn(page);
});

test('the drawer sends a turn and the answer streams in', async ({ page }) => {
  const drawer = await openDrawer(page);

  // Welcome of the default assistant; two assistants → the picker shows.
  await expect(drawer.getByText('Hi! Ask me about your orders.')).toBeVisible();
  await expect(drawer.getByRole('combobox', { name: 'Assistant' })).toHaveValue(
    'ast_support',
  );

  await drawer
    .getByRole('textbox', { name: 'Message' })
    .fill('Where is my last order?');
  await drawer.getByRole('button', { name: 'Send' }).click();

  // The user's message shows at once; the reply streams (cursor visible,
  // text growing) and ends with the table rendered by the output factory.
  await expect(drawer.locator('[data-entry-kind="user.message"]')).toHaveText(
    /Where is my last order\?/,
  );
  await expect(drawer.getByTestId('chat-streaming')).toBeVisible();
  const reply = drawer.locator('[data-entry-kind="assistant.text"]');
  await expect(reply).toContainText('Your last order');
  await expect(drawer.getByTestId('chat-streaming')).toHaveCount(0);
  await expect(reply.locator('table tbody tr')).toHaveCount(2);
  await expect(reply.locator('th')).toHaveText(['item', 'qty', 'price']);
  await expect(reply.locator('li')).toHaveText([
    'Order: #42',
    'Status: left the warehouse today',
  ]);
  // Exactly one reply — no doubled text from the stream + the entries read.
  await expect(reply).toHaveCount(1);
  await expect(reply.getByText('Your last order')).toHaveCount(1);

  // The chat title comes from the session the turn opened.
  await expect(drawer.getByRole('heading', { level: 2 })).toHaveText(
    'Order status',
  );

  // Like → PUT …/feedback 'up' on the reply.
  await reply.hover();
  // `exact`: a role name matches substrings, and "Dislike" contains "like".
  const like = reply.getByRole('button', { name: 'Like', exact: true });
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => (await fakeState(page)).feedback)
    .toEqual([{ entryId: 'ent_2', feedback: 'up' }]);

  // Every chat call carried the project + token (the proxy forwarded them).
  expect((await fakeState(page)).badRequests).toEqual([]);

  await page.mouse.move(0, 0);
  await hideDevOverlay(page);
  await expect(drawer).toHaveScreenshot('chat-drawer-streamed-answer.png');
});

test('full screen lists the chat; memory panel shows what is remembered', async ({
  page,
}) => {
  const drawer = await openDrawer(page);
  await drawer
    .getByRole('textbox', { name: 'Message' })
    .fill('Where is my last order?');
  await drawer.getByRole('button', { name: 'Send' }).click();
  await expect(drawer.getByTestId('chat-streaming')).toBeVisible();
  await expect(drawer.getByTestId('chat-streaming')).toHaveCount(0);

  await drawer.getByRole('button', { name: 'Expand to full screen' }).click();
  const full = page.getByRole('region', { name: 'Assistant chat' });
  const rows = full.getByTestId('chat-session-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole('button').first()).toHaveText(
    'Order status',
  );
  await expect(full.locator('table tbody tr')).toHaveCount(2);

  await page.mouse.move(0, 0);
  await hideDevOverlay(page);
  await expect(full).toHaveScreenshot('chat-fullscreen.png');

  await full
    .getByRole('button', { name: 'What the assistant remembers' })
    .click();
  await expect(full.getByText('Prefers delivery to the office.')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Expand to full screen' }),
  ).toBeVisible();
});

test('a refused stream (403) stops at once and says chat unavailable', async ({
  page,
}) => {
  await resetFake(page, { refuseStream: true });
  const drawer = await openDrawer(page);
  await drawer.getByRole('textbox', { name: 'Message' }).fill('hello');
  await drawer.getByRole('button', { name: 'Send' }).click();

  await expect(drawer.getByRole('alert')).toHaveText(
    'Chat unavailable. Reload the page to try again.',
  );
  // No reconnect loop: one stream request, and still one a while later.
  await page.waitForTimeout(3000);
  expect((await fakeState(page)).streamRequests).toBe(1);
  await expect(drawer.getByRole('textbox', { name: 'Message' })).toBeDisabled();
});
