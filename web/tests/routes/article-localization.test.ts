import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callBackendDatabaseOperation: vi.fn(),
  providerMode: "supabase_primary",
  snapshotRows: [] as Array<Record<string, unknown>>,
  summaryRows: [] as Array<Record<string, unknown>>,
  logWarn: vi.fn(),
  validateTranslatedSummary: vi.fn(() => ({ usable: true, warnings: [] })),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: (operation: unknown) => operation,
}));

vi.mock("@/lib/backendDatabase", () => ({
  callBackendDatabaseOperation: mocks.callBackendDatabaseOperation,
}));

vi.mock("@/lib/logger", () => ({
  logWarn: mocks.logWarn,
}));

vi.mock("@/lib/runtimeSafety", () => ({
  getDatabaseProviderMode: () => mocks.providerMode,
}));

vi.mock("@/lib/translationQuality", () => ({
  validateTranslatedSummary: mocks.validateTranslatedSummary,
}));

vi.mock("@/lib/supabase", () => {
  class SnapshotQuery {
    select() {
      return this;
    }

    ilike() {
      return this;
    }

    order() {
      return this;
    }

    range() {
      return Promise.resolve({ data: mocks.snapshotRows, error: null });
    }

    limit() {
      return Promise.resolve({ data: mocks.snapshotRows, error: null });
    }
  }

  class SummaryQuery {
    private languageCode = "en";

    select() {
      return this;
    }

    eq(_column: string, value: string) {
      this.languageCode = value;
      return this;
    }

    in(_column: string, originalUrls: string[]) {
      return Promise.resolve({
        data: mocks.summaryRows.filter(
          (row) =>
            row.language_code === this.languageCode &&
            originalUrls.includes(String(row.original_url)),
        ),
        error: null,
      });
    }
  }

  return {
    getSupabase: () => ({
      from(table: string) {
        if (table === "public_feed_snapshot") {
          return new SnapshotQuery();
        }

        if (table === "article_summaries") {
          return new SummaryQuery();
        }

        throw new Error(`Unexpected Supabase table ${table}`);
      },
    }),
  };
});

function snapshotArticle(index: number) {
  return {
    id: `article-${index}`,
    source: "Fixture Source",
    title: `English title ${index}`,
    original_url: `https://example.test/article-${index}`,
    image_url: `https://example.test/image-${index}.jpg`,
    published_at: "2026-07-20T12:00:00.000Z",
    published_on_site_at: "2026-07-20T12:00:00.000Z",
    ai_summary: `English summary ${index}.`,
    category: "community",
    positivity_score: 0.95,
  };
}

beforeEach(() => {
  vi.resetModules();
  mocks.providerMode = "supabase_primary";
  mocks.snapshotRows = Array.from({ length: 6 }, (_, index) => snapshotArticle(index + 1));
  mocks.summaryRows = [];
  mocks.callBackendDatabaseOperation.mockReset();
  mocks.logWarn.mockReset();
  mocks.validateTranslatedSummary.mockClear();
  mocks.validateTranslatedSummary.mockReturnValue({ usable: true, warnings: [] });
});

describe("published article localization", () => {
  it("applies translated card titles and summaries when article_summaries rows exist", async () => {
    mocks.summaryRows = mocks.snapshotRows.slice(0, 5).map((article, index) => ({
      original_url: article.original_url,
      language_code: "fr",
      title: `Titre francais ${index + 1}`,
      summary: `Resume francais ${index + 1}.`,
    }));

    const { getPublishedArticles } = await import("@/lib/articles");
    const result = await getPublishedArticles(0, null, "fr");

    expect(result.articles).toHaveLength(5);
    expect(result.articles[0]).toMatchObject({
      title: "Titre francais 1",
      ai_summary: "Resume francais 1.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    });
    expect(result.nextPage).toBe(1);
    expect(mocks.logWarn).not.toHaveBeenCalledWith(
      "articles.localized_summaries_missing",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("keeps English fallback explicit and logs missing translation rows", async () => {
    const { getPublishedArticles } = await import("@/lib/articles");
    const result = await getPublishedArticles(0, null, "fr");

    expect(result.articles).toHaveLength(5);
    expect(result.articles[0]).toMatchObject({
      title: "English title 1",
      ai_summary: "English summary 1.",
      language_code: "en",
      requested_language_code: "fr",
      translation_available: false,
    });
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "articles.localized_summaries_missing",
      "Article summary translations are missing; falling back to English for affected cards.",
      expect.objectContaining({
        requestedLanguageCode: "fr",
        articleCount: 5,
        missingSummaryCount: 5,
      }),
    );
  });
});

describe("backend primary article localization", () => {
  it("passes requested language to backend feed reads and preserves localized rows", async () => {
    mocks.providerMode = "backend_postgres_primary";
    const backendRows = Array.from({ length: 6 }, (_, index) => ({
      ...snapshotArticle(index + 1),
      title: `Titre backend ${index + 1}`,
      ai_summary: `Resume backend ${index + 1}.`,
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    }));
    mocks.callBackendDatabaseOperation.mockResolvedValueOnce(backendRows);

    const { getPublishedArticles } = await import("@/lib/articles");
    const result = await getPublishedArticles(0, "community", "fr");

    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-public-feed-snapshot",
      {
        category: "community",
        limit: 6,
        offset: 0,
        requestedLanguageCode: "fr",
      },
    );
    expect(result.articles).toHaveLength(5);
    expect(result.articles[0]).toMatchObject({
      title: "Titre backend 1",
      ai_summary: "Resume backend 1.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    });
    expect(result.nextPage).toBe(1);
    expect(mocks.validateTranslatedSummary).not.toHaveBeenCalled();
  });

  it("marks older backend feed rows as English fallbacks when localized metadata is absent", async () => {
    mocks.providerMode = "backend_postgres_primary";
    mocks.callBackendDatabaseOperation.mockResolvedValueOnce(
      Array.from({ length: 6 }, (_, index) => snapshotArticle(index + 1)),
    );

    const { getPublishedArticles } = await import("@/lib/articles");
    const result = await getPublishedArticles(0, null, "fr");

    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-public-feed-snapshot",
      {
        category: null,
        limit: 6,
        offset: 0,
        requestedLanguageCode: "fr",
      },
    );
    expect(result.articles[0]).toMatchObject({
      title: "English title 1",
      ai_summary: "English summary 1.",
      language_code: "en",
      requested_language_code: "fr",
      translation_available: false,
    });
  });

  it("passes requested language to backend detail reads and preserves localized detail rows", async () => {
    mocks.providerMode = "backend_postgres_primary";
    mocks.callBackendDatabaseOperation.mockResolvedValueOnce({
      ...snapshotArticle(7),
      id: "detail-backend-fr",
      title: "Titre detail backend",
      ai_summary: "Resume detail backend.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    });

    const { getArticleById } = await import("@/lib/articles");
    const article = await getArticleById("detail-backend-fr", "fr");

    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-article-detail",
      {
        id: "detail-backend-fr",
        requestedLanguageCode: "fr",
      },
    );
    expect(article).toMatchObject({
      title: "Titre detail backend",
      ai_summary: "Resume detail backend.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    });
  });

  it("marks older backend detail rows as English fallbacks when localized metadata is absent", async () => {
    mocks.providerMode = "backend_postgres_primary";
    mocks.callBackendDatabaseOperation.mockResolvedValueOnce({
      ...snapshotArticle(8),
      id: "detail-backend-old",
    });

    const { getArticleById } = await import("@/lib/articles");
    const article = await getArticleById("detail-backend-old", "ja");

    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-article-detail",
      {
        id: "detail-backend-old",
        requestedLanguageCode: "ja",
      },
    );
    expect(article).toMatchObject({
      title: "English title 8",
      ai_summary: "English summary 8.",
      language_code: "en",
      requested_language_code: "ja",
      translation_available: false,
    });
  });
});
