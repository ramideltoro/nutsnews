import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  snapshotRows: [] as Array<Record<string, unknown>>,
  summaryRows: [] as Array<Record<string, unknown>>,
  logWarn: vi.fn(),
  validateTranslatedSummary: vi.fn(() => ({ usable: true, warnings: [] })),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/backendDatabase", () => ({
  callBackendDatabaseOperation: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logWarn: mocks.logWarn,
}));

vi.mock("@/lib/runtimeSafety", () => ({
  getDatabaseProviderMode: () => "supabase_primary",
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
  mocks.snapshotRows = Array.from({ length: 6 }, (_, index) => snapshotArticle(index + 1));
  mocks.summaryRows = [];
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
