import { defineConfig, devices } from '@playwright/test';
import { buildProtectedTargetHeaders } from './protectedTargetHeaders.mjs';

const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim();
if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL is required');

const protectedTarget = buildProtectedTargetHeaders(process.env, {
  requireCloudflareAccess: true,
});

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
    extraHTTPHeaders: protectedTarget.extraHTTPHeaders,
    trace: protectedTarget.hasProtectedTargetHeaders ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
