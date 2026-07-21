import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getHomeFeedFromSnapshot: vi.fn(),
  getPublishedArticles: vi.fn(),
  getPublishedArticlesByCursor: vi.fn(),
  getPublishedArticlesForSection: vi.fn(),
  logError: vi.fn(),
  logInfoSampled: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("@/lib/articles", () => ({
  CATEGORY_SECTION_SIZE: 8,
  CURSOR_PAGE_SIZE: 15,
  HOME_FEED_SECTIONS: [{ id: "science", query: "science" }],
  PAGE_SIZE: 5,
  getHomeFeedFromSnapshot: mocks.getHomeFeedFromSnapshot,
  getPublishedArticles: mocks.getPublishedArticles,
  getPublishedArticlesByCursor: mocks.getPublishedArticlesByCursor,
  getPublishedArticlesForSection: mocks.getPublishedArticlesForSection,
}));

vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
  logInfoSampled: mocks.logInfoSampled,
  logWarn: mocks.logWarn,
}));

const englishArticle = {
  id: "article-1",
  source: "Fixture Source",
  title: "English title",
  original_url: "https://example.test/article-1",
  image_url: "https://example.test/image-1.jpg",
  published_at: "2026-07-20T12:00:00.000Z",
  published_on_site_at: "2026-07-20T12:00:00.000Z",
  ai_summary: "English summary.",
  category: "science",
  positivity_score: 0.95,
  language_code: "en",
  requested_language_code: "fr",
  translation_available: false,
};

const localizedArticle = {
  ...englishArticle,
  title: "Titre francais depuis le bord",
  ai_summary: "Resume francais depuis le bord.",
  language_code: "fr",
  requested_language_code: "fr",
  translation_available: true,
};

const localizedSectionArticle = {
  ...localizedArticle,
  id: "article-2",
  title: "Article scientifique francais",
  original_url: "https://example.test/article-2",
  ai_summary: "Resume scientifique francais.",
};

function request(url: string) {
  return new Request(url);
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function edgeResponse(payload: Record<string, unknown>, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "X-NutsNews-Edge-Snapshot-Updated-At": "2026-07-20T12:00:00.000Z",
      "X-NutsNews-Edge-Snapshot-Age-Seconds": "45",
      "X-NutsNews-Edge-Snapshot-Article-Count": "1",
      "X-NutsNews-Edge-Snapshot-Version": "4",
    },
  });
}

function edgePayload(articles: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    articles,
    nextPage: null,
    dataSource: "edge_feed_snapshot",
    languageCode: "fr",
    ...overrides,
  };
}

function publicSnapshotResult(overrides: Record<string, unknown> = {}) {
  return {
    articles: [englishArticle],
    nextPage: null,
    nextCursor: null,
    dataSource: "public_feed_snapshot",
    languageCode: "fr",
    edgeSnapshot: null,
    ...overrides,
  };
}

function homeSnapshotResult(overrides: Record<string, unknown> = {}) {
  return {
    ...publicSnapshotResult(),
    sections: [{ id: "science", articles: [englishArticle] }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
  mocks.fetch.mockReset();
  mocks.getHomeFeedFromSnapshot.mockReset();
  mocks.getPublishedArticles.mockReset();
  mocks.getPublishedArticlesByCursor.mockReset();
  mocks.getPublishedArticlesForSection.mockReset();
  mocks.logError.mockReset();
  mocks.logInfoSampled.mockReset();
  mocks.logWarn.mockReset();
  process.env.NUTSNEWS_EDGE_FEED_SNAPSHOT_URL = "https://edge.example";
  globalThis.fetch = mocks.fetch;
});

afterEach(() => {
  delete process.env.NUTSNEWS_EDGE_FEED_SNAPSHOT_URL;
  delete process.env.NUTSNEWS_EDGE_SNAPSHOT_URL;
  vi.restoreAllMocks();
});

describe("/api/articles localized edge preference", () => {
  it("prefers localized edge data for non-English home feeds with localized category sections", async () => {
    mocks.fetch
      .mockResolvedValueOnce(edgeResponse(edgePayload([localizedArticle])))
      .mockResolvedValueOnce(edgeResponse(edgePayload([localizedSectionArticle])));
    mocks.getHomeFeedFromSnapshot.mockResolvedValueOnce(homeSnapshotResult());

    const { GET } = await import("@/app/api/articles/route");
    const response = await GET(request("https://www.nutsnews.com/api/articles?home=1&lang=fr"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-nutsnews-article-data-source")).toBe("edge_feed_snapshot");
    expect(response.headers.get("x-nutsnews-feed-snapshot")).toBe("edge-fallback");
    expect(response.headers.get("x-nutsnews-article-language")).toBe("fr");
    expect(response.headers.get("x-nutsnews-degradation-reason")).toBe("localized_edge_snapshot_preferred");
    expect(body).toMatchObject({
      dataSource: "edge_feed_snapshot",
      languageCode: "fr",
      articles: [
        {
          title: "Titre francais depuis le bord",
          ai_summary: "Resume francais depuis le bord.",
          language_code: "fr",
          requested_language_code: "fr",
          translation_available: true,
        },
      ],
      sections: [
        {
          id: "science",
          articles: [
            {
              title: "Article scientifique francais",
              ai_summary: "Resume scientifique francais.",
              language_code: "fr",
              requested_language_code: "fr",
              translation_available: true,
            },
          ],
        },
      ],
    });
    expect(mocks.getHomeFeedFromSnapshot).not.toHaveBeenCalled();

    const mainUrl = new URL(String(mocks.fetch.mock.calls[0]?.[0]));
    const sectionUrl = new URL(String(mocks.fetch.mock.calls[1]?.[0]));
    expect(mainUrl.searchParams.get("lang")).toBe("fr");
    expect(mainUrl.searchParams.get("page")).toBe("0");
    expect(sectionUrl.searchParams.get("lang")).toBe("fr");
    expect(sectionUrl.searchParams.get("category")).toBe("science");
    expect(sectionUrl.searchParams.get("pageSize")).toBe("8");
  });

  it("prefers localized edge data for non-English offset and category pages", async () => {
    mocks.fetch.mockResolvedValueOnce(
      edgeResponse(edgePayload([localizedArticle], { nextPage: 3 })),
    );
    mocks.getPublishedArticles.mockResolvedValueOnce(publicSnapshotResult());

    const { GET } = await import("@/app/api/articles/route");
    const response = await GET(
      request("https://www.nutsnews.com/api/articles?page=2&category=science&lang=fr"),
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-nutsnews-article-data-source")).toBe("edge_feed_snapshot");
    expect(response.headers.get("x-nutsnews-article-pagination")).toBe("offset");
    expect(body).toMatchObject({
      dataSource: "edge_feed_snapshot",
      languageCode: "fr",
      nextPage: 3,
      articles: [
        {
          title: "Titre francais depuis le bord",
          ai_summary: "Resume francais depuis le bord.",
          language_code: "fr",
          requested_language_code: "fr",
          translation_available: true,
        },
      ],
    });
    expect(mocks.getPublishedArticles).not.toHaveBeenCalled();

    const requestedUrl = new URL(String(mocks.fetch.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get("page")).toBe("2");
    expect(requestedUrl.searchParams.get("pageSize")).toBe("5");
    expect(requestedUrl.searchParams.get("category")).toBe("science");
    expect(requestedUrl.searchParams.get("lang")).toBe("fr");
  });

  it.each([
    ["unavailable", () => new Response("edge unavailable", { status: 503 })],
    ["empty", () => edgeResponse(edgePayload([]))],
    ["missing usable translations", () => edgeResponse(edgePayload([englishArticle]))],
  ])("keeps English home-feed fallback when edge is %s", async (_label, responseFactory) => {
    mocks.fetch.mockResolvedValueOnce(responseFactory());
    mocks.getHomeFeedFromSnapshot.mockResolvedValueOnce(homeSnapshotResult());

    const { GET } = await import("@/app/api/articles/route");
    const response = await GET(request("https://www.nutsnews.com/api/articles?home=1&lang=fr"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-nutsnews-article-data-source")).toBe("public_feed_snapshot");
    expect(response.headers.get("x-nutsnews-feed-snapshot")).toBe("hit");
    expect(response.headers.get("x-nutsnews-article-language")).toBe("fr");
    expect(body).toMatchObject({
      dataSource: "public_feed_snapshot",
      languageCode: "fr",
      articles: [
        {
          title: "English title",
          ai_summary: "English summary.",
          language_code: "en",
          requested_language_code: "fr",
          translation_available: false,
        },
      ],
    });
    expect(mocks.getHomeFeedFromSnapshot).toHaveBeenCalledWith("fr");
  });
});
