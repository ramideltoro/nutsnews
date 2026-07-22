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

type QueryCall = {
  method: string;
  args: unknown[];
};

type SupabaseQueryMock = {
  calls: QueryCall[];
  eq: (column: string, value: unknown) => SupabaseQueryMock;
  gte: (column: string, value: unknown) => SupabaseQueryMock;
  or: (filters: string) => SupabaseQueryMock;
  order: (column: string, options?: Record<string, unknown>) => SupabaseQueryMock;
  limit: (count: number) => SupabaseQueryMock;
  then: Promise<unknown>["then"];
};

type SelectCall = {
  table: string;
  columns: string;
  query: SupabaseQueryMock;
};

function aiUsageRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    created_at: "2026-07-22T11:20:00.000Z",
    run_started_at: "2026-07-22T11:30:00.000Z",
    run_completed_at: "2026-07-22T11:31:00.000Z",
    run_source: "scheduled",
    request_id: "request-101",
    shard_index: 2,
    feeds_per_shard: 5,
    max_ai_reviews: 10,
    feed_count: 5,
    fetched_count: 20,
    candidate_count: 10,
    already_reviewed_count: 1,
    unreviewed_count: 9,
    eligible_for_ai_count: 7,
    ai_reviewed_count: 7,
    openai_model: "gpt-4o-mini",
    openai_call_count: 4,
    openai_prompt_tokens: 100,
    openai_completion_tokens: 50,
    openai_total_tokens: 150,
    estimated_openai_cost_usd: "0.45",
    openai_review_count: 2,
    openai_review_prompt_tokens: 60,
    openai_review_completion_tokens: 20,
    openai_review_total_tokens: 80,
    estimated_openai_review_cost_usd: "0.20",
    openai_translation_count: 2,
    openai_translation_prompt_tokens: 40,
    openai_translation_completion_tokens: 30,
    openai_translation_total_tokens: 70,
    estimated_openai_translation_cost_usd: "0.25",
    ai_provider: "local",
    local_ai_model: "qwen2.5:3b",
    local_ai_call_count: 3,
    local_ai_prompt_tokens: 30,
    local_ai_completion_tokens: 15,
    local_ai_total_tokens: 45,
    local_ai_accepted_count: 2,
    local_ai_rejected_count: 1,
    local_ai_duration_ms: 9000,
    local_ai_review_count: 2,
    local_ai_review_prompt_tokens: 20,
    local_ai_review_completion_tokens: 10,
    local_ai_review_total_tokens: 30,
    local_ai_translation_count: 1,
    local_ai_translation_prompt_tokens: 10,
    local_ai_translation_completion_tokens: 5,
    local_ai_translation_total_tokens: 15,
    estimated_local_ai_savings_usd: "0.12",
    openai_accepted_count: 2,
    openai_rejected_count: 2,
    published_accepted_count: 2,
    total_rejected_count: 3,
    no_thumbnail_rejected_count: 0,
    locally_rejected_count: 1,
    cost_protection_limit_reached: true,
    spike_warning_triggered: false,
    review_save_ok: true,
    article_save_ok: true,
    duration_ms: 60_000,
    ...overrides,
  };
}

function localAiUsageRunRow(overrides: Record<string, unknown> = {}) {
  return aiUsageRunRow({
    id: 202,
    request_id: "request-202",
    openai_call_count: 1,
    ai_reviewed_count: 3,
    cost_protection_limit_reached: false,
    ...overrides,
  });
}

function localAiReviewRow() {
  return {
    id: 501,
    reviewed_at: "2026-07-22T11:35:00.000Z",
    original_url: "https://publisher.example.com/local-ai-review",
    source: "Reuters",
    title: "Local model accepts a policy story",
    decision: "accept",
    category: "World",
    positivity_score: "7",
    summary: "A concise summary from the local model.",
    reason: "The story is relevant and constructive.",
    ai_provider: "local",
    ai_model: "qwen2.5:3b",
    review_duration_ms: "3000",
  };
}

function aiUsageBackendSnapshot(rows = [aiUsageRunRow()]) {
  return {
    rows: [{ usageRunRows: rows }],
    rowCount: 1,
    generatedAt: NOW.toISOString(),
  };
}

function localAiBackendSnapshot(
  usageRunRows = [localAiUsageRunRow()],
  recentReviewRows = [localAiReviewRow()],
) {
  return {
    rows: [{ usageRunRows, recentReviewRows }],
    rowCount: 1,
    generatedAt: NOW.toISOString(),
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
  query.gte = chain("gte");
  query.or = chain("or");
  query.order = chain("order");
  query.limit = chain("limit");
  query.then = resolved.then.bind(resolved);
  return query;
}

function createSupabaseClientSnapshot() {
  const selectCalls: SelectCall[] = [];
  const client = {
    selectCalls,
    from: vi.fn((table: string) => ({
      select: vi.fn((columns: string) => {
        let response: unknown;

        if (table === "ai_usage_runs" && columns.includes("created_at")) {
          response = {
            data: [aiUsageRunRow()],
            error: null,
          };
        } else if (table === "ai_usage_runs") {
          response = {
            data: [localAiUsageRunRow()],
            error: null,
          };
        } else if (table === "article_ai_reviews") {
          response = {
            data: [localAiReviewRow()],
            error: null,
          };
        } else {
          throw new Error(`Unexpected Supabase table ${table}.`);
        }

        const query = createQuery(response);
        selectCalls.push({ table, columns, query });
        return query;
      }),
    })),
  };

  return client;
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe("admin AI usage and local AI data access", () => {
  it("loads AI usage through the backend API in backend primary mode", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(aiUsageBackendSnapshot());

    const { getAdminAiUsageDashboardData } = await import("@/lib/adminAiUsage");
    const data = await getAdminAiUsageDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.last30Days).toMatchObject({
      runCount: 1,
      shardCount: 1,
      openAiCallCount: 4,
      localAiCallCount: 3,
      totalAiActivityCount: 7,
      aiReviewedCount: 7,
      acceptedCount: 4,
      rejectedCount: 3,
      estimatedCostUsd: 0.45,
      estimatedLocalAiSavingsUsd: 0.12,
      openAiReviewCount: 2,
      openAiTranslationCount: 2,
      localAiReviewCount: 2,
      localAiTranslationCount: 1,
      costProtectionHitCount: 1,
    });
    expect(data.daily).toHaveLength(7);
    expect(data.shards[0]).toMatchObject({
      shardIndex: 2,
      totalAiActivityCount: 7,
    });
    expect(data.latestRuns[0]).toMatchObject({
      id: 101,
      openAiModel: "gpt-4o-mini",
      localAiCallCount: 3,
    });
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-ai-usage",
      expect.objectContaining({
        since: expect.any(String),
        limit: 5000,
      }),
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps empty AI usage telemetry as a configured empty dashboard", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(
      aiUsageBackendSnapshot([]),
    );

    const { getAdminAiUsageDashboardData } = await import("@/lib/adminAiUsage");
    const data = await getAdminAiUsageDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.last30Days.runCount).toBe(0);
    expect(data.daily).toHaveLength(7);
    expect(data.latestRuns).toEqual([]);
  });

  it("loads local AI usage and recent reviews through the backend API in backend primary mode", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(localAiBackendSnapshot());

    const { getAdminLocalAiDashboardData } = await import("@/lib/adminLocalAi");
    const data = await getAdminLocalAiDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.last30Days).toMatchObject({
      runCount: 1,
      shardCount: 1,
      localAiCallCount: 3,
      fallbackOpenAiCallCount: 1,
      reviewedCount: 3,
      acceptedCount: 2,
      rejectedCount: 1,
      acceptanceRate: 67,
      totalTokens: 45,
      averageReviewDurationMs: 3000,
      latestModel: "qwen2.5:3b",
    });
    expect(data.modelSummaries[0]).toMatchObject({
      model: "qwen2.5:3b",
      callCount: 3,
    });
    expect(data.recentReviews[0]).toMatchObject({
      id: 501,
      provider: "local",
      model: "qwen2.5:3b",
      positivityScore: 7,
    });
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-local-ai",
      expect.objectContaining({
        since: expect.any(String),
        runLimit: 5000,
        reviewLimit: 50,
      }),
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps empty local AI telemetry as a configured empty dashboard", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(
      localAiBackendSnapshot([], []),
    );

    const { getAdminLocalAiDashboardData } = await import("@/lib/adminLocalAi");
    const data = await getAdminLocalAiDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.last30Days.runCount).toBe(0);
    expect(data.modelSummaries).toEqual([]);
    expect(data.latestRuns).toEqual([]);
    expect(data.recentReviews).toEqual([]);
  });

  it("surfaces backend API configuration failures without Supabase env copy", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockRejectedValue(
      new mocks.runtimeSafetyError("backend_api_config_missing"),
    );

    const { getAdminAiUsageDashboardData } = await import("@/lib/adminAiUsage");
    const aiUsageData = await getAdminAiUsageDashboardData();

    vi.resetModules();
    mocks.callBackendDatabaseOperation.mockRejectedValue(
      new mocks.runtimeSafetyError("backend_api_config_missing"),
    );

    const { getAdminLocalAiDashboardData } = await import("@/lib/adminLocalAi");
    const localAiData = await getAdminLocalAiDashboardData();

    expect(aiUsageData.isConfigured).toBe(false);
    expect(localAiData.isConfigured).toBe(false);
    expect(aiUsageData.errorMessage).toMatch(
      /NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/,
    );
    expect(localAiData.errorMessage).toMatch(
      /NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/,
    );
    expect(aiUsageData.errorMessage).not.toMatch(/SUPABASE/);
    expect(localAiData.errorMessage).not.toMatch(/SUPABASE/);
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps Supabase primary reads behind the provider-neutral fallback", async () => {
    const supabaseClient = createSupabaseClientSnapshot();
    mocks.getDatabaseProviderMode.mockReturnValue("supabase_primary");
    mocks.getServerSupabaseConfig.mockReturnValue({
      url: "https://stage-project.supabase.co",
      serviceRoleKey: "server-only-service-role-key",
    });
    mocks.getServerSupabase.mockReturnValue(supabaseClient);

    const { getAdminAiUsageDashboardData } = await import("@/lib/adminAiUsage");
    const aiUsageData = await getAdminAiUsageDashboardData();
    const { getAdminLocalAiDashboardData } = await import("@/lib/adminLocalAi");
    const localAiData = await getAdminLocalAiDashboardData();

    const aiUsageQuery = supabaseClient.selectCalls.find(
      (call) =>
        call.table === "ai_usage_runs" && call.columns.includes("created_at"),
    )?.query;
    const localRunQuery = supabaseClient.selectCalls.find(
      (call) =>
        call.table === "ai_usage_runs" && !call.columns.includes("created_at"),
    )?.query;
    const localReviewQuery = supabaseClient.selectCalls.find(
      (call) => call.table === "article_ai_reviews",
    )?.query;

    expect(aiUsageData.isConfigured).toBe(true);
    expect(localAiData.isConfigured).toBe(true);
    expect(aiUsageQuery?.calls).toEqual(
      expect.arrayContaining([
        { method: "gte", args: ["run_started_at", expect.any(String)] },
        { method: "limit", args: [5000] },
      ]),
    );
    expect(localRunQuery?.calls).toEqual(
      expect.arrayContaining([
        { method: "or", args: ["ai_provider.eq.local,local_ai_call_count.gt.0"] },
        { method: "gte", args: ["run_started_at", expect.any(String)] },
        { method: "limit", args: [5000] },
      ]),
    );
    expect(localReviewQuery?.calls).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["ai_provider", "local"] },
        { method: "limit", args: [50] },
      ]),
    );
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).toHaveBeenCalledTimes(2);
    expect(mocks.getServerSupabase).toHaveBeenCalledTimes(2);
  });
});
