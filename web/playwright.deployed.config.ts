import { defineConfig, devices } from '@playwright/test';
import { buildProtectedTargetHeaders } from './protectedTargetHeaders.mjs';

const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL is required for deployed UI smoke tests');

const protectedTarget = buildProtectedTargetHeaders(process.env, {
  defaultVercelSetBypassCookie: true,
});

export default defineConfig({
  testDir: './tests',
  testMatch: /deployed-ui-smoke\.spec\.ts/,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results/deployed-ui-smoke',
  use: {
    baseURL,
    trace: protectedTarget.hasProtectedTargetHeaders ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(protectedTarget.extraHTTPHeaders ? { extraHTTPHeaders: protectedTarget.extraHTTPHeaders } : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
