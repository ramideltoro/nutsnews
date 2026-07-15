import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('bounded private-staging navigation and accessibility smoke', async ({ page }) => {
  const fixtureNamespace = process.env.NUTSNEWS_QUALIFICATION_FIXTURE_NAMESPACE?.trim();
  expect(fixtureNamespace, 'A synthetic staging fixture namespace is required').toMatch(/^nutsnews-test-/);
  const baseOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL!).origin;
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(`page:${error.name}`));
  page.on('response', (response) => {
    if (response.status() >= 500 && new URL(response.url()).origin === baseOrigin) {
      failures.push(`response:${response.status()}:${new URL(response.url()).pathname}`);
    }
  });

  for (const route of ['/', '/about', '/contact']) {
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

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const blocking = axe.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious');
  expect(blocking.map(({ id, impact }) => ({ id, impact }))).toEqual([]);
  expect(failures).toEqual([]);
});
