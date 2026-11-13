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
  waitForPortalToken,
} from './membership-stack-lib';

/**
 * Security → Change password against the real gateway (admin#19, owner round).
 *
 * The change ends the session it was made with (`cm_cv`), so the portal signs
 * in again with the new password and stays on Security. Proven here: the
 * next page load is still signed in on a NEW token, the old token is refused
 * (401 CM-ERRORS-MEMBERSHIP-USERS-050), and the old password no longer signs
 * in — neither on the Api host nor in the portal.
 */

test.describe.configure({ mode: 'serial' });

let dev: Developer;
let user: EndUser;

test.beforeAll(async () => {
  dev = await preparePortal();
  user = await registerEndUser(dev, `security.${RUN}@example.test`, 'First-pass-2026');
});

test('change the password on Security: still signed in after a reload; the old password and the old token fail', async ({ page }) => {
  await fillPortalSignIn(page, user.email, user.password);
  const oldToken = await waitForPortalToken(page);

  await page.goto('/security');
  await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();

  const newPassword = 'Second-pass-2026';
  await page.getByLabel('Current password').fill(user.password);
  await page.getByLabel('New password').fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();

  // Re-signed in with the new password, still on Security, with the note.
  const newToken = await waitForPortalToken(page, oldToken);
  await expect(page.getByText('Password changed.')).toBeVisible();
  await expect(page).toHaveURL(/\/security$/);

  // The next page load is still signed in, on the new session.
  await page.reload();
  await expect(page).toHaveURL(/\/security$/);
  await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
  await expect(page.locator('input[name="userName"]')).toHaveCount(0);
  expect((await portalAuth(page)).token).toBe(newToken);

  // The gateway: the old token is refused, the new one reads the own record.
  const withOld = await apiCall('GET', `/membership/auth/${user.id}`, undefined, { authorization: `Bearer ${oldToken}` });
  const withNew = await apiCall('GET', `/membership/auth/${user.id}`, undefined, { authorization: `Bearer ${newToken}` });
  expect({ old: withOld.status, oldCode: errorCodeOf(withOld), new: withNew.status }).toEqual({
    old: 401,
    oldCode: 'CM-ERRORS-MEMBERSHIP-USERS-050',
    new: 200,
  });

  // The old password no longer signs in; the new one does.
  expect((await apiSignIn(user.email, user.password)).status).toBe(401);
  expect((await apiSignIn(user.email, newPassword)).status).toBe(200);
});

test('signing in to the portal with the old password fails', async ({ page }) => {
  await fillPortalSignIn(page, user.email, user.password);
  // The form stays, no session is stored.
  await expect(page.getByText('Invalid credentials.')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  expect((await portalAuth(page)).token ?? null).toBeNull();
});
