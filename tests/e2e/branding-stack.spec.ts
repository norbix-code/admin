import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Page, expect, request, test } from '@playwright/test';
import { Developer, Json, env, must, project, publicConfig, rows, setAiChat, until } from './stack-lib';
import { EndUser, RUN, fillPortalSignIn, preparePortal, registerEndUser, waitForPortalToken } from './membership-stack-lib';

/**
 * Project name + logo reach the portal shell — against the real gateway in a
 * running stack (matrix section 21, row "Admin Portal — name + logo"; settings
 * coverage campaign 2026-11-18). The fake-host branding.spec.ts keeps the
 * shape check; this one proves the whole path:
 *
 *   developer, through the Hub (what Cloud → Project Settings → Brand sends):
 *     a Local files integration made the default → the logo uploaded through
 *     the Api (upload URL → PUT → commit → file info) → PATCH settings/logo →
 *     PATCH settings/name → "Show brand" on
 *   → GET /public/projects/{id}/config carries the name and the logo URL
 *   → the portal's sign-in page and its signed-in shell show that logo (it
 *     really loads) with the name as its text, and the browser tab title is
 *     the name.
 *
 * Goldens: `branding-stack-sign-in` (the whole sign-in page) and
 * `branding-stack-shell` (the shell's sidebar; the page itself shows the
 * end user's per-run email).
 *
 * The portal is pinned to the stack's `test` project, and a rename moves the
 * project's slug (gateway F8) that every Cloud spec opens. So `afterAll` (and
 * `beforeAll`, after a crashed run) puts the name back to `test`, removes the
 * logo and this spec's files integration, puts the previous files default and
 * the "Show brand" switch back, and checks the slug is `test` again.
 * The AI chat is switched off first, so its launcher is not in the pictures
 * (chat-stack.spec.ts turns it on again itself).
 *
 * Run: deployments/stack/stack.sh e2e-admin <item> tests/e2e/branding-stack.spec.ts   (gateway checkout)
 */

const NAME = 'Acme Portal';
const BASELINE_NAME = 'test';
const FILES_INTEGRATION = 'Admin brand assets (stack)';
const FILES_ROOT = 'admin-branding-e2e';
const LOGO_PATH = 'brand/logo/brand-logo.png';
const LOGO_BYTES = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'brand-logo.png'));

test.describe.configure({ mode: 'serial' });

let dev: Developer;
let user: EndUser;
let exposedBefore: boolean | undefined;
let filesDefaultBefore: string | undefined;

/** The project's files integrations (list projection) and the default's id. */
async function filesIntegrations(d: Developer): Promise<{ items: Json[]; defaultId?: string }> {
  const body = must(await d.hub('GET', '/files/integrations'), 'GET files integrations');
  return { items: ((body.list as Json | undefined)?.items as Json[]) ?? rows(body), defaultId: body.defaultIntegrationId as string | undefined };
}

/** Name `test`, no logo, no files integration of ours, the previous default and "Show brand" back. */
async function restore(d: Developer): Promise<void> {
  const p = await project(d);
  if (p.name !== BASELINE_NAME) {
    must(await d.hub('PATCH', `/account/projects/${d.projectId}/settings/name`, { name: BASELINE_NAME }), 'rename back to test');
  }
  if ((p.brand as Json | undefined)?.logo) {
    must(await d.hub('PATCH', `/account/projects/${d.projectId}/settings/logo`, {}), 'remove the logo');
  }
  const files = await filesIntegrations(d);
  const ours = files.items.filter((i) => i.integrationName === FILES_INTEGRATION);
  if (filesDefaultBefore && ours.some((i) => i.viewId === files.defaultId)) {
    must(await d.hub('PUT', `/files/integrations/${filesDefaultBefore}/default`, { id: filesDefaultBefore }), 'files default back');
  }
  for (const i of ours) {
    must(await d.hub('DELETE', `/files/integrations/${i.viewId}`, { id: String(i.viewId) }), 'delete our files integration');
  }
  if (exposedBefore === false) {
    must(await d.hub('PATCH', `/account/projects/${d.projectId}/settings/brand/expose`, { exposed: false }), 'Show brand back off');
  }
  await until('the project is `test` again, without a logo', async () => {
    const now = await project(d);
    return now.name === BASELINE_NAME && now.uniqueName === BASELINE_NAME && !(now.brand as Json | undefined)?.logo;
  });
}

/** The portal's three upload steps on the Api host, then the file reference. */
async function uploadLogo(d: Developer, integrationId: string): Promise<Json> {
  const common = { projectId: d.projectId, filesIntegrationId: integrationId, path: LOGO_PATH, contentType: 'image/png' };
  const signed = must(await d.api('POST', `/files/${integrationId}/upload-url`, common), 'upload URL');
  // The Local provider signs a link on the Api's configured address: send the
  // PUT to the Api this run reaches.
  const target = new URL(String(signed.url));
  const api = new URL(env.api);
  target.protocol = api.protocol;
  target.host = api.host;
  const anon = await request.newContext();
  try {
    const put = await anon.put(target.toString(), { data: LOGO_BYTES, headers: { 'Content-Type': 'image/png' } });
    expect(put.ok(), `PUT the logo: HTTP ${put.status()}`).toBe(true);
  } finally {
    await anon.dispose();
  }
  must(
    await d.api('POST', `/files/${integrationId}/commit`, { ...common, sizeBytes: LOGO_BYTES.length, fileName: 'brand-logo.png' }),
    'commit the logo',
  );
  const query = new URLSearchParams({ projectId: d.projectId, filesIntegrationId: integrationId, path: LOGO_PATH });
  const info = must(await d.api('GET', `/files/${integrationId}/info?${query}`), 'file info');
  expect(info.file, 'the committed file resolves to a file reference').toBeTruthy();
  return info.file as Json;
}

test.beforeAll(async () => {
  dev = await preparePortal();
  const before = await project(dev);
  exposedBefore = before.exposeBrandToAdminPortal as boolean | undefined;
  filesDefaultBefore = (await filesIntegrations(dev)).defaultId;
  if (filesDefaultBefore && (await filesIntegrations(dev)).items.some((i) => i.viewId === filesDefaultBefore && i.integrationName === FILES_INTEGRATION)) {
    filesDefaultBefore = undefined; // a leftover of a crashed run, not a real default
  }
  await restore(dev);
  // No chat launcher in the pictures.
  if (((await dev.hub('GET', `/account/projects/${dev.projectId}/ai/settings`)).json.result as Json | undefined)?.enabled) {
    await setAiChat(dev, false);
  }

  // Files on, a Local integration of ours as the default (uploads go to the default).
  if (!before.filesEnabled) {
    must(await dev.hub('PUT', '/files/enable', {}), 'enable Files');
    await until('Files on', async () => (await project(dev)).filesEnabled === true);
  }
  const created = must(
    await dev.hub('POST', '/files/integrations', {
      integration: { provider: 'Local', integrationName: FILES_INTEGRATION, isEnabled: true, rootPath: FILES_ROOT },
    }),
    'create the Local files integration',
  );
  const integrationId = String(created.id);
  await until('our files integration listed as enabled', async () =>
    (await filesIntegrations(dev)).items.some((i) => i.viewId === integrationId && i.isEnabled === true),
  );
  must(await dev.hub('PUT', `/files/integrations/${integrationId}/default`, { id: integrationId }), 'make it the default');
  await until('our files integration is the default', async () => (await filesIntegrations(dev)).defaultId === integrationId);

  // Brand: logo, name, "Show brand" on — what Cloud's Brand tab sends.
  const file = await uploadLogo(dev, integrationId);
  must(await dev.hub('PATCH', `/account/projects/${dev.projectId}/settings/logo`, { fileResource: file }), 'PATCH the logo');
  must(await dev.hub('PATCH', `/account/projects/${dev.projectId}/settings/name`, { name: NAME }), 'PATCH the name');
  must(await dev.hub('PATCH', `/account/projects/${dev.projectId}/settings/brand/expose`, { exposed: true }), 'Show brand on');
  await until('the public config carries the name and the logo', async () => {
    const cfg = await publicConfig(dev.ctx, dev.projectId);
    const branding = cfg.branding as Json | undefined;
    return cfg.displayName === NAME && branding?.displayName === NAME && !!branding?.logoUrl;
  });

  user = await registerEndUser(dev, `brand.${RUN}@example.test`, `Brand-${RUN}-2026!`);
});

test.afterAll(async () => {
  if (dev) await restore(dev);
});

// The `next dev` overlay badge is not part of the product (branding.spec.ts).
const hideDevOverlay = (page: Page) =>
  page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach((e) => e.remove()));

/** The brand logo with the project name as its text, and the bytes really loaded. */
async function expectLogo(page: Page, scope = page.locator('body')) {
  const logo = scope.getByRole('img', { name: NAME });
  await expect(logo).toBeVisible();
  const logoUrl = String(((await publicConfig(dev.ctx, dev.projectId)).branding as Json).logoUrl);
  await expect(logo).toHaveAttribute('src', logoUrl);
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth), { message: 'the logo did not load' }).toBe(200);
}

test('sign-in shows the project logo, "Sign in to <name>" and the name as the tab title', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: `Sign in to ${NAME}` })).toBeVisible();
  await expectLogo(page);
  await expect(page).toHaveTitle(NAME);

  await page.mouse.move(0, 0);
  await hideDevOverlay(page);
  await expect(page).toHaveScreenshot('branding-stack-sign-in.png', { animations: 'disabled', caret: 'hide' });
});

test('the signed-in shell shows the project logo in the sidebar and the name as the tab title', async ({ page }) => {
  await fillPortalSignIn(page, user.email, user.password);
  await waitForPortalToken(page);
  const brand = page.getByTestId('sidebar-brand');
  await expect(brand).toBeVisible();
  await expectLogo(page, brand);
  // "Account" stays only as the account menu, never as the brand.
  await expect(brand).not.toContainText('Account');
  await expect(page).toHaveTitle(NAME);
  // A reload keeps the brand (the config comes from the public endpoint again or its cache).
  await page.reload();
  await expectLogo(page, page.getByTestId('sidebar-brand'));

  await page.mouse.move(0, 0);
  await hideDevOverlay(page);
  await expect(page.locator('aside')).toHaveScreenshot('branding-stack-shell.png', { animations: 'disabled', caret: 'hide' });
});
