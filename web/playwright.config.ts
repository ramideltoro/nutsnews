import { defineConfig, devices } from '@playwright/test';
import { buildProtectedTargetHeaders } from './protectedTargetHeaders.mjs';

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const configuredBaseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
const baseURL = configuredBaseURL || `http://127.0.0.1:${PORT}`;
const shouldStartLocalWebServer = !configuredBaseURL;
const protectedTarget = buildProtectedTargetHeaders(process.env, {
  defaultVercelSetBypassCookie: true,
});

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
