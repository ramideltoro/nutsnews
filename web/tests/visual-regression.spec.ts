import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const LANGUAGE_STORAGE_KEY = 'nutsnews.web.language';
const THEME_STORAGE_KEY = 'nutsnews.web.theme';
const FIRST_ARTICLE_ID = 'public-smoke-article-01';
const FIRST_ARTICLE_TITLE = 'Public smoke readers celebrate neighborhood gardens';

const stableSearchResults = [
  {
    id: 'visual-search-result-01',
    source: 'NutsNews Visual Search',
    title: 'Visual readers find a community garden guide',
    original_url: 'https://mock.nutsnews.test/visual/search/community-garden',
    image_url: 'https://mock.nutsnews.test/images/visual-search-01.png',
    published_at: '2026-06-28T12:00:00.000Z',
    published_on_site_at: '2026-06-28T12:00:00.000Z',
    ai_summary: 'A deterministic visual regression search result for checking dialog layout.',
    category: 'Community | Uplifting',
    positivity_score: 9,
  },
];

test.beforeEach(async ({ context }) => {
  await stabilizeBrowser(context);

  await context.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.turnstile={render:function(){return "visual-widget-id"},reset:function(){},remove:function(){}};',
    });
  });

  await context.route('**/_next/image**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lV6I8QAAAABJRU5ErkJggg==',
        'base64',
      ),
    });
  });

  await context.route('**/api/search?**', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q')?.trim().toLowerCase();
    const results = query === 'zzzz-empty-visual-state' ? [] : stableSearchResults;

    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: {
        'cache-control': 'public, max-age=60',
        'x-nutsnews-cache-policy': 'public-search-cache-60s',
      },
      body: JSON.stringify({ articles: results, page: 0, limit: 20, hasMore: false, languageCode: 'en' }),
    });
  });
});

test.describe('public visual regression snapshots', () => {
  test('homepage is stable on desktop and mobile', async ({ page }, testInfo) => {
    await openHomeWithArticles(page);
    await maskVolatileText(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveScreenshot(snapshotName(testInfo.project.name, 'homepage.png'));
  });

  test('article detail page is stable on desktop and mobile', async ({ page }, testInfo) => {
    const response = await page.goto(`/articles/${FIRST_ARTICLE_ID}`, { waitUntil: 'networkidle' });
    expect(response?.ok(), `Expected article detail page to load, got ${response?.status() ?? 'no response'}`).toBeTruthy();
    await expect(page.getByRole('heading', { name: FIRST_ARTICLE_TITLE })).toBeVisible();
    await maskVolatileText(page);
    await expect(page).toHaveScreenshot(snapshotName(testInfo.project.name, 'article-detail.png'), {
      fullPage: true,
    });
  });

  test('settings theme and language panels are stable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Settings panel visual baseline is captured on desktop.');

    await openHomeWithArticles(page);
    const panel = await openSettingsPanel(page);
    await panel.getByTestId('nutsnews-settings-theme').click();
    await expect(page.getByTestId('nutsnews-theme-option-sakura')).toBeVisible();
    await expect(page).toHaveScreenshot('desktop-settings-theme-panel.png');

    await page.getByTestId('nutsnews-settings-toggle').click();
    await openSettingsPanel(page);
    await page.getByTestId('nutsnews-settings-language').click();
    await expect(page.getByTestId('nutsnews-language-option-fr')).toBeVisible();
    await expect(page).toHaveScreenshot('desktop-settings-language-panel.png');
  });

  test('search results and empty states are stable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Search dialog visual baseline is captured on desktop.');

    await openHomeWithArticles(page);
    await openSearchDialog(page);
    await page.getByTestId('nutsnews-search-input').fill('community garden');
    await page.getByTestId('nutsnews-search-submit').click();
    await expect(page.getByTestId('nutsnews-search-result-card')).toHaveCount(1);
    await expect(page).toHaveScreenshot('desktop-search-results.png');

    await page.getByTestId('nutsnews-search-input').fill('zzzz-empty-visual-state');
    await page.getByTestId('nutsnews-search-submit').click();
    await expect(page.getByTestId('nutsnews-search-result-card')).toHaveCount(0);
    await expect(page.getByTestId('nutsnews-search-dialog')).toBeVisible();
    await expect(page).toHaveScreenshot('desktop-search-empty.png');
  });

  test('localized public page is stable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Localized visual baseline is captured on desktop.');

    await page.addInitScript((languageStorageKey) => {
      window.localStorage.setItem(languageStorageKey, 'fr');
    }, LANGUAGE_STORAGE_KEY);

    const response = await page.goto('/privacy', { waitUntil: 'networkidle' });
    expect(response?.ok(), `Expected /privacy to load, got ${response?.status() ?? 'no response'}`).toBeTruthy();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('main')).toContainText(/Politique de confidentialité|Confidentialité/i);
    await expect(page).toHaveScreenshot('desktop-privacy-fr.png', { fullPage: true });
  });
});

async function stabilizeBrowser(context: BrowserContext) {
  await context.addInitScript(
    ([languageStorageKey, themeStorageKey]) => {
      window.localStorage.setItem(languageStorageKey, 'en');
      window.localStorage.setItem(themeStorageKey, 'amber');
      Date.now = () => new Date('2026-06-28T12:00:00.000Z').getTime();
    },
    [LANGUAGE_STORAGE_KEY, THEME_STORAGE_KEY],
  );
}

async function openHomeWithArticles(page: Page) {
  let response = await page.goto('/', { waitUntil: 'networkidle' });
  for (let attempt = 1; attempt <= 2 && !response?.ok(); attempt += 1) {
    await page.waitForTimeout(500);
    response = await page.goto('/', { waitUntil: 'networkidle' });
  }
  expect(response?.ok(), `Expected homepage to load, got ${response?.status() ?? 'no response'}`).toBeTruthy();
  await expect(page.getByTestId('nutsnews-article-feed')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(FIRST_ARTICLE_TITLE).first()).toBeVisible();
}

async function openSettingsPanel(page: Page) {
  const toggle = page.getByTestId('nutsnews-settings-toggle');
  const panel = page.getByTestId('nutsnews-settings-panel');

  await expect(toggle).toBeVisible({ timeout: 15_000 });
  await toggle.click({ force: true });
  await expect(panel).toBeVisible({ timeout: 15_000 });
  return panel;
}

async function openSearchDialog(page: Page) {
  const searchButton = page.getByTestId('nutsnews-footer-search');
  await expect(searchButton).toBeVisible({ timeout: 15_000 });
  await searchButton.click({ force: true });
  await expect(page.getByTestId('nutsnews-search-dialog')).toBeVisible({ timeout: 15_000 });
}

async function maskVolatileText(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      time,
      [datetime] {
        visibility: hidden !important;
      }
    `,
  });
}

function snapshotName(projectName: string, fileName: string) {
  return `${projectName}-${fileName}`;
}
