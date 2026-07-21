import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  articleRows: [] as Array<Record<string, unknown>>,
  summaryRows: [] as Array<Record<string, unknown>>,
  callBackendDatabaseOperation: vi.fn(),
  logError: vi.fn(),
  logInfoSampled: vi.fn(),
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
  logError: mocks.logError,
  logInfoSampled: mocks.logInfoSampled,
  logWarn: mocks.logWarn,
}));

vi.mock("@/lib/runtimeSafety", () => ({
  getDatabaseProviderMode: () => "supabase_primary",
}));

vi.mock("@/lib/translationQuality", () => ({
  validateTranslatedSummary: mocks.validateTranslatedSummary,
}));

vi.mock("@/lib/supabase", () => {
  class ArticleDetailQuery {
    private id: string | null = null;
    private status: string | null = null;

    select() {
      return this;
    }

    eq(column: string, value: string) {
      if (column === "id") {
        this.id = value;
      }
      if (column === "status") {
        this.status = value;
      }

      return this;
    }

    not() {
      return this;
    }

    neq() {
      return this;
    }

    single() {
      const row = mocks.articleRows.find(
        (article) =>
          article.id === this.id &&
          article.status === this.status &&
          article.image_url !== null &&
          article.image_url !== "",
      );

      if (!row) {
        return Promise.resolve({
          data: null,
          error: { code: "PGRST116", message: "No rows returned" },
        });
      }

      return Promise.resolve({ data: row, error: null });
    }
  }

  class SummaryQuery {
    private languageCode = "en";

    select() {
      return this;
    }

    eq(column: string, value: string) {
      if (column === "language_code") {
        this.languageCode = value;
      }

      return this;
    }

    in(column: string, originalUrls: string[]) {
      if (column !== "original_url") {
        throw new Error(`Unexpected article_summaries lookup column ${column}`);
      }

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
        if (table === "articles") {
          return new ArticleDetailQuery();
        }

        if (table === "article_summaries") {
          return new SummaryQuery();
        }

        throw new Error(`Unexpected Supabase table ${table}`);
      },
    }),
  };
});

const baseArticle = {
  id: "detail-1",
  status: "published",
  source: "Fixture Source",
  title: "English detail title",
  original_url: "https://example.test/detail-1",
  image_url: "https://example.test/detail-1.jpg",
  published_at: "2026-07-20T12:00:00.000Z",
  published_on_site_at: "2026-07-20T12:00:00.000Z",
  ai_summary: "English detail summary.",
  category: "community",
  positivity_score: 0.95,
};

function request(url: string) {
  return new Request(url);
}

function context(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.resetModules();
  mocks.articleRows = [{ ...baseArticle }];
  mocks.summaryRows = [];
  mocks.callBackendDatabaseOperation.mockReset();
  mocks.logError.mockReset();
  mocks.logInfoSampled.mockReset();
  mocks.logWarn.mockReset();
  mocks.validateTranslatedSummary.mockClear();
  mocks.validateTranslatedSummary.mockReturnValue({ usable: true, warnings: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("localized article detail API with article_summaries", () => {
  it("returns translated detail text and localization metadata when a usable summary row exists", async () => {
    mocks.summaryRows = [
      {
        original_url: "https://example.test/detail-1",
        language_code: "fr",
        title: "Titre detail francais",
        summary: "Resume detail francais.",
      },
    ];

    const { GET } = await import("@/app/api/articles/[id]/route");
    const response = await GET(
      request("https://www.nutsnews.com/api/articles/detail-1?lang=fr"),
      context("detail-1"),
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: "detail-1",
      title: "Titre detail francais",
      ai_summary: "Resume detail francais.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    });
    expect(response.headers.get("x-nutsnews-article-language")).toBe("fr");
    expect(response.headers.get("x-nutsnews-article-resolved-language")).toBe("fr");
    expect(response.headers.get("x-nutsnews-article-translation-available")).toBe("true");
    expect(mocks.validateTranslatedSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        language_code: "fr",
        title: "Titre detail francais",
        summary: "Resume detail francais.",
        sourceTitle: "English detail title",
        sourceSummary: "English detail summary.",
      }),
      "fr",
    );
  });

  it("returns explicit English fallback metadata when the requested translation row is missing", async () => {
    const { GET } = await import("@/app/api/articles/[id]/route");
    const response = await GET(
      request("https://www.nutsnews.com/api/articles/detail-1?lang=ja"),
      context("detail-1"),
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: "detail-1",
      title: "English detail title",
      ai_summary: "English detail summary.",
      language_code: "en",
      requested_language_code: "ja",
      translation_available: false,
    });
    expect(response.headers.get("x-nutsnews-article-language")).toBe("ja");
    expect(response.headers.get("x-nutsnews-article-resolved-language")).toBe("en");
    expect(response.headers.get("x-nutsnews-article-translation-available")).toBe("false");
    expect(mocks.validateTranslatedSummary).not.toHaveBeenCalled();
  });

  it("returns explicit English fallback metadata when translation quality checks fail", async () => {
    mocks.summaryRows = [
      {
        original_url: "https://example.test/detail-1",
        language_code: "de",
        title: "",
        summary: "English detail summary.",
      },
    ];
    mocks.validateTranslatedSummary.mockReturnValueOnce({
      usable: false,
      warnings: [{ code: "missing_title" }],
    });

    const { GET } = await import("@/app/api/articles/[id]/route");
    const response = await GET(
      request("https://www.nutsnews.com/api/articles/detail-1?lang=de"),
      context("detail-1"),
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: "detail-1",
      title: "English detail title",
      ai_summary: "English detail summary.",
      language_code: "en",
      requested_language_code: "de",
      translation_available: false,
    });
    expect(response.headers.get("x-nutsnews-article-language")).toBe("de");
    expect(response.headers.get("x-nutsnews-article-resolved-language")).toBe("en");
    expect(response.headers.get("x-nutsnews-article-translation-available")).toBe("false");
    expect(mocks.validateTranslatedSummary).toHaveBeenCalledOnce();
  });

  it("normalizes malformed language input to English", async () => {
    const { GET } = await import("@/app/api/articles/[id]/route");
    const response = await GET(
      request("https://www.nutsnews.com/api/articles/detail-1?lang=zz"),
      context("detail-1"),
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: "detail-1",
      title: "English detail title",
      ai_summary: "English detail summary.",
      language_code: "en",
      requested_language_code: "en",
      translation_available: true,
    });
    expect(response.headers.get("x-nutsnews-article-language")).toBe("en");
    expect(response.headers.get("x-nutsnews-article-resolved-language")).toBe("en");
    expect(response.headers.get("x-nutsnews-article-translation-available")).toBe("true");
  });

  it("returns no-store 404 responses for missing and unpublished article IDs", async () => {
    mocks.articleRows = [
      {
        ...baseArticle,
        id: "unpublished",
        status: "draft",
      },
    ];

    const { GET } = await import("@/app/api/articles/[id]/route");

    for (const articleId of ["missing", "unpublished"]) {
      const response = await GET(
        request(`https://www.nutsnews.com/api/articles/${articleId}?lang=fr`),
        context(articleId),
      );
      const body = await json(response);

      expect(response.status).toBe(404);
      expect(body).toEqual({ error: "Article not found" });
      expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
      expect(response.headers.get("x-nutsnews-cache-policy")).toBe("bypass-cache");
    }
  });
});
