import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    callBackendDatabaseOperation: vi.fn(),
    getDatabaseProviderMode: vi.fn(),
    getRuntimeSafetyPolicy: vi.fn(),
    getServerSupabase: vi.fn(),
    getServerSupabaseConfig: vi.fn(),
    runtimeSafetyError: MockRuntimeSafetyError,
  };
});

vi.mock("server-only", () => ({}));

vi.mock("@/lib/backendDatabase", () => ({
  callBackendDatabaseOperation: mocks.callBackendDatabaseOperation,
}));

vi.mock("@/lib/runtimeSafety", () => ({
  RuntimeSafetyError: mocks.runtimeSafetyError,
  getDatabaseProviderMode: mocks.getDatabaseProviderMode,
  getRuntimeSafetyPolicy: mocks.getRuntimeSafetyPolicy,
}));

vi.mock("@/lib/supabase", () => ({
  getServerSupabase: mocks.getServerSupabase,
  getServerSupabaseConfig: mocks.getServerSupabaseConfig,
}));

type ArticleReviewFilters = {
  decision: "all" | "accept" | "reject";
  source: string;
  category: string;
  minScore: number | null;
  maxScore: number | null;
  page: number;
  sort: "newest" | "oldest";
};

type QueryCall = {
  method: string;
  args: unknown[];
};

type SupabaseQueryMock = {
  calls: QueryCall[];
  eq: (column: string, value: unknown) => SupabaseQueryMock;
  ilike: (column: string, value: string) => SupabaseQueryMock;
  gte: (column: string, value: unknown) => SupabaseQueryMock;
  lte: (column: string, value: unknown) => SupabaseQueryMock;
  in: (column: string, values: unknown[]) => SupabaseQueryMock;
  order: (column: string, options?: Record<string, unknown>) => SupabaseQueryMock;
  limit: (count: number) => SupabaseQueryMock;
  range: (from: number, to: number) => SupabaseQueryMock;
  then: Promise<unknown>["then"];
};

type SelectCall = {
  table: string;
  columns: string;
  options?: { count?: string };
  query: SupabaseQueryMock;
};

const FILTERS: ArticleReviewFilters = {
  decision: "reject",
  source: "Reuters",
  category: "World",
  minScore: 4,
  maxScore: 8,
  page: 1,
  sort: "oldest",
};

function reviewRow(id: number, originalUrl: string) {
  return {
    id,
    reviewed_at: "2026-07-22T10:00:00.000Z",
    original_url: originalUrl,
    source: "Reuters",
    title: `Review ${id}`,
    decision: "reject",
    category: "World",
    positivity_score: 5,
    summary: "A concise article summary.",
    reason: "Needs more positive framing.",
    ai_provider: "openai",
    ai_model: "gpt-4o-mini",
    prompt_version: "2026-07-01",
    model_version: "gpt-4o-mini-2026-07",
    review_duration_ms: 1200,
  };
}

function publishedArticle(id: string, originalUrl: string) {
  return {
    id,
    original_url: originalUrl,
    source: "Reuters",
    title: `Published ${id}`,
    image_url: "https://cdn.example.com/image.jpg",
    published_at: "2026-07-22T09:30:00.000Z",
    published_on_site_at: "2026-07-22T09:45:00.000Z",
    created_at: "2026-07-22T09:20:00.000Z",
    ai_summary: "Published article summary.",
    category: "World",
    positivity_score: 7,
    status: "published",
  };
}

function versionReportRow() {
  return {
    version_window: "current",
    version_rank: 1,
    prompt_version: "2026-07-01",
    model_version: "gpt-4o-mini-2026-07",
    ai_provider: "openai",
    ai_model: "gpt-4o-mini",
    total_reviews: 80,
    accepted_reviews: 50,
    rejected_reviews: 30,
    acceptance_rate_pct: 62.5,
    rejection_rate_pct: 37.5,
    average_positivity_score: 6.4,
    previous_acceptance_rate_pct: 60,
    previous_rejection_rate_pct: 40,
    previous_average_positivity_score: 6.1,
    acceptance_rate_delta_pct: 2.5,
    rejection_rate_delta_pct: -2.5,
    average_score_delta: 0.3,
    first_reviewed_at: "2026-07-21T00:00:00.000Z",
    latest_reviewed_at: "2026-07-22T10:00:00.000Z",
  };
}

function backendSnapshot() {
  const visibleReview = reviewRow(10, "https://example.com/reviewed");
  const recentReview = reviewRow(11, "https://example.com/recent-published");

  return {
    rows: [
      {
        sourceOptions: ["Reuters", "TechCrunch"],
        categoryOptions: ["Science", "World"],
        recentPublishedArticleRows: [
          publishedArticle("published-recent", "https://example.com/recent-published"),
        ],
        recentPublishedReviewRows: [recentReview],
        versionReportRows: [versionReportRow()],
        versionReportError: null,
        reviewRows: [visibleReview],
        publishedArticlesForReviews: [
          publishedArticle("published-visible", "https://example.com/reviewed"),
        ],
        totalMatchingReviews: 125,
        reviewError: null,
      },
    ],
    rowCount: 1,
    generatedAt: "2026-07-22T12:00:00.000Z",
  };
}

function createQuery(response: unknown): SupabaseQueryMock {
  const resolved = Promise.resolve(response);
  const query = {} as SupabaseQueryMock;
  query.calls = [];

  function chain(method: string) {
    return vi.fn((...args: unknown[]) => {
      query.calls.push({ method, args });
      return query;
    });
  }

  query.eq = chain("eq");
  query.ilike = chain("ilike");
  query.gte = chain("gte");
  query.lte = chain("lte");
  query.in = chain("in");
  query.order = chain("order");
  query.limit = chain("limit");
  query.range = chain("range");
  query.then = resolved.then.bind(resolved);
  return query;
}

function createSupabaseClientSnapshot() {
  const snapshot = backendSnapshot().rows[0];
  const articleRows = [
    snapshot.recentPublishedArticleRows,
    snapshot.publishedArticlesForReviews,
  ];
  const reviewLookupRows = [snapshot.recentPublishedReviewRows];
  const selectCalls: SelectCall[] = [];

  const client = {
    selectCalls,
    from: vi.fn((table: string) => ({
      select: vi.fn((columns: string, options?: { count?: string }) => {
        let response: unknown;

        if (table === "article_ai_reviews" && columns === "source, category") {
          response = {
            data: [
              { source: "Reuters", category: "World|Science" },
              { source: "TechCrunch", category: "Science" },
            ],
            error: null,
          };
        } else if (table === "ai_decision_version_report") {
          response = { data: snapshot.versionReportRows, error: null };
        } else if (table === "articles") {
          response = { data: articleRows.shift() ?? [], error: null };
        } else if (table === "article_ai_reviews" && options?.count === "exact") {
          response = {
            data: snapshot.reviewRows,
            error: null,
            count: snapshot.totalMatchingReviews,
          };
        } else if (table === "article_ai_reviews") {
          response = { data: reviewLookupRows.shift() ?? [], error: null };
        } else {
          throw new Error(`Unexpected Supabase select for ${table}.`);
        }

        const query = createQuery(response);
        selectCalls.push({ table, columns, options, query });
        return query;
      }),
    })),
  };

  return client;
}

beforeEach(() => {
  vi.resetModules();
  mocks.callBackendDatabaseOperation.mockReset();
  mocks.getDatabaseProviderMode.mockReset();
  mocks.getRuntimeSafetyPolicy.mockReset();
  mocks.getServerSupabase.mockReset();
  mocks.getServerSupabaseConfig.mockReset();
  mocks.getDatabaseProviderMode.mockReturnValue("supabase_primary");
  mocks.getRuntimeSafetyPolicy.mockReturnValue({
    databaseProviderMode: "supabase_primary",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin article reviews data access", () => {
  it("loads article reviews through the backend API without Supabase service-role access in backend primary mode", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(backendSnapshot());

    const { getAdminArticleReviewDashboardData } = await import(
      "@/lib/adminArticleReviews"
    );
    const data = await getAdminArticleReviewDashboardData(FILTERS);

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.summary.totalMatchingReviews).toBe(125);
    expect(data.summary.page).toBe(1);
    expect(data.hasPreviousPage).toBe(true);
    expect(data.hasNextPage).toBe(true);
    expect(data.reviews[0]).toMatchObject({
      id: 10,
      decision: "reject",
      isPublished: true,
      publishedArticle: expect.objectContaining({ id: "published-visible" }),
    });
    expect(data.recentPublishedArticles[0]).toMatchObject({
      id: "published-recent",
      hasReview: true,
      reviewId: 11,
    });
    expect(data.versionReports[0]).toMatchObject({
      promptVersion: "2026-07-01",
      totalReviews: 80,
    });
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-article-reviews",
      expect.objectContaining({
        aiDecisionVersionReportLimit: 20,
        filters: FILTERS,
        maxOptionRows: 5000,
        pageSize: 50,
        recentPublishedArticleLimit: 10,
      }),
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps filters, pagination, and Supabase reads in Supabase primary mode", async () => {
    const supabaseClient = createSupabaseClientSnapshot();
    mocks.getDatabaseProviderMode.mockReturnValue("supabase_primary");
    mocks.getServerSupabaseConfig.mockReturnValue({
      url: "https://stage-project.supabase.co",
      serviceRoleKey: "server-only-service-role-key",
    });
    mocks.getServerSupabase.mockReturnValue(supabaseClient);

    const { getAdminArticleReviewDashboardData } = await import(
      "@/lib/adminArticleReviews"
    );
    const data = await getAdminArticleReviewDashboardData(FILTERS);
    const reviewPageQuery = supabaseClient.selectCalls.find(
      (call) =>
        call.table === "article_ai_reviews" &&
        call.options?.count === "exact",
    )?.query;

    expect(data.isConfigured).toBe(true);
    expect(data.sourceOptions).toEqual(["Reuters", "TechCrunch"]);
    expect(data.categoryOptions).toEqual(["Science", "World"]);
    expect(data.reviews).toHaveLength(1);
    expect(reviewPageQuery?.calls).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["decision", "reject"] },
        { method: "eq", args: ["source", "Reuters"] },
        { method: "ilike", args: ["category", "%World%"] },
        { method: "gte", args: ["positivity_score", 4] },
        { method: "lte", args: ["positivity_score", 8] },
        { method: "range", args: [50, 99] },
      ]),
    );
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getServerSupabase).toHaveBeenCalledTimes(1);
  });

  it("surfaces backend API configuration failures without Supabase env copy", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockRejectedValue(
      new mocks.runtimeSafetyError("backend_api_config_missing"),
    );

    const { getAdminArticleReviewDashboardData } = await import(
      "@/lib/adminArticleReviews"
    );
    const data = await getAdminArticleReviewDashboardData(FILTERS);

    expect(data.isConfigured).toBe(false);
    expect(data.errorMessage).toMatch(/NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/);
    expect(data.errorMessage).not.toMatch(/SUPABASE/);
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });
});
