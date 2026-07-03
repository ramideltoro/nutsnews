import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const configuredBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = configuredBaseURL || `http://127.0.0.1:${PORT}`;
const shouldStartLocalWebServer = !configuredBaseURL;
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
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
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
  ...(shouldStartLocalWebServer
    ? {
        webServer: {
          command: `npm run start -- -p ${PORT}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
