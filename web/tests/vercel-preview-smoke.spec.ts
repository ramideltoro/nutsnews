import { expect, test, type Page } from '@playwright/test';

const LANGUAGE_STORAGE_KEY = 'nutsnews.web.language';
const THEME_STORAGE_KEY = 'nutsnews.web.theme';

const publicRoutes = [
  { name: 'Apps', path: '/apps', expectedText: /NutsNews for iPhone is here\./i },
  { name: 'About', path: '/about', expectedText: /About NutsNews/i },
  { name: 'Contact', path: '/contact', expectedText: /Send a message/i },
  { name: 'Privacy', path: '/privacy', expectedText: /NutsNews Privacy Policy/i },
] as const;

const themeIds = [
  'amber',
  'sakura',
  'modern-saas',
  'san-juan',
  'creative-premium',
  'moody-cyberpunk',
] as const;

const languageExpectations = [
  { code: 'fr', optionTestId: 'nutsnews-language-option-fr', expectedHtmlLang: 'fr' },
  { code: 'ja', optionTestId: 'nutsnews-language-option-ja', expectedHtmlLang: 'ja' },
  { code: 'de-CH', optionTestId: 'nutsnews-language-option-de-CH', expectedHtmlLang: 'de-CH' },
  { code: 'de', optionTestId: 'nutsnews-language-option-de', expectedHtmlLang: 'de' },
  { code: 'el', optionTestId: 'nutsnews-language-option-el', expectedHtmlLang: 'el' },
] as const;

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ([languageStorageKey, themeStorageKey]) => {
      window.localStorage.setItem(languageStorageKey, 'en');
      window.localStorage.setItem(themeStorageKey, 'amber');
    },
    [LANGUAGE_STORAGE_KEY, THEME_STORAGE_KEY],
  );
});

async function assertNotVercelProtectionPage(page: Page) {
  const pageUrl = page.url();
  const pageText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
  const title = await page.title().catch(() => '');
  const looksProtected =
    pageUrl.includes('vercel.com/sso-api') ||
    /Vercel Authentication|Deployment Protection|Log in to Vercel|Continue with Vercel|This deployment is protected/i.test(
      `${title}\n${pageText}`,
    );

  expect(
    looksProtected,
    'The Vercel preview is protected by Vercel Authentication/Deployment Protection. Add the GitHub repository secret VERCEL_AUTOMATION_BYPASS_SECRET from Vercel Project Settings > Deployment Protection > Protection Bypass for Automation, or disable protection for preview deployments.',
  ).toBeFalsy();
}

async function openHomeWithCards(page: Page) {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), `Expected homepage to load, got ${response?.status() ?? 'no response'}`).toBeTruthy();

  await expect
    .poll(async () => page.getByTestId('nutsnews-article-feed').count(), {
      message: 'Expected the NutsNews article feed to render. If this stays at 0, check whether the preview is behind Vercel Deployment Protection.',
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await assertNotVercelProtectionPage(page);
  await expect(page.getByTestId('nutsnews-article-feed')).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(async () => page.getByTestId('nutsnews-article-card').count(), {
      message: 'Expected the homepage to populate at least one article card.',
      timeout: 30_000,
    })
    .toBeGreaterThan(0);

  const firstCard = page.getByTestId('nutsnews-article-card').first();
  await expect(firstCard.locator('.wp-article-card__title')).not.toHaveText('', { timeout: 15_000 });
  await expect(firstCard.locator('a[href]').first()).toHaveAttribute('href', /https?:\/\//);

  return firstCard;
}

async function openSettingsPanel(page: Page) {
  const toggle = page.getByTestId('nutsnews-settings-toggle');
  const panel = page.getByTestId('nutsnews-settings-panel');

  if (!(await panel.isVisible().catch(() => false))) {
    await toggle.click();
  }

  await expect(panel).toBeVisible({ timeout: 15_000 });
  return panel;
}

async function readFirstArticleTitle(page: Page) {
  const firstTitle = page
    .getByTestId('nutsnews-article-card')
    .first()
    .locator('.wp-article-card__title');

  await expect(firstTitle).not.toHaveText('', { timeout: 15_000 });
  return (await firstTitle.innerText()).trim();
}

async function waitForFirstArticleLanguage(page: Page, languageCode: string) {
  const firstCard = page.getByTestId('nutsnews-article-card').first();

  await expect
    .poll(async () => firstCard.getAttribute('lang'), {
      message: `Expected the first visible article card to render in ${languageCode}.`,
      timeout: 30_000,
    })
    .toBe(languageCode);
}

test.describe('Vercel Preview smoke regression', () => {
  test('homepage populates article cards', async ({ page }) => {
    await openHomeWithCards(page);
  });

  test('public footer pages load: Apps, About, Contact, Privacy', async ({ page }) => {
    await openHomeWithCards(page);

    for (const route of publicRoutes) {
      await expect(page.locator('footer').getByRole('link', { name: route.name, exact: true })).toHaveAttribute(
        'href',
        route.path,
      );

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(
        response?.ok(),
        `Expected ${route.path} to load from the preview deployment, got ${response?.status() ?? 'no response'}.`,
      ).toBeTruthy();
      await expect(page.locator('main')).toContainText(route.expectedText, { timeout: 20_000 });
    }
  });

  test('footer home button scrolls the homepage back to top', async ({ page }) => {
    await openHomeWithCards(page);

    const footerHomeButton = page.getByTestId('nutsnews-footer-home');
    await expect(footerHomeButton).toBeAttached({ timeout: 10_000 });
    await page.evaluate(() => {
      const maxScrollTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: Math.min(700, maxScrollTop), behavior: 'instant' });
    });
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), {
        message: 'Expected the homepage to be scrollable before testing the footer home button.',
        timeout: 10_000,
      })
      .toBeGreaterThan(50);

    await footerHomeButton.dispatchEvent('click');

    await expect
      .poll(async () => page.evaluate(() => window.scrollY), {
        message: 'Expected the footer home button to finish at the top of the page.',
        timeout: 10_000,
      })
      .toBeLessThanOrEqual(4);
  });

  test('footer search for dogs returns article results', async ({ page }) => {
    await openHomeWithCards(page);

    await page.getByTestId('nutsnews-footer-search').click();
    await expect(page.getByTestId('nutsnews-search-dialog')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('nutsnews-search-input').fill('dogs');

    const searchResponsePromise = page.waitForResponse((response) => {
      const url = response.url();
      return url.includes('/api/search') && url.includes('q=dogs');
    });

    await page.getByTestId('nutsnews-search-submit').click();
    const searchResponse = await searchResponsePromise;
    expect(searchResponse.ok(), `Expected /api/search?q=dogs to succeed, got ${searchResponse.status()}.`).toBeTruthy();

    const payload = (await searchResponse.json()) as { articles?: unknown[] };
    expect(payload.articles?.length ?? 0, 'Expected /api/search?q=dogs to return at least one article.').toBeGreaterThan(0);

    await expect
      .poll(async () => page.getByTestId('nutsnews-search-result-card').count(), {
        message: 'Expected the visible search menu to render dog search results.',
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
  });

  test('settings menu opens and every theme can be applied', async ({ page }) => {
    await openHomeWithCards(page);
    await openSettingsPanel(page);
    await page.getByTestId('nutsnews-settings-theme').click();

    for (const themeId of themeIds) {
      await page.getByTestId(`nutsnews-theme-option-${themeId}`).click();
      await expect(page.locator('html')).toHaveAttribute('data-nutsnews-theme', themeId);
      await expect
        .poll(
          async () =>
            page.evaluate((storageKey) => window.localStorage.getItem(storageKey), THEME_STORAGE_KEY),
          {
            message: `Expected ${themeId} to persist to localStorage.`,
            timeout: 10_000,
          },
        )
        .toBe(themeId);
    }
  });

  test('language menu translates articles through every supported language and back to English', async ({ page }) => {
    await openHomeWithCards(page);
    const englishTitle = await readFirstArticleTitle(page);

    await openSettingsPanel(page);
    await page.getByTestId('nutsnews-settings-language').click();

    for (const language of languageExpectations) {
      const responsePromise = page.waitForResponse((response) => {
        const url = response.url();
        return url.includes('/api/articles') && url.includes(`lang=${language.code}`) && response.request().method() === 'GET';
      });

      await page.getByTestId(language.optionTestId).click();
      await responsePromise;

      await expect(page.locator('html')).toHaveAttribute('lang', language.expectedHtmlLang);
      await waitForFirstArticleLanguage(page, language.code);

      const translatedTitle = await readFirstArticleTitle(page);
      expect(
        translatedTitle,
        `Expected the first article title to change when selecting ${language.code}.`,
      ).not.toBe(englishTitle);
    }

    await page.getByTestId('nutsnews-language-option-en').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await waitForFirstArticleLanguage(page, 'en');
    await expect
      .poll(async () => readFirstArticleTitle(page), {
        message: 'Expected English to restore the original English article title.',
        timeout: 30_000,
      })
      .toBe(englishTitle);
  });
});
