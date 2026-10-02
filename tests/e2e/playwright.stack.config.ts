import { defineConfig, devices } from '@playwright/test';

/**
 * Admin Portal against a RUNNING Docker stack (item stack-admin-portal,
 * tracker step 29p) — the real Hub, Api and a fake LLM, no fake API host.
 *
 *   gateway$ deployments/stack/stack.sh up <item>
 *   gateway$ deployments/stack/stack.sh e2e-admin <item> tests/e2e/chat-stack.spec.ts
 *
 * No webServer: the portal is already served by the stack. The stack passes
 * E2E_BASE_URL (http://admin.<item>.norbix.test), E2E_HUB_URL / E2E_API_URL /
 * E2E_LLM_URL (in-network), E2E_USER / E2E_PASS (the stack's throwaway
 * developer login) and E2E_PROJECT_ID (the stack's `test` project). On the
 * Mac the same config works against your own hosts:
 *
 *   E2E_BASE_URL=http://localhost:3100 E2E_HUB_URL=http://localhost:5001/v3 \
 *   E2E_API_URL=http://localhost:5002/v3 E2E_LLM_URL=http://… E2E_USER=… \
 *   E2E_PASS=… E2E_PROJECT_ID=pr_… npm run test:e2e:stack
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3100';

export default defineConfig({
  testDir: '.',
  testMatch: /chat-stack\.spec\.ts$/,
  outputDir: '../../test-results/e2e-stack',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // The set-up runs a dozen REST calls and waits for projections; the turn
  // itself streams through a real queue. Generous on purpose.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    headless: process.env.HEADED ? false : true,
    actionTimeout: 15_000,
    navigationTimeout: 90_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 860 },
      },
    },
  ],
});
