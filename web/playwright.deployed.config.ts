import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL is required for deployed UI smoke tests');

const vercelAutomationBypassSecret =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ||
  process.env.VERCEL_PROTECTION_BYPASS_SECRET?.trim() ||
  '';
const extraHTTPHeaders = vercelAutomationBypassSecret
  ? {
      'x-vercel-protection-bypass': vercelAutomationBypassSecret,
      'x-vercel-set-bypass-cookie': 'true',
    }
  : undefined;

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
    trace: vercelAutomationBypassSecret ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(extraHTTPHeaders ? { extraHTTPHeaders } : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
