import { expect, test, type Page, type Response } from '@playwright/test';

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

type SearchResponse = {
  articles?: Array<{
    id?: string;
  }>;
  error?: string;
  query?: string;
};

type ArticleLanguageResponse = {
  articles?: Array<{
    id?: unknown;
    title?: unknown;
    language_code?: unknown;
    requested_language_code?: unknown;
    translation_available?: unknown;
  }>;
  dataSource?: unknown;
  edgeSnapshot?: unknown;
  languageCode?: unknown;
};

type ArticleResponseMetadata = {
  languageCode: unknown;
  firstArticle: {
    id?: unknown;
    title?: unknown;
    language_code?: unknown;
    requested_language_code?: unknown;
    translation_available?: unknown;
  } | null;
  dataSource: unknown;
  edgeSnapshot: unknown;
  headers: Record<string, string>;
};

type VisibleArticleCard = {
  index: number;
  lang: string | null;
  title: string;
};

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ([languageStorageKey, themeStorageKey]) => {
      window.localStorage.setItem(languageStorageKey, 'en');
      window.localStorage.setItem(themeStorageKey, 'amber');
    },
    [LANGUAGE_STORAGE_KEY, THEME_STORAGE_KEY],
  );
});

async function assertNotDeploymentProtectionPage(page: Page) {
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
    'The deployed target is behind deployment protection. Configure the target-specific automation bypass credentials before running deployed UI smoke tests.',
  ).toBeFalsy();
}

async function openHomeWithCards(page: Page) {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), `Expected homepage to load, got ${response?.status() ?? 'no response'}`).toBeTruthy();

  await expect
    .poll(async () => page.getByTestId('nutsnews-article-feed').count(), {
      message: 'Expected the NutsNews article feed to render. If this stays at 0, check whether the target is behind deployment protection.',
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await assertNotDeploymentProtectionPage(page);
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

async function openSearchDialog(page: Page) {
  const searchButton = page.getByTestId('nutsnews-footer-search');
  const dialog = page.getByTestId('nutsnews-search-dialog');

  await expect(searchButton).toBeVisible({ timeout: 15_000 });
  await searchButton.scrollIntoViewIfNeeded();

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (await dialog.isVisible().catch(() => false)) {
      return dialog;
    }

    await searchButton.click({ force: true });

    try {
      await expect(dialog).toBeVisible({ timeout: 3_000 });
      return dialog;
    } catch {
      if (attempt === 4) {
        break;
      }

      await page.waitForTimeout(500);
    }
  }

  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

async function readFirstArticleTitle(page: Page) {
  const firstTitle = page
    .getByTestId('nutsnews-article-card')
    .first()
    .locator('.wp-article-card__title');

  await expect(firstTitle).not.toHaveText('', { timeout: 15_000 });
  return (await firstTitle.innerText()).trim();
}

async function readVisibleArticleCards(page: Page): Promise<VisibleArticleCard[]> {
  const cards = page.getByTestId('nutsnews-article-card');
  const count = await cards.count();
  const visibleCards: VisibleArticleCard[] = [];

  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index);

    if (!(await card.isVisible().catch(() => false))) {
      continue;
    }

    const title = (
      await card
        .locator('.wp-article-card__title')
        .innerText()
        .catch(() => '')
    ).trim();

    if (title) {
      visibleCards.push({
        index,
        lang: await card.getAttribute('lang'),
        title,
      });
    }
  }

  return visibleCards;
}

async function waitForFirstArticleLanguage(page: Page, expectedLanguageCode: string) {
  const firstCard = page.getByTestId('nutsnews-article-card').first();

  await expect
    .poll(async () => firstCard.getAttribute('lang'), {
      message: `Expected the first visible article card to render in ${expectedLanguageCode}.`,
      timeout: 30_000,
    })
    .toBe(expectedLanguageCode);

  return (await firstCard.getAttribute('lang')) ?? 'en';
}

function normalizedTitle(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function buildArticleResponseMetadata(
  response: Response,
  payload: ArticleLanguageResponse,
): Promise<ArticleResponseMetadata> {
  const headers = await response.allHeaders();
  const selectedHeaders = [
    'x-nutsnews-article-data-source',
    'x-nutsnews-feed-snapshot',
    'x-nutsnews-edge-snapshot',
    'x-nutsnews-edge-snapshot-updated-at',
    'x-nutsnews-edge-snapshot-age-seconds',
    'x-nutsnews-edge-snapshot-article-count',
    'x-nutsnews-edge-snapshot-version',
    'x-nutsnews-degradation-mode',
    'x-nutsnews-degradation-reason',
  ].reduce<Record<string, string>>((metadataHeaders, headerName) => {
    const value = headers[headerName];

    if (value) {
      metadataHeaders[headerName] = value;
    }

    return metadataHeaders;
  }, {});

  const firstArticle = payload.articles?.[0] ?? null;

  return {
    languageCode: payload.languageCode ?? null,
    firstArticle: firstArticle
      ? {
          id: firstArticle.id,
          title: firstArticle.title,
          language_code: firstArticle.language_code,
          requested_language_code: firstArticle.requested_language_code,
          translation_available: firstArticle.translation_available,
        }
      : null,
    dataSource: payload.dataSource ?? null,
    edgeSnapshot: payload.edgeSnapshot ?? null,
    headers: selectedHeaders,
  };
}

function formatArticleResponseMetadata(metadata: ArticleResponseMetadata) {
  return JSON.stringify(metadata, null, 2);
}

function translatedArticleTitles(
  payload: ArticleLanguageResponse,
  requestedLanguageCode: string,
  metadata: ArticleResponseMetadata,
) {
  const metadataText = formatArticleResponseMetadata(metadata);
  const articles = payload.articles ?? [];

  expect(payload.languageCode, `Expected the API response languageCode to preserve ${requestedLanguageCode}.\n${metadataText}`).toBe(
    requestedLanguageCode,
  );
  expect(articles.length, `Expected the ${requestedLanguageCode} API response to include articles.\n${metadataText}`).toBeGreaterThan(0);

  for (const [index, article] of articles.entries()) {
    if (article.translation_available === true) {
      expect(
        article.requested_language_code,
        `Expected translated ${requestedLanguageCode} article ${index} to preserve requested_language_code.\n${metadataText}`,
      ).toBe(requestedLanguageCode);
      expect(
        article.language_code,
        `Expected translated ${requestedLanguageCode} article ${index} to render as ${requestedLanguageCode}.\n${metadataText}`,
      ).toBe(requestedLanguageCode);
      continue;
    }

    expect(
      article.translation_available,
      `Expected ${requestedLanguageCode} article ${index} to declare either translated content or English fallback metadata.\n${metadataText}`,
    ).toBe(false);
    expect(
      article.requested_language_code,
      `Expected English fallback ${requestedLanguageCode} article ${index} to preserve the requested language.\n${metadataText}`,
    ).toBe(requestedLanguageCode);
    expect(
      article.language_code,
      `Expected English fallback ${requestedLanguageCode} article ${index} to declare language_code=en.\n${metadataText}`,
    ).toBe('en');
  }

  const translatedTitles = Array.from(
    new Set(
      articles
        .filter(
          (article) =>
            article.translation_available === true &&
            article.language_code === requestedLanguageCode &&
            article.requested_language_code === requestedLanguageCode,
        )
        .map((article) => normalizedTitle(article.title))
        .filter(Boolean),
    ),
  );

  expect(
    translatedTitles.length,
    `Expected the ${requestedLanguageCode} feed to include at least one translated article title; all-English non-English feeds are unhealthy.\n${metadataText}`,
  ).toBeGreaterThan(0);

  return translatedTitles;
}

async function waitForVisibleTranslatedArticleCard({
  page,
  languageCode,
  translatedTitles,
  metadata,
}: {
  page: Page;
  languageCode: string;
  translatedTitles: string[];
  metadata: ArticleResponseMetadata;
}) {
  const translatedTitleSet = new Set(translatedTitles);
  const metadataText = formatArticleResponseMetadata(metadata);

  await expect
    .poll(
      async () => {
        const visibleCards = await readVisibleArticleCards(page);
        return visibleCards.some(
          (card) => card.lang === languageCode && translatedTitleSet.has(card.title),
        );
      },
      {
        message: `Expected at least one visible ${languageCode} article card to render a translated API title.\n${metadataText}`,
        timeout: 30_000,
      },
    )
    .toBe(true);

  const visibleCards = await readVisibleArticleCards(page);
  const translatedCard = visibleCards.find(
    (card) => card.lang === languageCode && translatedTitleSet.has(card.title),
  );

  if (!translatedCard) {
    throw new Error(
      `Expected a visible ${languageCode} translated article card after polling.\n${metadataText}`,
    );
  }

  return translatedCard;
}

test.describe('Deployed UI smoke regression', () => {
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
        `Expected ${route.path} to load from the deployed target, got ${response?.status() ?? 'no response'}.`,
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

  test('footer search returns a displayed article', async ({ page }) => {
    const firstCard = await openHomeWithCards(page);
    const firstTitle = (await firstCard.locator('.wp-article-card__title').innerText()).trim();
    const searchQuery = firstTitle.match(/[\p{L}\p{N}]{3,}/u)?.[0];

    if (!searchQuery) {
      throw new Error(`Could not derive a searchable term from the visible article title: ${firstTitle}`);
    }

    await openSearchDialog(page);
    await page.getByTestId('nutsnews-search-input').fill(searchQuery);

    const searchResponsePromise = page.waitForResponse((response) => {
      const url = response.url();
      return new URL(url).pathname === '/api/search' && new URL(url).searchParams.get('q') === searchQuery;
    });

    await page.getByTestId('nutsnews-search-submit').click();
    const searchResponse = await searchResponsePromise;
    expect(searchResponse.ok(), `Expected /api/search?q=${searchQuery} to succeed, got ${searchResponse.status()}.`).toBeTruthy();

    const payload = (await searchResponse.json()) as SearchResponse;
    expect(payload.error, 'Expected the deployed search API to return a successful response.').toBeUndefined();
    expect(payload.query, 'Expected the search response to preserve the submitted query.').toBe(searchQuery);

    if ((payload.articles?.length ?? 0) > 0) {
      await expect
        .poll(async () => page.getByTestId('nutsnews-search-result-card').count(), {
          message: 'Expected the visible search menu to render the displayed article result.',
          timeout: 20_000,
        })
        .toBeGreaterThan(0);
    } else {
      await expect(page.getByTestId('nutsnews-search-dialog')).toContainText('No matching stories yet');
    }
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

  test('language menu honors translations and English fallback through every supported language', async ({ page }) => {
    await openHomeWithCards(page);
    const initialEnglishTitle = await readFirstArticleTitle(page);

    await openSettingsPanel(page);
    await page.getByTestId('nutsnews-settings-language').click();

    for (const language of languageExpectations) {
      const responsePromise = page.waitForResponse((response) => {
        const url = response.url();
        const parsedUrl = new URL(url);
        return (
          parsedUrl.pathname === '/api/articles' &&
          parsedUrl.searchParams.get('home') === '1' &&
          parsedUrl.searchParams.get('lang') === language.code &&
          response.request().method() === 'GET'
        );
      });

      await page.getByTestId(language.optionTestId).click();
      const languageResponse = await responsePromise;
      expect(
        languageResponse.ok(),
        `Expected the ${language.code} feed request to succeed, got ${languageResponse.status()}.`,
      ).toBeTruthy();

      const languagePayload = (await languageResponse.json()) as ArticleLanguageResponse;
      const responseMetadata = await buildArticleResponseMetadata(languageResponse, languagePayload);
      const translatedTitles = translatedArticleTitles(languagePayload, language.code, responseMetadata);
      await expect(page.locator('html')).toHaveAttribute('lang', language.expectedHtmlLang);
      const translatedCard = await waitForVisibleTranslatedArticleCard({
        page,
        languageCode: language.code,
        translatedTitles,
        metadata: responseMetadata,
      });

      expect(
        translatedCard.title,
        `Expected the first visible translated ${language.code} title to change from the initial English title.\n${formatArticleResponseMetadata(responseMetadata)}`,
      ).not.toBe(initialEnglishTitle);
    }

    await page.getByTestId('nutsnews-language-option-en').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await waitForFirstArticleLanguage(page, 'en');
    await expect
      .poll(async () => page.evaluate((storageKey) => window.localStorage.getItem(storageKey), LANGUAGE_STORAGE_KEY), {
        message: 'Expected English to persist to localStorage after restoring the language setting.',
        timeout: 10_000,
      })
      .toBe('en');
    expect(await readFirstArticleTitle(page), 'Expected English to render a visible article title.').not.toBe('');
  });
});
