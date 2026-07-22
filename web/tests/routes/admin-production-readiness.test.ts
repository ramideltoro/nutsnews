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

const NOW = new Date("2026-07-22T12:00:00.000Z");

function recentArticle(index: number) {
  return {
    id: `article-${index}`,
    original_url: `https://example.com/article-${index}`,
    image_url: `https://cdn.example.com/article-${index}.jpg`,
    published_on_site_at: new Date(NOW.getTime() - index * 60_000).toISOString(),
    created_at: new Date(NOW.getTime() - index * 60_000).toISOString(),
  };
}

function successfulWorkerRun() {
  return {
    id: 7,
    run_started_at: "2026-07-22T11:50:00.000Z",
    run_completed_at: "2026-07-22T11:52:00.000Z",
    success: true,
    error_name: null,
    error_message: null,
    feed_count: 12,
    fetched_count: 48,
    candidate_count: 32,
    accepted_count: 24,
    rejected_count: 8,
    duration_ms: 120_000,
  };
}

function backendReadinessSnapshot() {
  const recentArticles = Array.from({ length: 24 }, (_, index) => recentArticle(index));

  return {
    rows: [
      {
        articleCount: 240,
        publicFeedSnapshotCount: 48,
        recentArticles,
        workerRun: successfulWorkerRun(),
        articlesLast24Hours: 8,
        articlesLast7Days: 42,
        translationSummaries: [
          { original_url: recentArticles[0].original_url, language_code: "es" },
          { original_url: recentArticles[1].original_url, language_code: "es" },
        ],
        translationExpectedCount: 2,
      },
    ],
    rowCount: 1,
    generatedAt: NOW.toISOString(),
  };
}

type SupabaseQueryMock = {
  eq: (column: string, value: unknown) => SupabaseQueryMock;
  gte: (column: string, value: unknown) => SupabaseQueryMock;
  in: (column: string, values: unknown[]) => SupabaseQueryMock;
  order: (column: string, options?: Record<string, unknown>) => SupabaseQueryMock;
  limit: (count: number) => SupabaseQueryMock;
  maybeSingle: () => Promise<unknown>;
  then: Promise<unknown>["then"];
};

function createQuery(response: unknown): SupabaseQueryMock {
  const resolved = Promise.resolve(response);
  const query = {} as SupabaseQueryMock;
  query.eq = vi.fn(() => query);
  query.gte = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => Promise.resolve(response));
  query.then = resolved.then.bind(resolved);
  return query;
}

function createSupabaseClientSnapshot() {
  const snapshot = backendReadinessSnapshot().rows[0];
  const articleCountResponses = [
    { count: snapshot.articleCount, error: null },
    { count: snapshot.articlesLast24Hours, error: null },
    { count: snapshot.articlesLast7Days, error: null },
  ];

  return {
    from: vi.fn((table: string) => ({
      select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) => {
        if (table === "articles" && options?.count === "exact" && options.head) {
          return createQuery(articleCountResponses.shift());
        }

        if (table === "public_feed_snapshot" && options?.count === "exact" && options.head) {
          return createQuery({ count: snapshot.publicFeedSnapshotCount, error: null });
        }

        if (table === "articles") {
          return createQuery({ data: snapshot.recentArticles, error: null });
        }

        if (table === "worker_runs") {
          return createQuery({ data: snapshot.workerRun, error: null });
        }

        if (table === "article_summaries") {
          return createQuery({ data: snapshot.translationSummaries, error: null });
        }

        throw new Error(`Unexpected Supabase table ${table}.`);
      }),
    })),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
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
  vi.stubEnv("ACTIONS_READ_TOKEN", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("admin production readiness data access", () => {
  it("loads the readiness snapshot through the backend API without touching Supabase in backend primary mode", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(backendReadinessSnapshot());

    const { getAdminProductionReadinessDashboardData } = await import(
      "@/lib/adminProductionReadiness"
    );
    const data = await getAdminProductionReadinessDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.signals.find((signal) => signal.id === "public-api-health")).toMatchObject({
      status: "green",
      statusLabel: "Ready",
    });
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-production-readiness",
      expect.objectContaining({
        articleGrowthWindowsHours: [24, 168],
        defaultLanguageCode: expect.any(String),
        recentArticleLimit: 100,
        targetLanguageCodes: expect.any(Array),
        translationSampleLimit: 60,
      }),
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps the existing Supabase read behavior in Supabase primary mode", async () => {
    const supabaseClient = createSupabaseClientSnapshot();
    mocks.getDatabaseProviderMode.mockReturnValue("supabase_primary");
    mocks.getServerSupabaseConfig.mockReturnValue({
      url: "https://stage-project.supabase.co",
      serviceRoleKey: "server-only-service-role-key",
    });
    mocks.getServerSupabase.mockReturnValue(supabaseClient);

    const { getAdminProductionReadinessDashboardData } = await import(
      "@/lib/adminProductionReadiness"
    );
    const data = await getAdminProductionReadinessDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getServerSupabase).toHaveBeenCalledTimes(1);
    expect(supabaseClient.from).toHaveBeenCalledWith("articles");
    expect(supabaseClient.from).toHaveBeenCalledWith("public_feed_snapshot");
    expect(supabaseClient.from).toHaveBeenCalledWith("worker_runs");
    expect(supabaseClient.from).toHaveBeenCalledWith("article_summaries");
  });

  it("surfaces backend API configuration failures without Supabase env copy", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockRejectedValue(
      new mocks.runtimeSafetyError("backend_api_config_missing"),
    );

    const { getAdminProductionReadinessDashboardData } = await import(
      "@/lib/adminProductionReadiness"
    );
    const data = await getAdminProductionReadinessDashboardData();
    const configurationSignal = data.signals.find(
      (signal) => signal.id === "configuration",
    );

    expect(data.isConfigured).toBe(false);
    expect(data.errorMessage).toMatch(/NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/);
    expect(configurationSignal).toMatchObject({
      title: "Readiness data source",
      value: "Backend API",
    });
    expect(configurationSignal?.nextStep).toMatch(/NUTSNEWS_BACKEND_API_URL/);
    expect(configurationSignal?.nextStep).not.toMatch(/SUPABASE/);
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });
});
