import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL is required');

const clientId = process.env.CF_ACCESS_CLIENT_ID?.trim();
const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET?.trim();
if (!clientId || !clientSecret) throw new Error('Cloudflare Access service-token inputs are required');

export default defineConfig({
  testDir: './tests',
  testMatch: /staging-qualification\.spec\.ts/,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [
    ['line'],
    ['junit', { outputFile: 'test-results/staging-qualification-playwright/results.junit.xml' }],
  ],
  outputDir: 'test-results/staging-qualification-playwright/artifacts',
  use: {
    baseURL,
    extraHTTPHeaders: {
      'CF-Access-Client-Id': clientId,
      'CF-Access-Client-Secret': clientSecret,
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
