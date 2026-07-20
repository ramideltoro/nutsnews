import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getArticleById: vi.fn(),
  getRecentArticleSitemapItems: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
}));

vi.mock("next/link", () => ({
  default: "a",
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/app/components/SiteFooter", () => ({
  SiteFooter: () => null,
}));

vi.mock("@/app/components/OptimizedArticleImage", () => ({
  OptimizedArticleImage: () => null,
}));

vi.mock("@/lib/articles", () => ({
  SITE_URL: "https://www.nutsnews.com",
  getArticleById: mocks.getArticleById,
  getRecentArticleSitemapItems: mocks.getRecentArticleSitemapItems,
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

beforeEach(() => {
  vi.resetModules();
  mocks.getArticleById.mockResolvedValue(localizedArticle);
  mocks.getRecentArticleSitemapItems.mockResolvedValue([]);
  mocks.notFound.mockClear();
});

describe("article detail language routing", () => {
  it("passes the normalized query language into metadata article lookup", async () => {
    const { generateMetadata } = await import("@/app/articles/[id]/page");

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "detail-1" }),
      searchParams: Promise.resolve({ lang: "fr" }),
    });

    expect(mocks.getArticleById).toHaveBeenCalledWith("detail-1", "fr");
    expect(metadata.title).toBe("Titre detail francais");
  });

  it("passes array query language aliases into page article lookup", async () => {
    const { default: ArticlePage } = await import("@/app/articles/[id]/page");

    await ArticlePage({
      params: Promise.resolve({ id: "detail-1" }),
      searchParams: Promise.resolve({ languageCode: ["ja"] }),
    });

    expect(mocks.getArticleById).toHaveBeenCalledWith("detail-1", "ja");
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
