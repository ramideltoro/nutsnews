import { expect, test, type Page } from '@playwright/test';

const LANGUAGE_STORAGE_KEY = 'nutsnews.web.language';
const THEME_STORAGE_KEY = 'nutsnews.web.theme';
const FIRST_ARTICLE_ID = 'public-smoke-article-01';
const FIRST_ARTICLE_TITLE = 'Public smoke readers celebrate neighborhood gardens';
const FIRST_ARTICLE_FRENCH_TITLE = 'Jardins de quartier pour le test public';
const mobileFooterRoutes = [
  { name: 'Apps', path: '/apps' },
  { name: 'Saved', path: '/saved' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' },
  { name: 'Privacy', path: '/privacy' },
];

type ArticlesResponse = {
  articles?: Array<{
    id?: unknown;
    title?: unknown;
    language_code?: unknown;
    requested_language_code?: unknown;
    translation_available?: unknown;
  }>;
  languageCode?: unknown;
};

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ([languageStorageKey, themeStorageKey]) => {
      window.localStorage.setItem(languageStorageKey, 'en');
      window.localStorage.setItem(themeStorageKey, 'amber');
    },
    [LANGUAGE_STORAGE_KEY, THEME_STORAGE_KEY],
  );

  await context.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.turnstile = {
          render: function(container, options) {
            container.setAttribute('data-public-smoke-turnstile', 'rendered');
            setTimeout(function(){ options && options.callback && options.callback('public-smoke-turnstile-token'); }, 25);
            return 'public-smoke-widget-id';
          },
          reset: function() {},
          remove: function() {}
        };
      `,
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
});

async function openHomeWithArticles(page: Page) {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), `Expected homepage to load, got ${response?.status() ?? 'no response'}`).toBeTruthy();

  await expect(page.getByTestId('nutsnews-article-feed')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => page.getByTestId('nutsnews-article-card').count(), {
      message: 'Expected the homepage to render public article cards.',
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await expect(page.getByText(FIRST_ARTICLE_TITLE).first()).toBeVisible();
}

async function openSettingsPanel(page: Page) {
  const toggle = page.getByTestId('nutsnews-settings-toggle');
  const panel = page.getByTestId('nutsnews-settings-panel');

  await expect(toggle).toBeVisible({ timeout: 15_000 });
  await toggle.scrollIntoViewIfNeeded();

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (await panel.isVisible().catch(() => false)) {
      return panel;
    }

    await toggle.click({ force: true });

    try {
      await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 3_000 });
      await expect(panel).toBeVisible({ timeout: 3_000 });
      return panel;
    } catch {
      if (attempt === 4) {
        break;
      }
      await page.waitForTimeout(500);
    }
  }

  await expect(panel).toBeVisible({ timeout: 15_000 });
  return panel;
}

async function openFooterMenu(page: Page) {
  const toggle = page.getByTestId('nutsnews-footer-menu');
  const panel = page.getByTestId('nutsnews-footer-menu-panel');

  await expect(toggle).toBeVisible({ timeout: 15_000 });
  await toggle.scrollIntoViewIfNeeded();

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (await panel.isVisible().catch(() => false)) {
      return panel;
    }

    await toggle.click({ force: true });

    try {
      await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 3_000 });
      await expect(panel).toBeVisible({ timeout: 3_000 });
      return panel;
    } catch {
      if (attempt === 4) {
        break;
      }

      await page.waitForTimeout(500);
    }
  }

  await expect(panel).toBeVisible({ timeout: 15_000 });
  return panel;
}

test.describe('Public reader smoke flows', () => {
  test('mobile footer routes move into the hamburger menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHomeWithArticles(page);

    const footer = page.locator('footer');
    await expect(footer.locator('.site-footer-modern__nav')).toBeHidden();

    const menuToggle = page.getByTestId('nutsnews-footer-menu');
    await expect(menuToggle).toBeVisible();
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');

    const menuPanel = await openFooterMenu(page);
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');

    for (const route of mobileFooterRoutes) {
      await expect(menuPanel.getByRole('link', { name: route.name, exact: true })).toHaveAttribute('href', route.path);
    }
  });

  test('home page loads articles and infinite scroll can fetch more', async ({ page }) => {
    const paginationResponses: import('@playwright/test').Response[] = [];
    page.on('response', (response) => {
      const url = response.url();

      if (url.includes('/api/articles?') && url.includes('cursor=')) {
        paginationResponses.push(response);
      }
    });

    await openHomeWithArticles(page);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));

    await expect
      .poll(async () => paginationResponses.length, {
        message: 'Expected infinite scroll to request another article page using cursor pagination.',
        timeout: 20_000,
      })
      .toBeGreaterThan(0);

    const payload = (await paginationResponses[0].json()) as { articles?: unknown[] };
    expect(payload.articles?.length ?? 0, 'Expected the infinite-scroll response to include more articles.').toBeGreaterThan(0);
  });

  test('language switching still loads localized articles', async ({ page }) => {
    await openHomeWithArticles(page);
    const panel = await openSettingsPanel(page);
    await panel.getByTestId('nutsnews-settings-language').click();

    const localizedResponse = page.waitForResponse((response) => {
      const url = response.url();
      return url.includes('/api/articles?') && url.includes('home=1') && url.includes('lang=fr');
    });

    await panel.getByTestId('nutsnews-language-option-fr').click();
    const response = await localizedResponse;
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as ArticlesResponse;
    const firstArticle =
      payload.articles?.find((article) => article.id === FIRST_ARTICLE_ID) ?? payload.articles?.[0];

    expect(payload.languageCode).toBe('fr');
    expect(firstArticle?.title).toBe(FIRST_ARTICLE_FRENCH_TITLE);
    expect(firstArticle?.language_code).toBe('fr');
    expect(firstArticle?.requested_language_code).toBe('fr');
    expect(firstArticle?.translation_available).toBe(true);

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByTestId('nutsnews-article-card').first()).toHaveAttribute('lang', 'fr');
    await expect(page.getByText(FIRST_ARTICLE_FRENCH_TITLE).first()).toBeVisible({ timeout: 15_000 });
  });

  test('unsupported stored language falls back to visible English copy', async ({ page }) => {
    await page.addInitScript((languageStorageKey) => {
      window.localStorage.setItem(languageStorageKey, 'zz');
    }, LANGUAGE_STORAGE_KEY);

    const response = await page.goto('/contact', { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), `Expected /contact to load, got ${response?.status() ?? 'no response'}`).toBeTruthy();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Send a message' })).toBeVisible();
    await expect(page.getByText('zz')).toHaveCount(0);
  });

  test('contact page renders and blocks invalid submissions', async ({ page }) => {
    const contactRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/contact')) {
        contactRequests.push(request.url());
      }
    });

    const response = await page.goto('/contact', { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), `Expected /contact to load, got ${response?.status() ?? 'no response'}`).toBeTruthy();
    await expect(page.getByRole('heading', { name: /Send a message/i })).toBeVisible();

    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('#contact-email')).toBeFocused();
    await expect
      .poll(async () => contactRequests.length, {
        message: 'Expected browser validation to block invalid contact submission before /api/contact.',
        timeout: 1_000,
      })
      .toBe(0);
    await expect
      .poll(async () => page.locator('#contact-email').evaluate((input) => (input as HTMLInputElement).validity.valid))
      .toBe(false);
  });

  test('privacy and about pages render', async ({ page }) => {
    const privacyResponse = await page.goto('/privacy', { waitUntil: 'domcontentloaded' });
    expect(privacyResponse?.ok(), `Expected /privacy to load, got ${privacyResponse?.status() ?? 'no response'}`).toBeTruthy();
    await expect(page.locator('main')).toContainText(/Privacy Policy|NutsNews Privacy Policy/i);

    const aboutResponse = await page.goto('/about', { waitUntil: 'domcontentloaded' });
    expect(aboutResponse?.ok(), `Expected /about to load, got ${aboutResponse?.status() ?? 'no response'}`).toBeTruthy();
    await expect(page.locator('main')).toContainText(/About NutsNews/i);
  });

  test('article detail page opens from a known URL', async ({ page }) => {
    const response = await page.goto(`/articles/${FIRST_ARTICLE_ID}`, { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), `Expected article detail page to load, got ${response?.status() ?? 'no response'}`).toBeTruthy();

    await expect(page.getByRole('heading', { name: FIRST_ARTICLE_TITLE })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Read full story' })).toHaveAttribute('href', /mock\.nutsnews\.test/);
    await expect(page.getByRole('link', { name: /Back to NutsNews/i })).toHaveAttribute('href', '/');
  });
});
