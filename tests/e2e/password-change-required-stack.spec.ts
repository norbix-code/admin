import { expect, test } from '@playwright/test';
import {
  Developer,
  EndUser,
  RUN,
  apiCall,
  apiSignIn,
  errorCodeOf,
  fillPortalSignIn,
  portalAuth,
  preparePortal,
  registerEndUser,
  setMinLength,
  waitForPortalToken,
} from './membership-stack-lib';

/**
 * passwordChangeRequired against the real gateway (owner round step 5, admin#19).
 *
 * The project gets a stored password rule of MinLength 10 AFTER a user set an
 * 8-character password under the default rule (6). Their next sign-in
 * succeeds and says `meta.passwordChangeRequired: "true"`; the portal shows
 * the change-password step with the reason, the user picks a 12-character
 * password, the portal signs in again with it and lands home. The token from
 * the first sign-in is refused afterwards (401 CM-ERRORS-MEMBERSHIP-USERS-050).
 * A user whose password already meets the rule goes straight home.
 */

test.describe.configure({ mode: 'serial' });

const REASON = "Your password does not meet the project's password rules any more. Please choose a new one.";

let dev: Developer;
let shortUser: EndUser;
let longUser: EndUser;

test.beforeAll(async () => {
  dev = await preparePortal();
  // The default rule (6) first, so the 8-character password is accepted at
  // registration — a rerun meets the 10 the previous run left if afterAll did not run.
  await setMinLength(dev, 6);
  shortUser = await registerEndUser(dev, `short.${RUN}@example.test`, 'Ab3-de6!');
  longUser = await registerEndUser(dev, `long.${RUN}@example.test`, 'Long-pass-2026!');
  await setMinLength(dev, 10);
  // The gateway reads the rule from the project read model: wait until a sign-in says so.
  await expect
    .poll(async () => (((await apiSignIn(shortUser.email, shortUser.password)).json.meta ?? {}) as Record<string, string>).passwordChangeRequired, {
      message: 'the 8-character sign-in says passwordChangeRequired under MinLength 10',
      timeout: 45_000,
    })
    .toBe('true');
});

test.afterAll(async () => {
  // Leave the project on the default rule for the other specs and a rerun.
  if (dev) await setMinLength(dev, 6);
});

test('a password below the rule: sign-in → change-password step → new password → signed in again → home; the old token is refused', async ({ page }) => {
  expect(shortUser.password).toHaveLength(8);

  await fillPortalSignIn(page, shortUser.email, shortUser.password);

  // The step, with the reason.
  await expect(page).toHaveURL(/\/security\/password$/);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await expect(page.getByText(REASON)).toBeVisible();
  // The hint shows the PUBLIC config's rule: with "expose auth to the portal"
  // off (the default) that is the portal default 6, not the stored 10 — a
  // finding in the proof report, not asserted here.
  await expect(page.getByText(/^At least \d+ characters\.$/)).toBeVisible();

  // The session of the first sign-in (the one the change ends).
  const oldToken = await waitForPortalToken(page);

  const newPassword = 'NewPass-2026';
  expect(newPassword).toHaveLength(12);
  await page.getByLabel('Current password').fill(shortUser.password);
  await page.getByLabel('New password').fill(newPassword);
  await page.getByRole('button', { name: 'Save new password' }).click();

  // Signed in again with the new password, on the landing page.
  const newToken = await waitForPortalToken(page, oldToken);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toHaveCount(0);
  expect((await portalAuth(page)).loginName).toBe(shortUser.email);

  // The old token is refused; the new one reads the user's own record.
  const withOld = await apiCall('GET', `/membership/auth/${shortUser.id}`, undefined, { authorization: `Bearer ${oldToken}` });
  const withNew = await apiCall('GET', `/membership/auth/${shortUser.id}`, undefined, { authorization: `Bearer ${newToken}` });
  expect({ old: withOld.status, oldCode: errorCodeOf(withOld), new: withNew.status }).toEqual({
    old: 401,
    oldCode: 'CM-ERRORS-MEMBERSHIP-USERS-050',
    new: 200,
  });

  // The new password meets the rule: no flag any more; the old password no longer signs in.
  const again = await apiSignIn(shortUser.email, newPassword);
  expect((again.json.meta as Record<string, string> | undefined)?.passwordChangeRequired).toBeUndefined();
  expect((await apiSignIn(shortUser.email, shortUser.password)).status).toBe(401);
});

test('a password that meets the rule goes straight home, with no step', async ({ page }) => {
  const answer = await apiSignIn(longUser.email, longUser.password);
  expect((answer.json.meta as Record<string, string> | undefined)?.passwordChangeRequired).toBeUndefined();

  await fillPortalSignIn(page, longUser.email, longUser.password);
  await waitForPortalToken(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('input[name="password"]')).toHaveCount(0);
  await expect(page.getByText(REASON)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toHaveCount(0);
});
