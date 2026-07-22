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

function sourceCategoryRow(source: string, category: string) {
  return {
    source,
    category,
    outbound_click_count: source === "Reuters" ? "5" : 2,
    category_interest_count: source === "Reuters" ? 3 : "4",
    total_engagement_count: source === "Reuters" ? "8" : 6,
    first_event_date: "2026-07-20",
    latest_event_date: "2026-07-21",
    last_updated_at:
      source === "Reuters" ? "2026-07-22T10:00:00.000Z" : null,
  };
}

function articleRow() {
  return {
    article_id: "4a225989-6ca9-4b31-a727-873ab7a6d8e0",
    title: "Election results point to coalition talks",
    original_url: "https://publisher.example.com/election-results",
    source: "Reuters",
    category: "World",
    outbound_click_count: "5",
    first_event_date: "2026-07-20",
    latest_event_date: "2026-07-21",
    last_updated_at: "2026-07-22T10:00:00.000Z",
  };
}

function backendSnapshot() {
  return {
    rows: [
      {
        sourceCategoryRows: [
          sourceCategoryRow("Reuters", "World"),
          sourceCategoryRow("AP", "Technology"),
        ],
        sourceCategoryError: null,
        articleRows: [articleRow()],
        articleError: null,
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

  query.order = chain("order");
  query.limit = chain("limit");
  query.then = resolved.then.bind(resolved);
  return query;
}

function createSupabaseClientSnapshot() {
  const snapshot = backendSnapshot().rows[0];
  const selectCalls: SelectCall[] = [];

  const client = {
    selectCalls,
    from: vi.fn((table: string) => ({
      select: vi.fn((columns: string) => {
        let response: unknown;

        if (table === "article_engagement_source_category_summary") {
          response = {
            data: snapshot.sourceCategoryRows,
            error: null,
          };
        } else if (table === "article_engagement_article_summary") {
          response = {
            data: snapshot.articleRows,
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

describe("admin article engagement data access", () => {
  it("loads engagement aggregates through the backend API without Supabase service-role access in backend primary mode", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(backendSnapshot());

    const { getAdminArticleEngagementDashboardData } = await import(
      "@/lib/adminArticleEngagement"
    );
    const data = await getAdminArticleEngagementDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.summary).toMatchObject({
      totalOutboundClicks: 7,
      totalCategoryInterest: 7,
      totalEngagement: 14,
      sourceCount: 2,
      categoryCount: 2,
      topSource: "Reuters",
      topCategory: "World",
    });
    expect(data.topSources[0]).toMatchObject({
      label: "Reuters",
      totalEngagementCount: 8,
    });
    expect(data.topArticles[0]).toMatchObject({
      articleId: "4a225989-6ca9-4b31-a727-873ab7a6d8e0",
      originalUrl: "https://publisher.example.com/election-results",
      outboundClickCount: 5,
    });
    expect(data.articleSql).toContain("original_url");
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-article-engagement",
      {
        sourceCategoryLimit: 100,
        articleLimit: 25,
      },
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps Supabase view reads in Supabase primary mode", async () => {
    const supabaseClient = createSupabaseClientSnapshot();
    mocks.getDatabaseProviderMode.mockReturnValue("supabase_primary");
    mocks.getServerSupabaseConfig.mockReturnValue({
      url: "https://stage-project.supabase.co",
      serviceRoleKey: "server-only-service-role-key",
    });
    mocks.getServerSupabase.mockReturnValue(supabaseClient);

    const { getAdminArticleEngagementDashboardData } = await import(
      "@/lib/adminArticleEngagement"
    );
    const data = await getAdminArticleEngagementDashboardData();
    const sourceCategoryQuery = supabaseClient.selectCalls.find(
      (call) => call.table === "article_engagement_source_category_summary",
    )?.query;
    const articleQuery = supabaseClient.selectCalls.find(
      (call) => call.table === "article_engagement_article_summary",
    )?.query;

    expect(data.isConfigured).toBe(true);
    expect(data.sourceCategoryRows).toHaveLength(2);
    expect(data.topArticles).toHaveLength(1);
    expect(sourceCategoryQuery?.calls).toEqual(
      expect.arrayContaining([
        {
          method: "order",
          args: ["total_engagement_count", { ascending: false }],
        },
        {
          method: "order",
          args: ["latest_event_date", { ascending: false, nullsFirst: false }],
        },
        { method: "limit", args: [100] },
      ]),
    );
    expect(articleQuery?.calls).toEqual(
      expect.arrayContaining([
        {
          method: "order",
          args: ["outbound_click_count", { ascending: false }],
        },
        {
          method: "order",
          args: ["latest_event_date", { ascending: false, nullsFirst: false }],
        },
        { method: "limit", args: [25] },
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

    const { getAdminArticleEngagementDashboardData } = await import(
      "@/lib/adminArticleEngagement"
    );
    const data = await getAdminArticleEngagementDashboardData();

    expect(data.isConfigured).toBe(false);
    expect(data.errorMessage).toMatch(/NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/);
    expect(data.errorMessage).not.toMatch(/SUPABASE/);
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });
});
