import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getHomeFeedFromSnapshot: vi.fn(),
  getPublishedArticles: vi.fn(),
  getPublishedArticlesForSection: vi.fn(),
  logWarn: vi.fn(),
}));
const ORIGINAL_RUNTIME_ENV = process.env.NUTSNEWS_RUNTIME_ENV;
const ORIGINAL_SIDE_EFFECTS_MODE = process.env.NUTSNEWS_SIDE_EFFECTS_MODE;

vi.mock("@/lib/articles", () => ({
  CATEGORY_SECTION_SIZE: 8,
  HOME_FEED_SECTIONS: [{ id: "science", query: "science" }],
  PAGE_SIZE: 5,
  getHomeFeedFromSnapshot: mocks.getHomeFeedFromSnapshot,
  getPublishedArticles: mocks.getPublishedArticles,
  getPublishedArticlesForSection: mocks.getPublishedArticlesForSection,
}));

vi.mock("@/lib/logger", () => ({
  logWarn: mocks.logWarn,
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

function publishedResult(overrides: Record<string, unknown> = {}) {
  return {
    articles: [edgeArticle],
    nextPage: null,
    nextCursor: null,
    dataSource: "public_feed_snapshot",
    languageCode: "fr",
    edgeSnapshot: null,
    ...overrides,
  };
}

function restoreOptionalEnv(name: string, value: string | undefined) {
  if (typeof value === "string") {
    process.env[name] = value;
  } else {
    delete process.env[name];
  }
}

beforeEach(() => {
  vi.resetModules();
  mocks.fetch.mockReset();
  mocks.getHomeFeedFromSnapshot.mockReset();
  mocks.getPublishedArticles.mockReset();
  mocks.getPublishedArticlesForSection.mockReset();
  mocks.logWarn.mockReset();
  process.env.NUTSNEWS_EDGE_FEED_SNAPSHOT_URL = "https://edge.example";
  globalThis.fetch = mocks.fetch;
});

afterEach(() => {
  delete process.env.NUTSNEWS_EDGE_FEED_SNAPSHOT_URL;
  delete process.env.NUTSNEWS_EDGE_SNAPSHOT_URL;
  restoreOptionalEnv("NUTSNEWS_RUNTIME_ENV", ORIGINAL_RUNTIME_ENV);
  restoreOptionalEnv("NUTSNEWS_SIDE_EFFECTS_MODE", ORIGINAL_SIDE_EFFECTS_MODE);
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

  it("uses the production edge snapshot endpoint when no override is configured", async () => {
    delete process.env.NUTSNEWS_EDGE_FEED_SNAPSHOT_URL;
    process.env.NUTSNEWS_RUNTIME_ENV = "production";
    process.env.NUTSNEWS_SIDE_EFFECTS_MODE = "live";

    const localizedArticle = {
      ...edgeArticle,
      title: "Titre francais de production",
      ai_summary: "Resume francais de production.",
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
      page: 0,
      requestedLanguageCode: "fr",
    });

    expect(result?.dataSource).toBe("edge_feed_snapshot");
    expect(result?.articles).toEqual([
      expect.objectContaining({
        title: "Titre francais de production",
        language_code: "fr",
        requested_language_code: "fr",
        translation_available: true,
      }),
    ]);

    const requestedUrl = new URL(String(mocks.fetch.mock.calls[0]?.[0]));
    expect(requestedUrl.origin).toBe("https://nutsnews-worker-0.nutsnews.workers.dev");
    expect(requestedUrl.pathname).toBe("/public-feed-snapshot");
    expect(requestedUrl.searchParams.get("lang")).toBe("fr");
  });
});

describe("localized edge snapshot preference", () => {
  it("prefers a localized edge snapshot over a stale non-English public feed page", async () => {
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
    mocks.getPublishedArticles.mockResolvedValueOnce(
      publishedResult({
        articles: [
          {
            ...edgeArticle,
            language_code: "en",
            requested_language_code: "fr",
            translation_available: false,
          },
        ],
      }),
    );

    const { getPublishedArticlesWithEdgeFallback } = await import("@/lib/edgeFeedSnapshot");
    const result = await getPublishedArticlesWithEdgeFallback(0, null, "fr");

    expect(result).toMatchObject({
      dataSource: "edge_feed_snapshot",
      languageCode: "fr",
      articles: [
        {
          title: "Titre francais de bord",
          ai_summary: "Resume francais de bord.",
          language_code: "fr",
          requested_language_code: "fr",
          translation_available: true,
        },
      ],
    });
    expect(mocks.getPublishedArticles).not.toHaveBeenCalled();
  });

  it("keeps the existing public feed path when edge lacks usable translations", async () => {
    const localArticle = {
      ...edgeArticle,
      title: "Titre francais local",
      ai_summary: "Resume francais local.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    };
    mocks.fetch.mockResolvedValueOnce(
      edgeResponse({
        articles: [edgeArticle],
        nextPage: null,
        dataSource: "edge_feed_snapshot",
        languageCode: "en",
      }),
    );
    mocks.getPublishedArticles.mockResolvedValueOnce(
      publishedResult({
        articles: [localArticle],
        languageCode: "fr",
      }),
    );

    const { getPublishedArticlesWithEdgeFallback } = await import("@/lib/edgeFeedSnapshot");
    const result = await getPublishedArticlesWithEdgeFallback(0, null, "fr");

    expect(result).toMatchObject({
      dataSource: "public_feed_snapshot",
      languageCode: "fr",
      articles: [
        {
          title: "Titre francais local",
          ai_summary: "Resume francais local.",
          language_code: "fr",
          requested_language_code: "fr",
          translation_available: true,
        },
      ],
    });
    expect(mocks.getPublishedArticles).toHaveBeenCalledWith(0, null, "fr");
  });

  it("prefers localized edge rows for category section reads", async () => {
    const localizedArticle = {
      ...edgeArticle,
      title: "Article scientifique francais",
      ai_summary: "Resume scientifique francais.",
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

    const { getPublishedArticlesForSectionWithEdgeFallback } = await import("@/lib/edgeFeedSnapshot");
    const articles = await getPublishedArticlesForSectionWithEdgeFallback("science", "fr", 8);

    expect(articles).toEqual([
      expect.objectContaining({
        title: "Article scientifique francais",
        ai_summary: "Resume scientifique francais.",
        language_code: "fr",
        requested_language_code: "fr",
        translation_available: true,
      }),
    ]);
    expect(mocks.getPublishedArticlesForSection).not.toHaveBeenCalled();

    const requestedUrl = new URL(String(mocks.fetch.mock.calls[0]?.[0]));
    expect(requestedUrl.searchParams.get("category")).toBe("science");
    expect(requestedUrl.searchParams.get("pageSize")).toBe("8");
    expect(requestedUrl.searchParams.get("lang")).toBe("fr");
  });

  it("prefers localized edge rows for home feed before using the local snapshot", async () => {
    const localizedMainArticle = {
      ...edgeArticle,
      title: "Accueil francais de bord",
      ai_summary: "Resume d'accueil francais.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    };
    const localizedSectionArticle = {
      ...edgeArticle,
      id: "edge-article-2",
      title: "Science francaise de bord",
      original_url: "https://example.test/edge-article-2",
      ai_summary: "Resume de science francais.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    };
    mocks.fetch
      .mockResolvedValueOnce(
        edgeResponse({
          articles: [localizedMainArticle],
          nextPage: null,
          dataSource: "edge_feed_snapshot",
          languageCode: "fr",
        }),
      )
      .mockResolvedValueOnce(
        edgeResponse({
          articles: [localizedSectionArticle],
          nextPage: null,
          dataSource: "edge_feed_snapshot",
          languageCode: "fr",
        }),
      );
    mocks.getHomeFeedFromSnapshot.mockResolvedValueOnce(
      publishedResult({
        articles: [
          {
            ...edgeArticle,
            language_code: "en",
            requested_language_code: "fr",
            translation_available: false,
          },
        ],
        sections: [{ id: "science", articles: [] }],
      }),
    );

    const { getHomeFeedDataWithEdgeFallback } = await import("@/lib/edgeFeedSnapshot");
    const result = await getHomeFeedDataWithEdgeFallback("fr");

    expect(result).toMatchObject({
      dataSource: "edge_feed_snapshot",
      languageCode: "fr",
      degradation: {
        mode: "degraded",
        reason: "localized_edge_snapshot_preferred",
      },
      articles: [
        {
          title: "Accueil francais de bord",
          ai_summary: "Resume d'accueil francais.",
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
              title: "Science francaise de bord",
              ai_summary: "Resume de science francais.",
              language_code: "fr",
              requested_language_code: "fr",
              translation_available: true,
            },
          ],
        },
      ],
    });
    expect(mocks.getHomeFeedFromSnapshot).not.toHaveBeenCalled();
  });
});
