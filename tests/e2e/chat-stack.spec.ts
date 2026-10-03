import { expect, Page, test } from '@playwright/test';
import {
  Developer,
  Prepared,
  endUser,
  prepareProject,
  publicConfig,
  setAiChat,
  signInDeveloper,
  usage,
} from './stack-lib';

/**
 * The wave-3 acceptance, end to end against a running stack (item
 * stack-admin-portal, tracker step 29p): the real Hub and Api, the portal's
 * real BFF proxy, and the stack's fake LLM (deployments/stack/fake-llm).
 *
 *   1. as the developer, through REST: LLM integration → fake LLM, assistant
 *      "Support" (own:records + own:profile), "Show AI chat" on, a service user
 *      with the Admin Portal Manager role assigned, the portal on, an end user;
 *   2. the end user signs in to the portal → the launcher shows → asks
 *      "what is my profile?" → the answer streams in with that user's name and
 *      email → like → the session list;
 *   3. the developer's usage shows tokens under that user and the assistant;
 *   4. "Show AI chat" off → the launcher is gone; the portal itself stays on.
 *
 * No goldens here: the frame carries a real name, an email and a session
 * title. The fake-host chat.spec.ts keeps the pixel compare.
 */

test.describe.configure({ mode: 'serial' });

let dev: Developer;
let prepared: Prepared;

test.beforeAll(async () => {
  dev = await signInDeveloper();
  prepared = await prepareProject(dev);
});

test.afterAll(async () => {
  // leave the project the way a rerun expects it: chat on
  if (dev) await setAiChat(dev, true, prepared?.llmIntegrationId);
});

/** The portal's own sign-in form (email + password through the BFF proxy). */
const signInPortal = async (page: Page) => {
  await page.goto('/');
  await page.locator('input[name="userName"]').fill(endUser.email);
  await page.locator('input[name="password"]').fill(endUser.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // signed in = the login form is gone and the app shell renders
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
};

const openDrawer = async (page: Page) => {
  await page.getByRole('button', { name: 'Ask the assistant' }).click();
  return page.getByRole('region', { name: 'Assistant chat' });
};

test('an end user signs in, asks about the profile, and the answer streams in', async ({ page }) => {
  await signInPortal(page);

  const drawer = await openDrawer(page);
  await expect(drawer.getByText('Hi! Ask me about your account.')).toBeVisible();

  await drawer.getByRole('textbox', { name: 'Message' }).fill('what is my profile?');
  await drawer.getByRole('button', { name: 'Send' }).click();

  await expect(drawer.locator('[data-entry-kind="user.message"]')).toHaveText(/what is my profile\?/);
  await expect(drawer.getByTestId('chat-streaming')).toBeVisible({ timeout: 60_000 });
  const reply = drawer.locator('[data-entry-kind="assistant.text"]');
  // the fake LLM answers from the profile tool's result: this user's name and email
  await expect(reply).toContainText(endUser.displayName, { timeout: 60_000 });
  await expect(reply).toContainText(endUser.email);
  await expect(drawer.getByTestId('chat-streaming')).toHaveCount(0, { timeout: 60_000 });
  await expect(reply).toHaveCount(1);

  // like → PUT …/feedback 'up' on the stored reply
  await reply.hover();
  const like = reply.getByRole('button', { name: 'Like', exact: true });
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');

  // the full screen lists the chat the turn opened
  await drawer.getByRole('button', { name: 'Expand to full screen' }).click();
  const full = page.getByRole('region', { name: 'Assistant chat' });
  await expect(full.getByTestId('chat-session-row')).toHaveCount(1);
  await expect(full.locator('[data-entry-kind="assistant.text"]')).toContainText(endUser.email);
});

test('the developer sees the tokens under that user and the Support assistant', async () => {
  const seen = await expect
    .poll(
      async () => {
        const u = await usage(dev);
        const byUser = ((u.topUsers as Record<string, unknown>[]) ?? []).find((x) => x.id === prepared.endUserId);
        const byAssistant = ((u.assistants as Record<string, unknown>[]) ?? []).find((x) => x.id === prepared.assistantId);
        return {
          userHasTokens: Number(byUser?.totalTokens ?? 0) > 0,
          assistantHasTokens: Number(byAssistant?.totalTokens ?? 0) > 0,
          totalHasTokens: Number((u.totals as Record<string, unknown> | undefined)?.totalTokens ?? 0) > 0,
        };
      },
      { timeout: 60_000, message: 'GET /account/projects/{id}/ai/usage shows the turn' },
    )
    .toEqual({ userHasTokens: true, assistantHasTokens: true, totalHasTokens: true });
  void seen;
});

test('"Show AI chat" off → the launcher is gone; the portal itself stays enabled', async ({ page }) => {
  await setAiChat(dev, false, prepared.llmIntegrationId);

  const cfg = await publicConfig(dev.ctx, prepared.projectId);
  expect({
    adminPortalEnabled: cfg.adminPortalEnabled,
    aiChatEnabled: (cfg.aiChat as Record<string, unknown>).enabled,
  }).toEqual({ adminPortalEnabled: true, aiChatEnabled: false });

  await signInPortal(page);
  // the shell is up (a signed-in page), and no launcher anywhere on it
  await expect(page.getByRole('main').or(page.getByRole('navigation')).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask the assistant' })).toHaveCount(0);
});
