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
  then: Promise<unknown>["then"];
};

type SelectCall = {
  table: string;
  columns: string;
  query: SupabaseQueryMock;
};

function rssFeedRow(overrides: Record<string, unknown> = {}) {
  return {
    source: "Healthy Source",
    url: "https://feeds.example.test/healthy.xml",
    is_positive_source: true,
    is_active: true,
    ...overrides,
  };
}

function feedHealthRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    source: "Healthy Source",
    feed_url: "https://feeds.example.test/healthy.xml",
    last_checked_at: "2026-07-22T11:30:00.000Z",
    last_success_at: "2026-07-22T11:30:00.000Z",
    last_failure_at: null,
    last_status: 200,
    last_error_message: null,
    last_article_count: 8,
    last_image_count: 5,
    last_accepted_count: 4,
    last_rejected_count: 1,
    consecutive_failure_count: 0,
    total_fetch_count: "10",
    total_success_count: "9",
    total_failure_count: "1",
    total_article_count: "30",
    total_image_count: "15",
    total_accepted_count: "7",
    total_rejected_count: "3",
    created_at: "2026-07-20T10:00:00.000Z",
    updated_at: "2026-07-22T11:30:00.000Z",
    ...overrides,
  };
}

function feedHealthRows() {
  return [
    feedHealthRow(),
    feedHealthRow({
      id: 2,
      source: "Failing Source",
      feed_url: "https://feeds.example.test/failing.xml",
      last_checked_at: "2026-07-22T11:15:00.000Z",
      last_success_at: "2026-07-21T09:00:00.000Z",
      last_failure_at: "2026-07-22T11:15:00.000Z",
      last_status: 500,
      last_error_message: "HTTP 500",
      consecutive_failure_count: 3,
      total_fetch_count: 6,
      total_success_count: 3,
      total_failure_count: 3,
      total_article_count: 12,
      total_image_count: 6,
      total_accepted_count: 2,
      total_rejected_count: 2,
    }),
    feedHealthRow({
      id: 3,
      source: "Stale Source",
      feed_url: "https://feeds.example.test/stale.xml",
      last_checked_at: "2026-07-20T11:00:00.000Z",
      last_success_at: "2026-07-20T11:00:00.000Z",
      total_fetch_count: 8,
      total_success_count: 8,
      total_failure_count: 0,
      total_article_count: 16,
      total_image_count: 12,
      total_accepted_count: 5,
      total_rejected_count: 2,
    }),
    feedHealthRow({
      id: 4,
      source: "Low Image Source",
      feed_url: "https://feeds.example.test/low-images.xml",
      last_checked_at: "2026-07-22T11:45:00.000Z",
      total_fetch_count: 12,
      total_success_count: 12,
      total_failure_count: 0,
      total_article_count: 40,
      total_image_count: 2,
      total_accepted_count: 3,
      total_rejected_count: 6,
    }),
  ];
}

function rssFeedRows() {
  return [
    rssFeedRow(),
    rssFeedRow({
      source: "Failing Source",
      url: "https://feeds.example.test/failing.xml",
    }),
    rssFeedRow({
      source: "Stale Source",
      url: "https://feeds.example.test/stale.xml",
    }),
    rssFeedRow({
      source: "Low Image Source",
      url: "https://feeds.example.test/low-images.xml",
    }),
    rssFeedRow({
      source: "New Source",
      url: "https://feeds.example.test/new.xml",
    }),
    rssFeedRow({
      source: "Disabled Source",
      url: "https://feeds.example.test/disabled.xml",
      is_active: false,
    }),
  ];
}

function backendSnapshot({
  rssFeedRows: feedRows = rssFeedRows(),
  feedHealthRows: healthRows = feedHealthRows(),
}: {
  rssFeedRows?: Array<Record<string, unknown>>;
  feedHealthRows?: Array<Record<string, unknown>>;
} = {}) {
  return {
    rows: [
      {
        rssFeedRows: feedRows,
        feedHealthRows: healthRows,
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

  query.order = vi.fn((...args: unknown[]) => {
    query.calls.push({ method: "order", args });
    return query;
  });
  query.then = resolved.then.bind(resolved);
  return query;
}

function createSupabaseFeedHealthClient({
  feedRows = rssFeedRows(),
  healthRows = feedHealthRows(),
}: {
  feedRows?: Array<Record<string, unknown>>;
  healthRows?: Array<Record<string, unknown>>;
} = {}) {
  const selectCalls: SelectCall[] = [];
  const client = {
    selectCalls,
    from: vi.fn((table: string) => ({
      select: vi.fn((columns: string) => {
        let data: unknown;

        if (table === "rss_feeds") {
          data = feedRows;
        } else if (table === "feed_health") {
          data = healthRows;
        } else {
          throw new Error(`Unexpected Supabase table ${table}.`);
        }

        const query = createQuery({ data, error: null });
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

describe("admin RSS feed health data access", () => {
  it("loads RSS feed health through the backend API and preserves feed status logic", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(backendSnapshot());

    const { getAdminFeedHealthDashboardData } = await import(
      "@/lib/adminFeedHealth"
    );
    const data = await getAdminFeedHealthDashboardData();
    const statuses = new Map(
      data.feeds.map((feed) => [feed.source, feed.status]),
    );

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(statuses.get("Healthy Source")).toBe("healthy");
    expect(statuses.get("Failing Source")).toBe("failed");
    expect(statuses.get("Stale Source")).toBe("stale");
    expect(statuses.get("Low Image Source")).toBe("warning");
    expect(statuses.get("New Source")).toBe("missing");
    expect(statuses.get("Disabled Source")).toBe("disabled");
    expect(data.summary).toMatchObject({
      totalFeeds: 6,
      activeFeeds: 5,
      disabledFeeds: 1,
      trackedFeeds: 4,
      untrackedFeeds: 2,
      healthyFeeds: 1,
      warningFeeds: 1,
      failedFeeds: 1,
      staleFeeds: 1,
      totalAcceptedCount: 17,
    });
    expect(data.weakFeeds.map((feed) => feed.source)).toEqual([
      "Failing Source",
      "Low Image Source",
      "Stale Source",
      "New Source",
    ]);
    expect(data.bestFeeds[0]).toMatchObject({
      source: "Healthy Source",
      totalAcceptedCount: 7,
    });
    expect(data.failedFeeds).toHaveLength(1);
    expect(data.staleFeeds).toHaveLength(1);
    expect(data.untrackedFeeds).toHaveLength(1);
    expect(data.disableWeakFeedsSql).toContain(
      "'https://feeds.example.test/failing.xml'",
    );
    expect(data.disableWeakFeedsSql).toContain(
      "'https://feeds.example.test/new.xml'",
    );
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-rss-feed-health",
      {
        limit: 10000,
        staleAfterHours: 24,
      },
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps empty feed telemetry as a configured empty dashboard", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(
      backendSnapshot({ rssFeedRows: [], feedHealthRows: [] }),
    );

    const { getAdminFeedHealthDashboardData } = await import(
      "@/lib/adminFeedHealth"
    );
    const data = await getAdminFeedHealthDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.summary.totalFeeds).toBe(0);
    expect(data.feeds).toEqual([]);
    expect(data.disableWeakFeedsSql).toBe(
      "-- No weak active feeds are currently recommended for disabling.",
    );
  });

  it("surfaces backend API setup failures without falling back to Supabase env copy", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockRejectedValue(
      new mocks.runtimeSafetyError("backend_api_config_missing"),
    );

    const { getAdminFeedHealthDashboardData } = await import(
      "@/lib/adminFeedHealth"
    );
    const data = await getAdminFeedHealthDashboardData();

    expect(data.isConfigured).toBe(false);
    expect(data.errorMessage).toMatch(
      /NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/,
    );
    expect(data.errorMessage).not.toMatch(/SUPABASE/);
    expect(data.summary.totalFeeds).toBe(0);
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps Supabase primary reads behind the provider-neutral fallback", async () => {
    const supabaseClient = createSupabaseFeedHealthClient();
    mocks.getDatabaseProviderMode.mockReturnValue("supabase_primary");
    mocks.getServerSupabaseConfig.mockReturnValue({
      url: "https://stage-project.supabase.co",
      serviceRoleKey: "server-only-service-role-key",
    });
    mocks.getServerSupabase.mockReturnValue(supabaseClient);

    const { getAdminFeedHealthDashboardData } = await import(
      "@/lib/adminFeedHealth"
    );
    const data = await getAdminFeedHealthDashboardData();
    const rssFeedsQuery = supabaseClient.selectCalls.find(
      (call) => call.table === "rss_feeds",
    )?.query;
    const feedHealthQuery = supabaseClient.selectCalls.find(
      (call) => call.table === "feed_health",
    )?.query;

    expect(data.isConfigured).toBe(true);
    expect(data.summary.totalFeeds).toBe(6);
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getServerSupabase).toHaveBeenCalledTimes(1);
    expect(rssFeedsQuery?.calls).toEqual([
      { method: "order", args: ["id", { ascending: true }] },
    ]);
    expect(feedHealthQuery?.calls).toEqual([
      { method: "order", args: ["total_accepted_count", { ascending: false }] },
    ]);
  });
});
