import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockRuntimeSafetyError extends Error {
    code: string;

    constructor(code: string, message = "Runtime safety policy refused this operation.") {
      super(message);
      this.name = "RuntimeSafetyError";
      this.code = code;
    }
  }

  return {
    authGet: vi.fn(),
    authPost: vi.fn(),
    assertExternalSideEffect: vi.fn(),
    assertOAuthCallback: vi.fn(),
    createMaintenanceHomeFeedPayload: vi.fn(),
    getEdgeFeedSnapshotPage: vi.fn(),
    getHomeFeedDataWithEdgeFallback: vi.fn(),
    getPublishedArticlesByCursor: vi.fn(),
    getPublishedArticlesWithEdgeFallback: vi.fn(),
    getRuntimePublicConfig: vi.fn(),
    isRuntimeFeatureFlagEnabled: vi.fn(),
    logError: vi.fn(),
    logInfoSampled: vi.fn(),
    logWarn: vi.fn(),
    recordQuotaUsageEvent: vi.fn(),
    runtimeSafetyError: MockRuntimeSafetyError,
    searchPublishedArticles: vi.fn(),
  };
});

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();

  return {
    ...actual,
    connection: vi.fn(),
  };
});

vi.mock("@/auth", () => ({
  handlers: {
    GET: mocks.authGet,
    POST: mocks.authPost,
  },
}));

vi.mock("@/lib/articles", () => ({
  CURSOR_PAGE_SIZE: 15,
  PAGE_SIZE: 5,
  SEARCH_PAGE_SIZE: 20,
  getPublishedArticlesByCursor: mocks.getPublishedArticlesByCursor,
  searchPublishedArticles: mocks.searchPublishedArticles,
}));

vi.mock("@/lib/edgeFeedSnapshot", () => ({
  createMaintenanceHomeFeedPayload: mocks.createMaintenanceHomeFeedPayload,
  getEdgeFeedSnapshotPage: mocks.getEdgeFeedSnapshotPage,
  getHomeFeedDataWithEdgeFallback: mocks.getHomeFeedDataWithEdgeFallback,
  getPublishedArticlesWithEdgeFallback: mocks.getPublishedArticlesWithEdgeFallback,
}));

vi.mock("@/lib/logger", () => ({
  logError: mocks.logError,
  logInfoSampled: mocks.logInfoSampled,
  logWarn: mocks.logWarn,
}));

vi.mock("@/lib/quotaUsage", () => ({
  recordQuotaUsageEvent: mocks.recordQuotaUsageEvent,
}));

vi.mock("@/lib/runtimeFeatureFlags", () => ({
  isRuntimeFeatureFlagEnabled: mocks.isRuntimeFeatureFlagEnabled,
}));

vi.mock("@/lib/runtimePublicConfig", () => ({
  getRuntimePublicConfig: mocks.getRuntimePublicConfig,
}));

vi.mock("@/lib/runtimeSafety", () => ({
  RuntimeSafetyError: mocks.runtimeSafetyError,
  assertExternalSideEffect: mocks.assertExternalSideEffect,
  assertOAuthCallback: mocks.assertOAuthCallback,
}));

type JsonValue = Record<string, unknown>;

const article = {
  id: "article-1",
  source: "fixture",
  title: "Local fixture",
  original_url: "https://example.test/article-1",
  image_url: "https://example.test/image.jpg",
  published_at: "2026-07-16T00:00:00.000Z",
  published_on_site_at: "2026-07-16T00:00:00.000Z",
  ai_summary: "A concise fixture summary.",
  category: "community",
  positivity_score: 0.91,
  language_code: "en",
  requested_language_code: "en",
  translation_available: true,
};

function publicArticlesResult(overrides: JsonValue = {}) {
  return {
    articles: [article],
    nextPage: null,
    nextCursor: null,
    dataSource: "public_feed_snapshot",
    languageCode: "en",
    edgeSnapshot: null,
    ...overrides,
  };
}

function homeFeedResult(overrides: JsonValue = {}) {
  return {
    ...publicArticlesResult(),
    sections: [{ id: "community", articles: [article] }],
    ...overrides,
  };
}

function maintenanceHomeFeedResult(overrides: JsonValue = {}) {
  return homeFeedResult({
    articles: [],
    nextPage: null,
    nextCursor: null,
    dataSource: "articles_fallback",
    sections: [{ id: "community", articles: [] }],
    degradation: {
      mode: "maintenance",
      reason: "home_feed_exception",
      message: "NutsNews is showing a maintenance state while the public feed dependencies recover.",
      services: {
        supabase: "unavailable",
        edgeSnapshot: "unavailable",
        worker: "unknown",
        localAi: "unknown",
        translations: "unknown",
      },
      loggedAt: "2026-07-16T00:00:00.000Z",
    },
    ...overrides,
  });
}

function request(url: string, init?: RequestInit) {
  return new Request(url, init);
}

async function json(response: Response) {
  return (await response.json()) as JsonValue;
}

beforeEach(() => {
  vi.resetModules();
  mocks.authGet.mockResolvedValue(Response.json({ ok: true, method: "GET" }));
  mocks.authPost.mockResolvedValue(Response.json({ ok: true, method: "POST" }));
  mocks.assertExternalSideEffect.mockReturnValue(undefined);
  mocks.assertOAuthCallback.mockReturnValue(undefined);
  mocks.createMaintenanceHomeFeedPayload.mockImplementation(() => maintenanceHomeFeedResult());
  mocks.getEdgeFeedSnapshotPage.mockResolvedValue(null);
  mocks.getHomeFeedDataWithEdgeFallback.mockResolvedValue(homeFeedResult());
  mocks.getPublishedArticlesByCursor.mockResolvedValue(publicArticlesResult({ nextCursor: null }));
  mocks.getPublishedArticlesWithEdgeFallback.mockResolvedValue(publicArticlesResult());
  mocks.getRuntimePublicConfig.mockReturnValue({
    runtimeEnv: "staging",
    databaseProviderMode: "supabase_primary",
    productionWritesPaused: false,
    deploymentTarget: "test",
    supabaseUrl: "https://staging-fixture.supabase.co",
    supabaseAnonKey: null,
    turnstileSiteKey: null,
  });
  mocks.isRuntimeFeatureFlagEnabled.mockResolvedValue(true);
  mocks.searchPublishedArticles.mockResolvedValue({
    articles: [article],
    nextPage: null,
    query: "kind news",
    page: 0,
    pageSize: 20,
    languageCode: "en",
  });
});

describe("public article route handlers", () => {
  it("returns article list shape with explicit public cache headers", async () => {
    const { GET } = await import("@/app/api/articles/route");

    const response = await GET(request("https://www.nutsnews.com/api/articles?page=2&lang=fr"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      articles: [expect.objectContaining({ id: "article-1" })],
      nextPage: null,
      nextCursor: null,
      dataSource: "public_feed_snapshot",
      languageCode: "en",
    });
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(response.headers.get("cdn-cache-control")).toContain("s-maxage=3600");
    expect(response.headers.get("x-nutsnews-cache-policy")).toBe("public-api-cache-3600s");
    expect(response.headers.get("x-nutsnews-article-pagination")).toBe("offset");
    expect(response.headers.get("x-nutsnews-article-language")).toBe("fr");
    expect(mocks.getPublishedArticlesWithEdgeFallback).toHaveBeenCalledWith(2, null, "fr");
  });

  it("normalizes malformed article params and falls back to no-store on upstream failure", async () => {
    mocks.getPublishedArticlesWithEdgeFallback.mockRejectedValueOnce(new Error("fixture failure"));

    const { GET } = await import("@/app/api/articles/route");
    const response = await GET(request("https://www.nutsnews.com/api/articles?page=-10&lang=zz"));
    const body = await json(response);

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      articles: [],
      nextPage: null,
      nextCursor: null,
      error: "Failed to load articles",
    });
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("x-nutsnews-cache-policy")).toBe("bypass-cache");
    expect(mocks.getPublishedArticlesWithEdgeFallback).toHaveBeenCalledWith(0, null, "en");
  });

  it("returns localized edge fallback articles after an upstream article read failure", async () => {
    const localizedEdgeArticle = {
      ...article,
      title: "Titre de secours depuis le bord",
      ai_summary: "Resume de secours depuis le bord.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    };
    mocks.getPublishedArticlesWithEdgeFallback.mockRejectedValueOnce(new Error("fixture outage"));
    mocks.getEdgeFeedSnapshotPage.mockResolvedValueOnce(
      publicArticlesResult({
        articles: [localizedEdgeArticle],
        dataSource: "edge_feed_snapshot",
        languageCode: "fr",
        edgeSnapshot: {
          status: "hit",
          updatedAt: "2026-07-16T00:00:00.000Z",
          ageSeconds: 120,
          articleCount: 1,
          version: 4,
        },
      }),
    );

    const { GET } = await import("@/app/api/articles/route");
    const response = await GET(request("https://www.nutsnews.com/api/articles?page=0&lang=fr"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      dataSource: "edge_feed_snapshot",
      languageCode: "fr",
      articles: [
        {
          title: "Titre de secours depuis le bord",
          ai_summary: "Resume de secours depuis le bord.",
          language_code: "fr",
          requested_language_code: "fr",
          translation_available: true,
        },
      ],
    });
    expect(response.headers.get("x-nutsnews-article-data-source")).toBe("edge_feed_snapshot");
    expect(response.headers.get("x-nutsnews-feed-snapshot")).toBe("edge-fallback");
    expect(response.headers.get("x-nutsnews-article-language")).toBe("fr");
    expect(mocks.getEdgeFeedSnapshotPage).toHaveBeenCalledWith({
      page: 0,
      category: null,
      requestedLanguageCode: "fr",
    });
  });

  it("returns home-feed shape with the home-feed cache policy", async () => {
    const { GET } = await import("@/app/api/home-feed/route");

    const response = await GET(request("https://www.nutsnews.com/api/home-feed?lang=fr"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      articles: [expect.objectContaining({ id: "article-1" })],
      sections: [{ id: "community", articles: [expect.objectContaining({ id: "article-1" })] }],
    });
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(response.headers.get("x-nutsnews-cache-policy")).toBe("public-home-feed-cache-3600s");
    expect(response.headers.get("x-nutsnews-article-language")).toBe("fr");
    expect(response.headers.get("x-nutsnews-article-data-source")).toBe("public_feed_snapshot");
    expect(response.headers.get("x-nutsnews-feed-snapshot")).toBe("hit");
    expect(mocks.getHomeFeedDataWithEdgeFallback).toHaveBeenCalledWith("fr");
  });

  it("returns a maintenance home feed when all home-feed sources fail", async () => {
    mocks.getHomeFeedDataWithEdgeFallback.mockRejectedValueOnce(new Error("feed unavailable"));

    const { GET } = await import("@/app/api/home-feed/route");

    const response = await GET(request("https://www.nutsnews.com/api/home-feed"));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      articles: [],
      sections: [{ id: "community", articles: [] }],
      degradation: {
        mode: "maintenance",
        reason: "home_feed_exception",
      },
    });
    expect(response.headers.get("x-nutsnews-cache-policy")).toBe("public-home-feed-cache-3600s");
    expect(response.headers.get("x-nutsnews-degradation-mode")).toBe("maintenance");
    expect(response.headers.get("x-nutsnews-degradation-reason")).toBe("home_feed_exception");
  });
});

describe("public search route handler", () => {
  it("cleans malformed query params, returns empty results safely, and sets public cache headers", async () => {
    mocks.searchPublishedArticles.mockResolvedValueOnce({
      articles: [],
      nextPage: null,
      query: "kind news",
      page: 0,
      pageSize: 20,
      languageCode: "en",
    });

    const { GET } = await import("@/app/api/search/route");
    const response = await GET(
      request("https://www.nutsnews.com/api/search?q=%20%20kind%20%20news%20%20&page=NaN&limit=-4&lang=zz"),
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      articles: [],
      nextPage: null,
      query: "kind news",
      page: 0,
      pageSize: 20,
      languageCode: "en",
    });
    expect(response.headers.get("cache-control")).toContain("max-age=30");
    expect(response.headers.get("cdn-cache-control")).toContain("max-age=60");
    expect(response.headers.get("x-nutsnews-cache-policy")).toBe("public-search-cache-60s");
    expect(mocks.searchPublishedArticles).toHaveBeenCalledWith("kind news", 0, 20, "en");
  });

  it("fails closed with no-store headers when archive search is disabled", async () => {
    mocks.isRuntimeFeatureFlagEnabled.mockResolvedValueOnce(false);

    const { GET } = await import("@/app/api/search/route");
    const response = await GET(request("https://www.nutsnews.com/api/search?q=kind"));
    const body = await json(response);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      articles: [],
      error: "Archive search is temporarily unavailable",
    });
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("x-nutsnews-cache-policy")).toBe("bypass-cache");
    expect(mocks.searchPublishedArticles).not.toHaveBeenCalled();
  });
});

describe("runtime config route handler", () => {
  it("returns public runtime config without cacheable headers", async () => {
    const { GET } = await import("@/app/api/runtime-config/route");

    const response = await GET();
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      runtimeEnv: "staging",
      databaseProviderMode: "supabase_primary",
      productionWritesPaused: false,
      deploymentTarget: "test",
      supabaseUrl: "https://staging-fixture.supabase.co",
    });
    expect(body).not.toHaveProperty("authSecret");
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("cdn-cache-control")).toBe("no-store");
    expect(response.headers.get("x-nutsnews-cache-policy")).toBe("runtime-public-config-no-store");
  });
});

describe("guarded mutation and auth route handlers", () => {
  it("rejects disabled contact delivery before parsing request credentials or body", async () => {
    mocks.assertExternalSideEffect.mockImplementationOnce(() => {
      throw new mocks.runtimeSafetyError("side_effects_disabled");
    });

    const { POST } = await import("@/app/api/contact/route");
    const response = await POST(
      request("https://www.nutsnews.com/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "reader@example.test", message: "Hello from a test", turnstileToken: "token" }),
      }) as never,
    );
    const body = await json(response);

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Contact delivery is disabled in this environment." });
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(mocks.recordQuotaUsageEvent).not.toHaveBeenCalled();
  });

  it("rejects disallowed contact origins and malformed JSON without side effects", async () => {
    const { POST } = await import("@/app/api/contact/route");

    const forbidden = await POST(
      request("https://www.nutsnews.com/api/contact", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example.test",
        },
        body: "{}",
      }) as never,
    );

    expect(forbidden.status).toBe(403);
    expect(await json(forbidden)).toEqual({ error: "This contact request is not allowed." });
    expect(forbidden.headers.get("cache-control")).toBe("no-store, max-age=0");

    const malformed = await POST(
      request("https://www.nutsnews.com/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }) as never,
    );

    expect(malformed.status).toBe(400);
    expect(await json(malformed)).toEqual({ error: "Please submit a valid contact form." });
    expect(mocks.recordQuotaUsageEvent).not.toHaveBeenCalled();
  });

  it("blocks OAuth callbacks when the runtime identity guard refuses them", async () => {
    mocks.assertOAuthCallback.mockImplementationOnce(() => {
      throw new mocks.runtimeSafetyError("oauth_callback_identity_required");
    });

    const { GET } = await import("@/app/api/auth/[...nextauth]/route");
    const response = await GET(
      request("https://www.nutsnews.com/api/auth/callback/google", {
        headers: {
          host: "127.0.0.1:3000",
          "x-forwarded-host": "www.nutsnews.com",
          "x-forwarded-proto": "https",
        },
      }) as never,
    );
    const body = await json(response);

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "OAuth callbacks are disabled in this environment.",
      code: "oauth_callback_identity_required",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-nutsnews-auth-error")).toBe("oauth_callback_identity_required");
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "admin.oauth_callback.blocked",
      "Admin OAuth callback refused runtime identity.",
      {
        code: "oauth_callback_identity_required",
        host: "www.nutsnews.com",
        forwardedProto: "https",
        pathname: "/api/auth/callback/google",
      },
    );
    expect(mocks.authGet).not.toHaveBeenCalled();
  });

  it("allows Auth.js session probes without the callback identity guard", async () => {
    mocks.assertOAuthCallback.mockImplementation(() => {
      throw new mocks.runtimeSafetyError("oauth_callback_identity_required");
    });

    const { GET } = await import("@/app/api/auth/[...nextauth]/route");
    const requestValue = request(
      "https://nutsnews-prod-candidate.vercel.app/api/auth/session",
    ) as never;

    const response = await GET(requestValue);
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, method: "GET" });
    expect(mocks.assertOAuthCallback).not.toHaveBeenCalled();
    expect(mocks.authGet).toHaveBeenCalledWith(requestValue);
  });

  it("dispatches OAuth callbacks to Auth.js only after the runtime identity guard passes", async () => {
    const { POST } = await import("@/app/api/auth/[...nextauth]/route");
    const requestValue = request("https://www.nutsnews.com/api/auth/callback/google", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        "x-forwarded-host": "www.nutsnews.com",
      },
    }) as never;

    const response = await POST(requestValue);
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, method: "POST" });
    expect(mocks.assertOAuthCallback).toHaveBeenCalledWith("oauth-callback", {
      url: "https://www.nutsnews.com/api/auth/callback/google",
      host: "www.nutsnews.com",
      forwardedProto: "https",
    });
    expect(mocks.authPost).toHaveBeenCalledWith(requestValue);
  });
});
