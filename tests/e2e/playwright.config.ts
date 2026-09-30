import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// webServer commands run from this folder unless told otherwise.
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Admin Portal chat smoke (item admin-chat, tracker step 27).
 *
 *   npm run test:e2e           # functional + pixel compare
 *   npm run test:e2e:update    # re-bless the golden PNGs
 *
 * Two servers: a fake API host / Hub (tests/e2e/fake-api-host.mjs) and the
 * portal (`next dev`) with HUB_BASE_URL / API_BASE_URL pointing at the fake,
 * so every browser call goes through the real BFF proxy. The project is
 * pinned (NEXT_PUBLIC_ADMIN_PROJECT_ID) — these env values win over .env.
 * Ports 3197 / 3198 are this suite's own, away from `npm run dev` (3100).
 */

const PORTAL_PORT = Number(process.env.E2E_PORTAL_PORT ?? 3197);
const FAKE_API_PORT = Number(process.env.FAKE_API_PORT ?? 3198);
const FAKE_API = `http://127.0.0.1:${FAKE_API_PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: /\.spec\.ts$/,
  outputDir: '../../test-results/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
    // Tight budget: a chat losing a block (the table, the toolbar) must fail.
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' },
  },
  reporter: [['list']],
  webServer: [
    {
      command: 'node tests/e2e/fake-api-host.mjs',
      cwd: REPO_ROOT,
      env: { FAKE_API_PORT: String(FAKE_API_PORT) },
      url: `${FAKE_API}/__state`,
      reuseExistingServer: false,
      timeout: 20_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx next dev -p ${PORTAL_PORT}`,
      cwd: REPO_ROOT,
      env: {
        NEXT_PUBLIC_ADMIN_PROJECT_ID: 'pr_e2e',
        NEXT_PUBLIC_ADMIN_CONFIG_MODE: 'dynamic',
        HUB_BASE_URL: FAKE_API,
        API_BASE_URL: FAKE_API,
        HUB_VERSION: 'v3',
        API_VERSION: 'v3',
        API_KEY: '',
        ENV: '',
      },
      url: `http://localhost:${PORTAL_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
  use: {
    baseURL: `http://localhost:${PORTAL_PORT}`,
    headless: process.env.HEADED ? false : true,
    actionTimeout: 12_000,
    navigationTimeout: 60_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    {
      name: 'chromium',
      // After the device preset, so the preset's 1280×720 does not win.
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 860 },
      },
    },
  ],
});
