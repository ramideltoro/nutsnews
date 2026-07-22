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
  order: (column: string, options?: Record<string, unknown>) => SupabaseQueryMock;
  limit: (count: number) => SupabaseQueryMock;
  then: Promise<unknown>["then"];
};

type SelectCall = {
  table: string;
  columns: string;
  query: SupabaseQueryMock;
};

function workerRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    created_at: "2026-07-22T11:50:00.000Z",
    run_started_at: "2026-07-22T11:50:00.000Z",
    run_completed_at: "2026-07-22T11:50:05.000Z",
    run_source: "scheduled",
    request_id: "request-1",
    shard_index: 0,
    feeds_per_shard: 4,
    max_ai_reviews: 10,
    success: true,
    error_name: null,
    error_message: null,
    feed_count: 4,
    fetched_count: 8,
    candidate_count: 6,
    already_reviewed_count: 1,
    unreviewed_count: 5,
    eligible_for_ai_count: 4,
    ai_reviewed_count: 3,
    accepted_count: 2,
    rejected_count: 1,
    no_thumbnail_rejected_count: 0,
    locally_rejected_count: 1,
    image_hydration_lookup_count: 2,
    image_hydration_found_count: 1,
    review_save_ok: true,
    article_save_ok: true,
    ai_usage_save_ok: true,
    cost_protection_limit_reached: false,
    spike_warning_triggered: false,
    duration_ms: 5_000,
    ...overrides,
  };
}

function workerShardSnapshot(workerRunRows = backendWorkerRows()) {
  return {
    rows: [
      {
        workerRunRows,
      },
    ],
    rowCount: 1,
    generatedAt: "2026-07-22T12:00:00.000Z",
  };
}

function backendWorkerRows() {
  return [
    workerRunRow({
      id: 2,
      run_started_at: "2026-07-22T11:55:00.000Z",
      run_completed_at: "2026-07-22T11:55:03.000Z",
      shard_index: 1,
      success: false,
      error_name: "WorkerShardError",
      error_message: "Feed fetch failed",
      duration_ms: 3_000,
    }),
    workerRunRow({
      id: 1,
      run_started_at: "2026-07-22T11:50:00.000Z",
      run_completed_at: "2026-07-22T11:50:05.000Z",
      shard_index: 0,
      success: true,
      duration_ms: 5_000,
    }),
    workerRunRow({
      id: 4,
      run_started_at: "2026-07-22T11:40:00.000Z",
      run_completed_at: "2026-07-22T11:40:20.000Z",
      shard_index: 3,
      success: true,
      duration_ms: 20_000,
    }),
    workerRunRow({
      id: 3,
      run_started_at: "2026-07-22T08:00:00.000Z",
      run_completed_at: "2026-07-22T08:00:06.000Z",
      shard_index: 2,
      success: true,
      duration_ms: 6_000,
    }),
  ];
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

  query.order = chain("order");
  query.limit = chain("limit");
  query.then = resolved.then.bind(resolved);
  return query;
}

function createSupabaseWorkerRunsClient(workerRunRows = backendWorkerRows()) {
  const selectCalls: SelectCall[] = [];
  const client = {
    selectCalls,
    from: vi.fn((table: string) => ({
      select: vi.fn((columns: string) => {
        if (table !== "worker_runs") {
          throw new Error(`Unexpected Supabase table ${table}.`);
        }

        const query = createQuery({ data: workerRunRows, error: null });
        selectCalls.push({ table, columns, query });
        return query;
      }),
    })),
  };

  return client;
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-22T12:00:00.000Z"));
  vi.stubEnv("ADMIN_SHARD_COUNT", "4");
  vi.stubEnv("ADMIN_SHARD_STALE_MINUTES", "180");
  vi.stubEnv("ADMIN_SHARD_SLOW_RUN_MS", "15000");
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
  vi.unstubAllEnvs();
});

describe("admin worker shards data access", () => {
  it("loads worker shards through the backend API and preserves shard status logic", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(workerShardSnapshot());

    const { getAdminShardHealthDashboardData } = await import(
      "@/lib/adminShardHealth"
    );
    const data = await getAdminShardHealthDashboardData();
    const statuses = new Map(
      data.shards.map((shard) => [shard.shardIndex, shard.status]),
    );

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(statuses.get(0)).toBe("healthy");
    expect(statuses.get(1)).toBe("failed");
    expect(statuses.get(2)).toBe("stale");
    expect(statuses.get(3)).toBe("warning");
    expect(data.summary).toMatchObject({
      totalShards: 4,
      healthyShards: 1,
      failedShards: 1,
      staleShards: 1,
      warningShards: 1,
      missingShards: 0,
      totalRuns: 4,
      totalFailedRuns: 1,
    });
    expect(data.failedShards).toHaveLength(1);
    expect(data.problemShards).toHaveLength(3);
    expect(data.recentRuns[0]).toMatchObject({
      shardIndex: 1,
      status: "failed",
      errorMessage: "Feed fetch failed",
    });
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-worker-shards",
      {
        limit: 500,
        shardCount: 4,
        staleAfterMinutes: 180,
        slowRunMs: 15000,
        dailyWindowDays: 7,
      },
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps empty worker telemetry as a configured empty dashboard", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(workerShardSnapshot([]));

    const { getAdminShardHealthDashboardData } = await import(
      "@/lib/adminShardHealth"
    );
    const data = await getAdminShardHealthDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.summary).toMatchObject({
      totalShards: 4,
      totalRuns: 0,
      missingShards: 4,
    });
    expect(data.shards.every((shard) => shard.status === "missing")).toBe(true);
    expect(data.recentRuns).toEqual([]);
  });

  it("surfaces backend API setup failures without falling back to Supabase env copy", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockRejectedValue(
      new mocks.runtimeSafetyError("backend_api_config_missing"),
    );

    const { getAdminShardHealthDashboardData } = await import(
      "@/lib/adminShardHealth"
    );
    const data = await getAdminShardHealthDashboardData();

    expect(data.isConfigured).toBe(false);
    expect(data.errorMessage).toMatch(
      /NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/,
    );
    expect(data.errorMessage).not.toMatch(/SUPABASE/);
    expect(data.summary.missingShards).toBe(4);
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps Supabase primary reads behind the provider-neutral fallback", async () => {
    const supabaseClient = createSupabaseWorkerRunsClient();
    mocks.getDatabaseProviderMode.mockReturnValue("supabase_primary");
    mocks.getServerSupabaseConfig.mockReturnValue({
      url: "https://stage-project.supabase.co",
      serviceRoleKey: "server-only-service-role-key",
    });
    mocks.getServerSupabase.mockReturnValue(supabaseClient);

    const { getAdminShardHealthDashboardData } = await import(
      "@/lib/adminShardHealth"
    );
    const data = await getAdminShardHealthDashboardData();
    const workerQuery = supabaseClient.selectCalls.find(
      (call) => call.table === "worker_runs",
    )?.query;

    expect(data.isConfigured).toBe(true);
    expect(data.summary.totalRuns).toBe(4);
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getServerSupabase).toHaveBeenCalledTimes(1);
    expect(workerQuery?.calls).toEqual(
      expect.arrayContaining([
        { method: "order", args: ["run_started_at", { ascending: false }] },
        { method: "limit", args: [500] },
      ]),
    );
  });
});
