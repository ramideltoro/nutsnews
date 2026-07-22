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

type QueryCall = {
  method: string;
  args: unknown[];
};

type SupabaseQueryMock = {
  calls: QueryCall[];
  gte: (column: string, value: string) => SupabaseQueryMock;
  order: (column: string, options?: Record<string, unknown>) => SupabaseQueryMock;
  limit: (count: number) => SupabaseQueryMock;
  then: Promise<unknown>["then"];
};

type SelectCall = {
  table: string;
  columns: string;
  options?: Record<string, unknown>;
  query?: SupabaseQueryMock;
};

function aiUsageRow(overrides: Record<string, unknown> = {}) {
  return {
    run_started_at: "2026-07-22T10:00:00.000Z",
    openai_call_count: 12,
    openai_prompt_tokens: 1_200,
    openai_completion_tokens: 400,
    openai_total_tokens: 1_600,
    estimated_openai_cost_usd: "0.0234",
    cost_protection_limit_reached: false,
    spike_warning_triggered: false,
    local_ai_call_count: 4,
    local_ai_total_tokens: 800,
    ...overrides,
  };
}

function workerRunRow(overrides: Record<string, unknown> = {}) {
  return {
    run_started_at: "2026-07-22T10:05:00.000Z",
    success: true,
    shard_index: 0,
    fetched_count: 20,
    ai_reviewed_count: 12,
    accepted_count: 7,
    rejected_count: 5,
    duration_ms: 1_500,
    cost_protection_limit_reached: false,
    spike_warning_triggered: false,
    ...overrides,
  };
}

function quotaUsageEventRow(overrides: Record<string, unknown> = {}) {
  return {
    event_type: "email_send",
    quantity: 3,
    created_at: "2026-07-22T10:10:00.000Z",
    ...overrides,
  };
}

function backendSnapshot({
  aiUsageRunRows = [aiUsageRow()],
  workerRunRows = [workerRunRow(), workerRunRow({ success: false })],
  quotaUsageEventRows = [
    quotaUsageEventRow(),
    quotaUsageEventRow({ event_type: "redis_kv_operation", quantity: 11 }),
  ],
  articleCount = 10,
  summaryCount = 20,
  feedCount = 3,
  partialErrors = [],
}: {
  aiUsageRunRows?: Array<Record<string, unknown>>;
  workerRunRows?: Array<Record<string, unknown>>;
  quotaUsageEventRows?: Array<Record<string, unknown>>;
  articleCount?: number | null;
  summaryCount?: number | null;
  feedCount?: number | null;
  partialErrors?: string[];
} = {}) {
  return {
    rows: [
      {
        aiUsageRunRows,
        workerRunRows,
        quotaUsageEventRows,
        articleCount,
        summaryCount,
        feedCount,
        partialErrors,
      },
    ],
    rowCount: 1,
    generatedAt: "2026-07-22T12:00:00.000Z",
  };
}

function metricById(data: { metrics: Array<{ id: string }> }, id: string) {
  const metric = data.metrics.find((candidate) => candidate.id === id);
  expect(metric).toBeDefined();
  return metric as NonNullable<typeof metric>;
}

function stubStableUsageEnv() {
  const stableEnv: Record<string, string> = {
    CLOUDFLARE_ACCOUNT_ID: "",
    CLOUDFLARE_API_TOKEN: "",
    CLOUDFLARE_CDN_BANDWIDTH_30D_GB: "",
    CLOUDFLARE_CDN_BANDWIDTH_30D_GB_LIMIT: "",
    CLOUDFLARE_CDN_REQUESTS_30D: "",
    CLOUDFLARE_CDN_REQUESTS_30D_LIMIT: "",
    CLOUDFLARE_CDN_UNCACHED_BANDWIDTH_30D_GB: "",
    CLOUDFLARE_CDN_UNCACHED_BANDWIDTH_30D_GB_LIMIT: "",
    CLOUDFLARE_DASHBOARD_URL: "",
    CLOUDFLARE_ENABLE_D1_GUARDRAILS: "false",
    CLOUDFLARE_ENABLE_DURABLE_OBJECTS_GUARDRAILS: "false",
    CLOUDFLARE_ENABLE_IMAGES_GUARDRAILS: "false",
    CLOUDFLARE_ENABLE_PAGES_GUARDRAILS: "false",
    CLOUDFLARE_ENABLE_QUEUES_GUARDRAILS: "false",
    CLOUDFLARE_ENABLE_R2_GUARDRAILS: "false",
    CLOUDFLARE_KV_LIST_DELETE_24H: "",
    CLOUDFLARE_KV_LIST_DELETE_24H_LIMIT: "",
    CLOUDFLARE_KV_READS_24H: "",
    CLOUDFLARE_KV_READS_DAILY_LIMIT: "",
    CLOUDFLARE_KV_STORAGE_GB: "",
    CLOUDFLARE_KV_STORAGE_GB_LIMIT: "",
    CLOUDFLARE_KV_WRITES_24H: "",
    CLOUDFLARE_KV_WRITES_DAILY_LIMIT: "",
    CLOUDFLARE_TURNSTILE_VALIDATIONS_30D: "",
    CLOUDFLARE_TURNSTILE_VALIDATIONS_30D_LIMIT: "",
    CLOUDFLARE_WORKERS_CPU_P99_MS: "",
    CLOUDFLARE_WORKERS_CPU_P99_MS_LIMIT: "",
    CLOUDFLARE_WORKERS_REQUESTS_24H: "",
    CLOUDFLARE_WORKERS_REQUESTS_30D: "",
    CLOUDFLARE_WORKERS_REQUESTS_30D_LIMIT: "",
    CLOUDFLARE_WORKERS_REQUESTS_DAILY_LIMIT: "",
    CLOUDFLARE_WORKERS_SUBREQUESTS_30D: "",
    CLOUDFLARE_WORKERS_SUBREQUESTS_30D_LIMIT: "",
    CLOUDFLARE_WORKER_SCRIPT_NAMES: "",
    CLOUDFLARE_ZONE_ID: "",
    NUTSNEWS_ARTICLE_ROW_LIMIT: "30000",
    NUTSNEWS_ARTICLE_SUMMARY_ROW_LIMIT: "90000",
    NUTSNEWS_DB_CONTENT_ROW_LIMIT: "50000",
    NUTSNEWS_EGRESS_30D_GB: "",
    NUTSNEWS_EGRESS_30D_GB_LIMIT: "100",
    NUTSNEWS_EMAIL_MONTHLY_SEND_LIMIT: "3000",
    NUTSNEWS_OPENAI_MONTHLY_BUDGET_USD: "5",
    NUTSNEWS_OPENAI_MONTHLY_CALL_LIMIT: "50000",
    NUTSNEWS_PAGESPEED_30D_CALLS: "",
    NUTSNEWS_PAGESPEED_30D_CALL_LIMIT: "25000",
    NUTSNEWS_REDIS_KV_30D_OPS: "",
    NUTSNEWS_REDIS_KV_30D_OP_LIMIT: "100000",
    NUTSNEWS_VERCEL_EDGE_REQUESTS: "105000",
    NUTSNEWS_VERCEL_FAST_DATA_TRANSFER_GB: "1.93",
    NUTSNEWS_VERCEL_FAST_ORIGIN_TRANSFER_GB: "1.31",
    NUTSNEWS_VERCEL_FLUID_ACTIVE_CPU_HOURS: "3.2",
    NUTSNEWS_VERCEL_FLUID_PROVISIONED_MEMORY_GB_HOURS: "14.4",
    NUTSNEWS_VERCEL_FUNCTION_INVOCATIONS: "72000",
    NUTSNEWS_VERCEL_IMAGE_CACHE_WRITES: "11000",
    NUTSNEWS_VERCEL_IMAGE_TRANSFORMATIONS: "1200",
    NUTSNEWS_VERCEL_ISR_READS: "60000",
    NUTSNEWS_VERCEL_ISR_WRITES: "61000",
    NUTSNEWS_WORKER_24H_FAILURE_LIMIT: "5",
    NUTSNEWS_WORKER_MONTHLY_INVOCATION_LIMIT: "100000",
  };

  for (const [name, value] of Object.entries(stableEnv)) {
    vi.stubEnv(name, value);
  }
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

  query.gte = chain("gte");
  query.order = chain("order");
  query.limit = chain("limit");
  query.then = resolved.then.bind(resolved);
  return query;
}

function createSupabaseGuardrailsClient() {
  const snapshot = backendSnapshot().rows[0];
  const selectCalls: SelectCall[] = [];
  const counts: Record<string, number> = {
    articles: Number(snapshot.articleCount ?? 0),
    article_summaries: Number(snapshot.summaryCount ?? 0),
    rss_feeds: Number(snapshot.feedCount ?? 0),
  };

  const client = {
    selectCalls,
    from: vi.fn((table: string) => ({
      select: vi.fn((columns: string, options?: Record<string, unknown>) => {
        selectCalls.push({ table, columns, options });

        if (options?.head) {
          return Promise.resolve({
            count: counts[table] ?? 0,
            error: null,
          });
        }

        let data: unknown;
        if (table === "ai_usage_runs") {
          data = snapshot.aiUsageRunRows;
        } else if (table === "worker_runs") {
          data = snapshot.workerRunRows;
        } else if (table === "quota_usage_events") {
          data = snapshot.quotaUsageEventRows;
        } else {
          throw new Error(`Unexpected Supabase table ${table}.`);
        }

        const query = createQuery({ data, error: null });
        selectCalls[selectCalls.length - 1].query = query;
        return query;
      }),
    })),
  };

  return client;
}

beforeEach(() => {
  vi.resetModules();
  stubStableUsageEnv();
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

describe("admin guardrails data access", () => {
  it("loads guardrails through the backend API without touching Supabase in backend primary mode", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(backendSnapshot());

    const { getAdminCostGuardrailsDashboardData } = await import(
      "@/lib/adminCostGuardrails"
    );
    const data = await getAdminCostGuardrailsDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.last30Days.openAiCalls).toBe(12);
    expect(data.last30Days.workerRuns).toBe(2);
    expect(data.last30Days.failedWorkerRuns).toBe(1);
    expect(metricById(data, "db-content-rows")).toMatchObject({
      value: 33,
      dataSource: "Admin database row counts",
    });
    expect(metricById(data, "redis-kv-ops")).toMatchObject({
      value: 11,
    });
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-guardrails",
      expect.objectContaining({
        since: expect.any(String),
        limit: 10000,
        countTables: ["articles", "article_summaries", "rss_feeds"],
      }),
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps external and manual metrics visible when backend database config is missing", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockRejectedValue(
      new mocks.runtimeSafetyError("backend_api_config_missing"),
    );

    const { getAdminCostGuardrailsDashboardData } = await import(
      "@/lib/adminCostGuardrails"
    );
    const data = await getAdminCostGuardrailsDashboardData();

    expect(data.isConfigured).toBe(false);
    expect(data.errorMessage).toMatch(
      /NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/,
    );
    expect(data.errorMessage).not.toMatch(/SUPABASE/);
    expect(data.overallRiskLevel).toBe("unknown");
    expect(data.last30Days.openAiCostUsd).toBeNull();
    expect(metricById(data, "db-content-rows")).toMatchObject({
      value: null,
      riskLevel: "unknown",
    });
    expect(metricById(data, "vercel-fast-data-transfer")).toMatchObject({
      value: 1.93,
      riskLevel: "ok",
    });
    expect(data.metrics.length).toBeGreaterThan(10);
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
  });

  it("lets real external threshold risk win even when backend database telemetry is unavailable", async () => {
    vi.stubEnv("NUTSNEWS_VERCEL_FAST_DATA_TRANSFER_GB", "125");
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockRejectedValue(
      new mocks.runtimeSafetyError("backend_api_config_missing"),
    );

    const { getAdminCostGuardrailsDashboardData } = await import(
      "@/lib/adminCostGuardrails"
    );
    const data = await getAdminCostGuardrailsDashboardData();

    expect(data.isConfigured).toBe(false);
    expect(data.overallRiskLevel).toBe("danger");
    expect(metricById(data, "vercel-fast-data-transfer")).toMatchObject({
      value: 125,
      riskLevel: "danger",
    });
  });

  it("keeps configured empty telemetry distinct from missing backend API config", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(
      backendSnapshot({
        aiUsageRunRows: [],
        workerRunRows: [],
        quotaUsageEventRows: [],
        articleCount: 0,
        summaryCount: 0,
        feedCount: 0,
      }),
    );

    const { getAdminCostGuardrailsDashboardData } = await import(
      "@/lib/adminCostGuardrails"
    );
    const data = await getAdminCostGuardrailsDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.overallRiskLevel).toBe("ok");
    expect(data.latestRunLabel).toBe("No Worker/AI usage rows yet");
    expect(data.last30Days.openAiCostUsd).toBe(0);
    expect(metricById(data, "db-content-rows")).toMatchObject({
      value: 0,
      riskLevel: "ok",
    });
  });

  it("surfaces partial backend results while rendering available guardrail metrics", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(
      backendSnapshot({
        partialErrors: ["worker_runs: query timeout"],
      }),
    );

    const { getAdminCostGuardrailsDashboardData } = await import(
      "@/lib/adminCostGuardrails"
    );
    const data = await getAdminCostGuardrailsDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toContain("worker_runs: query timeout");
    expect(data.overallRiskLevel).toBe("unknown");
    expect(metricById(data, "db-content-rows")).toMatchObject({
      value: 33,
    });
    expect(metricById(data, "vercel-fast-data-transfer")).toMatchObject({
      value: 1.93,
    });
  });

  it("keeps Supabase primary reads behind the provider-neutral fallback", async () => {
    const supabaseClient = createSupabaseGuardrailsClient();
    mocks.getDatabaseProviderMode.mockReturnValue("supabase_primary");
    mocks.getServerSupabaseConfig.mockReturnValue({
      url: "https://stage-project.supabase.co",
      serviceRoleKey: "server-only-service-role-key",
    });
    mocks.getServerSupabase.mockReturnValue(supabaseClient);

    const { getAdminCostGuardrailsDashboardData } = await import(
      "@/lib/adminCostGuardrails"
    );
    const data = await getAdminCostGuardrailsDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(metricById(data, "db-content-rows")).toMatchObject({ value: 33 });
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getServerSupabase).toHaveBeenCalledTimes(1);
    expect(
      supabaseClient.selectCalls.find((call) => call.table === "ai_usage_runs")?.query?.calls,
    ).toEqual(
      expect.arrayContaining([
        { method: "gte", args: ["run_started_at", expect.any(String)] },
        { method: "limit", args: [10000] },
      ]),
    );
    expect(
      supabaseClient.selectCalls.find((call) => call.table === "articles")?.options,
    ).toMatchObject({ count: "exact", head: true });
  });
});
