import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getArticleById: vi.fn(),
  logError: vi.fn(),
  logInfoSampled: vi.fn(),
}));

vi.mock("@/lib/articles", () => ({
  getArticleById: mocks.getArticleById,
}));

vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
  logInfoSampled: mocks.logInfoSampled,
}));

const localizedArticle = {
  id: "detail-1",
  source: "Fixture Source",
  title: "Titre detail francais",
  original_url: "https://example.test/detail-1",
  image_url: "https://example.test/detail-1.jpg",
  published_at: "2026-07-20T12:00:00.000Z",
  published_on_site_at: "2026-07-20T12:00:00.000Z",
  ai_summary: "Resume detail francais.",
  category: "community",
  positivity_score: 0.95,
  language_code: "fr",
  requested_language_code: "fr",
  translation_available: true,
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
  mocks.getArticleById.mockReset();
  mocks.logError.mockReset();
  mocks.logInfoSampled.mockReset();
  mocks.getArticleById.mockResolvedValue(localizedArticle);
});

describe("localized article detail API", () => {
  it("returns a localized public article detail shape with public cache headers", async () => {
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
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(response.headers.get("cdn-cache-control")).toContain("s-maxage=3600");
    expect(response.headers.get("x-nutsnews-cache-policy")).toBe("public-api-cache-3600s");
    expect(response.headers.get("x-nutsnews-article-fields")).toBe("detail");
    expect(response.headers.get("x-nutsnews-article-language")).toBe("fr");
    expect(response.headers.get("x-nutsnews-article-resolved-language")).toBe("fr");
    expect(response.headers.get("x-nutsnews-article-translation-available")).toBe("true");
    expect(mocks.getArticleById).toHaveBeenCalledWith("detail-1", "fr");
  });

  it("normalizes unsupported language requests to English", async () => {
    const englishArticle = {
      ...localizedArticle,
      title: "English detail title",
      ai_summary: "English detail summary.",
      language_code: "en",
      requested_language_code: "en",
      translation_available: true,
    };
    mocks.getArticleById.mockResolvedValueOnce(englishArticle);
    const { GET } = await import("@/app/api/articles/[id]/route");

    const response = await GET(
      request("https://www.nutsnews.com/api/articles/detail-1?lang=zz"),
      context("detail-1"),
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      title: "English detail title",
      ai_summary: "English detail summary.",
      language_code: "en",
      requested_language_code: "en",
      translation_available: true,
    });
    expect(response.headers.get("x-nutsnews-article-language")).toBe("en");
    expect(response.headers.get("x-nutsnews-article-resolved-language")).toBe("en");
    expect(mocks.getArticleById).toHaveBeenCalledWith("detail-1", "en");
  });

  it("returns no-store 404 for missing or unpublished articles", async () => {
    mocks.getArticleById.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/articles/[id]/route");

    const response = await GET(
      request("https://www.nutsnews.com/api/articles/missing?lang=fr"),
      context("missing"),
    );
    const body = await json(response);

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Article not found" });
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("x-nutsnews-cache-policy")).toBe("bypass-cache");
    expect(mocks.getArticleById).toHaveBeenCalledWith("missing", "fr");
  });
});
