import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock("@/lib/articles", () => ({
  CATEGORY_SECTION_SIZE: 8,
  HOME_FEED_SECTIONS: [],
  PAGE_SIZE: 5,
  getHomeFeedFromSnapshot: vi.fn(),
  getPublishedArticles: vi.fn(),
  getPublishedArticlesForSection: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logWarn: vi.fn(),
}));

const edgeArticle = {
  id: "edge-article-1",
  source: "Edge fixture",
  title: "English edge title",
  original_url: "https://example.test/edge-article-1",
  image_url: "https://example.test/edge.jpg",
  published_at: "2026-07-16T00:00:00.000Z",
  published_on_site_at: "2026-07-16T00:00:00.000Z",
  ai_summary: "English edge summary.",
  category: "science",
  positivity_score: 0.92,
};

function edgeResponse(payload: Record<string, unknown>) {
  return Response.json(payload, {
    headers: {
      "X-NutsNews-Edge-Snapshot-Updated-At": "2026-07-16T00:00:00.000Z",
      "X-NutsNews-Edge-Snapshot-Age-Seconds": "30",
      "X-NutsNews-Edge-Snapshot-Article-Count": "1",
      "X-NutsNews-Edge-Snapshot-Version": "4",
    },
  });
}

beforeEach(() => {
  vi.resetModules();
  process.env.NUTSNEWS_EDGE_FEED_SNAPSHOT_URL = "https://edge.example";
  globalThis.fetch = mocks.fetch;
});

afterEach(() => {
  delete process.env.NUTSNEWS_EDGE_FEED_SNAPSHOT_URL;
  delete process.env.NUTSNEWS_EDGE_SNAPSHOT_URL;
  vi.restoreAllMocks();
});

describe("getEdgeFeedSnapshotPage", () => {
  it("forwards the requested language and preserves localized edge article metadata", async () => {
    const localizedArticle = {
      ...edgeArticle,
      title: "Titre francais de bord",
      ai_summary: "Resume francais de bord.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    };

    mocks.fetch.mockResolvedValueOnce(
      edgeResponse({
        articles: [localizedArticle],
        nextPage: null,
        dataSource: "edge_feed_snapshot",
        languageCode: "fr",
      }),
    );

    const { getEdgeFeedSnapshotPage } = await import("@/lib/edgeFeedSnapshot");
    const result = await getEdgeFeedSnapshotPage({
      page: 2,
      category: "Science",
      pageSize: 10,
      requestedLanguageCode: "fr",
    });

    expect(result).not.toBeNull();
    expect(mocks.fetch).toHaveBeenCalledOnce();

    const requestedUrl = new URL(String(mocks.fetch.mock.calls[0]?.[0]));
    expect(requestedUrl.pathname).toBe("/public-feed-snapshot");
    expect(requestedUrl.searchParams.get("page")).toBe("2");
    expect(requestedUrl.searchParams.get("pageSize")).toBe("10");
    expect(requestedUrl.searchParams.get("category")).toBe("Science");
    expect(requestedUrl.searchParams.get("lang")).toBe("fr");

    expect(result?.dataSource).toBe("edge_feed_snapshot");
    expect(result?.languageCode).toBe("fr");
    expect(result?.articles).toEqual([
      expect.objectContaining({
        title: "Titre francais de bord",
        ai_summary: "Resume francais de bord.",
        language_code: "fr",
        requested_language_code: "fr",
        translation_available: true,
      }),
    ]);
  });

  it("marks missing edge translations as explicit English fallback", async () => {
    mocks.fetch.mockResolvedValueOnce(
      edgeResponse({
        articles: [edgeArticle],
        nextPage: null,
        dataSource: "edge_feed_snapshot",
        languageCode: "en",
      }),
    );

    const { getEdgeFeedSnapshotPage } = await import("@/lib/edgeFeedSnapshot");
    const result = await getEdgeFeedSnapshotPage({
      page: 0,
      requestedLanguageCode: "fr",
    });

    expect(result).not.toBeNull();

    const requestedUrl = new URL(String(mocks.fetch.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get("lang")).toBe("fr");
    expect(result?.articles).toEqual([
      expect.objectContaining({
        title: "English edge title",
        ai_summary: "English edge summary.",
        language_code: "en",
        requested_language_code: "fr",
        translation_available: false,
      }),
    ]);
  });
});
