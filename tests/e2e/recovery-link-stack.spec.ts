import { expect, test } from '@playwright/test';
import {
  Developer,
  EndUser,
  Json,
  RUN,
  allBrowserStorage,
  apiCall,
  portalAuth,
  preparePortal,
  registerEndUser,
} from './membership-stack-lib';
import { env, must, project, rows, until } from './stack-lib';

/**
 * The passkey recovery link (magic link) against the real gateway (admin
 * 717cebd, gateway Hub.Membership.Mq/Passkey.cs `Any(MagicLinkRequested)`).
 *
 *   1. as the developer, through REST: Email module on (its seeded Fake
 *      "Test Me" integration is the default — no real mail leaves the stack),
 *      Allow magic-link recovery on (POST /membership/passkey/settings, a full
 *      replace: read first), an end user;
 *   2. the link is requested on the Api host
 *      (POST /membership/userauth/recovery/magic-link/request);
 *   3. the e-mail is read where the Fake integration records transactional
 *      mail: GET /notifications/emails/campaigns/{transactional campaign}/
 *      messages?campaignBatchId={transactional batch} on the Hub
 *      (FakeTransactionalEmailLog, SendTransactionalEmailCommand.cs);
 *   4. the link `{portal}/oauth/callback#token=…` opens in the portal →
 *      Security with the recovery banner; the link token is in no storage;
 *   5. the same link again → refused (CM-ERRORS-PASSKEY-016, the portal's
 *      "expired or was already used" sentence).
 *
 * The user is a password user: the gateway looks the address up by e-mail
 * (ProjectPasskeyUserStore.LookupByEmailInEnvAsync) and needs no passkey; a
 * passkey sign-up needs a WebAuthn ceremony this spec does not run.
 */

test.describe.configure({ mode: 'serial' });

// FakeTransactionalEmailLog.CampaignViewId / BatchViewId (gateway).
const TRANSACTIONAL_CAMPAIGN = 'cmp_1szWVIyZFBVQfs8YKvWBC';
const TRANSACTIONAL_BATCH = 'cmpb_3lz30bx8TdXmzgIupiG7i';

const BANNER = /You signed in with a recovery link\. Add a new passkey below/;
const USED = 'This recovery link has expired or was already used. Please ask for a new one.';

let dev: Developer;
let user: EndUser;
let mailedLink = '';

/** Email module on; the default integration must be the Fake one. */
async function ensureFakeEmail(dev: Developer): Promise<void> {
  if ((await project(dev)).emailEnabled !== true) {
    must(await dev.hub('PUT', '/notifications/email/enable', {}), 'EnableEmail');
  }
  const list = await until('the seeded Fake email integration as the default', async () => {
    const r = must(await dev.hub('GET', '/notifications/email/integrations'), 'GET email integrations');
    const fake = rows(r).find((i) => i.emailProvider === 'Fake');
    return fake && r.defaultIntegrationId === fake.viewId ? r : null;
  });
  expect(rows(list).filter((i) => i.isEnabled === true).map((i) => i.emailProvider)).toEqual(['Fake']);
}

/** Allow magic-link recovery on (read first: the save replaces every passkey setting). */
async function ensureMagicLinkRecovery(dev: Developer): Promise<void> {
  const read = async () => (must(await dev.hub('GET', '/membership/passkey/settings'), 'GET passkey settings').result as Json) ?? {};
  const current = await read();
  if (current.allowMagicLinkRecovery === true) return;
  must(await dev.hub('POST', '/membership/passkey/settings', { ...current, allowMagicLinkRecovery: true }), 'SavePasskeySettings');
  await until('allowMagicLinkRecovery on', async () => (await read()).allowMagicLinkRecovery === true);
}

/** The recovery mail the Fake integration recorded for `email`. */
async function recordedMail(dev: Developer, email: string): Promise<Json> {
  return until(
    `the magic-link e-mail to ${email} in the Fake integration's log`,
    async () => {
      const r = await dev.hub('GET', `/notifications/emails/campaigns/${TRANSACTIONAL_CAMPAIGN}/messages?campaignBatchId=${TRANSACTIONAL_BATCH}`);
      return ((r.json.list as Json | undefined)?.items as Json[] | undefined)?.find(
        (m) => m.transactionalKind === 'PasskeyMagicLink' && JSON.stringify(m.recipients ?? '').includes(email),
      );
    },
    60_000,
  );
}

test.beforeAll(async () => {
  dev = await preparePortal();
  await ensureFakeEmail(dev);
  await ensureMagicLinkRecovery(dev);
  user = await registerEndUser(dev, `recovery.${RUN}@example.test`, 'Recover-pass-2026');
});

test('the recovery e-mail is sent through the Fake integration and links to the portal callback', async () => {
  const requested = await apiCall('POST', '/membership/userauth/recovery/magic-link/request', { email: user.email });
  expect(requested.status).toBe(200);

  const mail = await recordedMail(dev, user.email);
  const href = /href="([^"]+)"/.exec(String(mail.body ?? ''))?.[1] ?? '';
  const link = new URL(href.replace(/&amp;/g, '&'));

  // MembershipPortalLinks.MagicLink: {portal base}/oauth/callback#token=<one-time token>.
  // On the stack the base is the project's own hosted portal (canonicalAdminUrl), not the
  // stack's admin host — see the proof report; the spec opens the same path and fragment there.
  const canonical = new URL(String((await project(dev)).canonicalAdminUrl));
  expect({
    subject: mail.subject,
    origin: link.origin,
    path: link.pathname,
    query: link.search,
    tokenInFragment: /^#token=[A-Za-z0-9_-]{20,}$/.test(link.hash),
  }).toEqual({
    subject: expect.stringContaining('Your sign-in link'),
    origin: canonical.origin,
    path: '/oauth/callback',
    query: '',
    tokenInFragment: true,
  });
  mailedLink = `${env.base}${link.pathname}${link.hash}`;
});

test('the link signs in to Security with the recovery banner; the link token is in no storage', async ({ page }) => {
  expect(mailedLink, 'the previous test read the link').not.toBe('');
  const token = decodeURIComponent(new URL(mailedLink).hash.replace(/^#token=/, ''));

  const consumed = page.waitForResponse((r) => r.url().includes('/membership/userauth/recovery/magic-link/consume'));
  await page.goto(mailedLink);
  const answer = await consumed;
  expect({ status: answer.status(), sentAuthorization: Boolean(answer.request().headers().authorization) }).toEqual({
    status: 200,
    sentAuthorization: false,
  });

  await expect(page).toHaveURL(/\/security$/);
  await expect(page.getByText(BANNER)).toBeVisible();
  // The fragment is gone from the address bar …
  expect(new URL(page.url()).hash).toBe('');
  // … and the link token is nowhere in the browser's storage; the recovery session is.
  expect((await allBrowserStorage(page)).includes(token)).toBe(false);
  const auth = await portalAuth(page);
  expect({ hasSession: typeof auth.token === 'string' && auth.token !== token, recovery: auth.recovery }).toEqual({
    hasSession: true,
    recovery: true,
  });
});

test('the same link again is refused (CM-ERRORS-PASSKEY-016)', async ({ browser }) => {
  expect(mailedLink, 'the first test read the link').not.toBe('');
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const consumed = page.waitForResponse((r) => r.url().includes('/membership/userauth/recovery/magic-link/consume'));
    await page.goto(mailedLink);
    const answer = await consumed;
    const body = (await answer.json().catch(() => ({}))) as Json;
    const code = (((body.responseStatus as Json | undefined)?.errors as Json[] | undefined)?.[0] as Json | undefined)?.errorCode;
    expect({ status: answer.status(), code }).toEqual({ status: 400, code: 'CM-ERRORS-PASSKEY-016' });

    await expect(page.getByText(USED)).toBeVisible();
    expect((await portalAuth(page)).token ?? null).toBeNull();
  } finally {
    await context.close();
  }
});
