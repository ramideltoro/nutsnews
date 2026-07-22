import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const protectedAdminRoutes = [
  '/admin',
  '/admin/readiness',
  '/admin/articles',
  '/admin/engagement',
  '/admin/ai-usage',
  '/admin/translations',
  '/admin/guardrails',
  '/admin/cache',
  '/admin/feature-flags',
  '/admin/edge-snapshot',
  '/admin/local-ai',
  '/admin/home-server',
  '/admin/failover',
  '/admin/shards',
  '/admin/feed-health',
  '/admin/feeds',
  '/admin/audit',
];

const forbiddenAdminDashboardPatterns = [
  /This page could not be found|NEXT_HTTP_ERROR_FALLBACK;404|404: This page could not be found/i,
  /Application error|Unhandled Runtime Error|Minified React error|Hydration failed because/i,
  /supabase_access_disabled_for_backend_primary|Server-side Supabase access is not configured|Missing SUPABASE_URL|Missing runtime public Supabase/i,
];

function isTransientNextStaticAsset(pathname: string) {
  return /^\/_next\/static\/(?:chunks|css)\//.test(pathname) && /\.(?:css|js)$/.test(pathname);
}

test('bounded private-staging navigation and accessibility smoke', async ({ page }) => {
  const fixtureNamespace = process.env.NUTSNEWS_QUALIFICATION_FIXTURE_NAMESPACE?.trim();
  expect(fixtureNamespace, 'A synthetic staging fixture namespace is required').toMatch(/^nutsnews-test-/);
  const baseOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL!).origin;
  const failures: string[] = [];
  const transientStaticAssetFailures: string[] = [];
  await page.setExtraHTTPHeaders({ 'Cache-Control': 'no-cache' });
  page.on('pageerror', (error) => failures.push(`page:${error.name}`));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (response.status() >= 500 && url.origin === baseOrigin) {
      const message = `response:${response.status()}:${url.pathname}`;
      if (response.status() === 502 && isTransientNextStaticAsset(url.pathname)) {
        transientStaticAssetFailures.push(message);
      } else {
        failures.push(message);
      }
    }
  });

  for (const route of [`/?qualification=${encodeURIComponent(fixtureNamespace!)}`, '/about', '/contact']) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), `${route} returned ${response?.status() ?? 'no response'}`).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
    expect(response?.headers()['x-robots-tag'] ?? '').toMatch(/noindex/i);
  }

  const articleResponse = await page.request.get(`/api/articles?page=0&lang=en&qualification=${encodeURIComponent(fixtureNamespace!)}`);
  expect(articleResponse.ok()).toBeTruthy();
  const articlePayload = (await articleResponse.json()) as { articles?: Array<{ id?: unknown; source?: unknown; title?: unknown; original_url?: unknown }> };
  const articleId = articlePayload.articles?.find((article) =>
    typeof article.id === 'string' && JSON.stringify({ source: article.source, title: article.title, originalUrl: article.original_url }).includes(fixtureNamespace!),
  )?.id;
  expect(articleId, 'The isolated staging read must return a seeded synthetic article ID').toBeTruthy();
  await page.goto(`/articles/${encodeURIComponent(articleId as string)}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible();

  if (process.env.NUTSNEWS_ADMIN_TEST_AUTH_BYPASS_EXPECTED === 'true') {
    for (const route of protectedAdminRoutes) {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      const status = response?.status() ?? 0;
      const finalPath = new URL(page.url()).pathname;

      expect(finalPath, `${route} should render without redirecting when admin bypass is expected`).toBe(route);
      expect(status, `${route} should not return a framework 404 or server error`).not.toBe(404);
      expect(status, `${route} should not return a server error`).toBeLessThan(500);
      await expect(page.locator('main')).toBeVisible({ timeout: 20000 });
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

      const bodyText = await page.locator('body').innerText({ timeout: 10000 });
      for (const pattern of forbiddenAdminDashboardPatterns) {
        expect(bodyText, `${route} rendered blocked admin smoke text ${pattern}`).not.toMatch(pattern);
      }
    }
  }

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const blocking = axe.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious');
  expect(blocking.map(({ id, impact }) => ({ id, impact }))).toEqual([]);
  expect(failures).toEqual([]);
  if (transientStaticAssetFailures.length > 0) {
    console.warn(`Observed transient Next static asset 502s during staging qualification:\n${[...new Set(transientStaticAssetFailures)].join('\n')}`);
  }
});
