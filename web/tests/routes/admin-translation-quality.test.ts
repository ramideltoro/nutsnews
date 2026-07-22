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
  in: (column: string, values: unknown[]) => SupabaseQueryMock;
  order: (column: string, options?: Record<string, unknown>) => SupabaseQueryMock;
  limit: (count: number) => SupabaseQueryMock;
  then: Promise<unknown>["then"];
};

type SelectCall = {
  table: string;
  columns: string;
  query: SupabaseQueryMock;
};

function articleRow() {
  return {
    id: "article-translation-quality",
    source: "Reuters",
    title: "Community group opens a new food pantry",
    original_url: "https://publisher.example.com/food-pantry",
    ai_summary:
      "A community group opened a new food pantry to help families find fresh meals and local support after months of planning.",
    category: "Community",
    published_on_site_at: "2026-07-22T10:00:00.000Z",
    snapshot_rank: 1,
  };
}

function englishLeakingFrenchSummary() {
  return {
    original_url: "https://publisher.example.com/food-pantry",
    language_code: "fr",
    title: "Community members expand food pantry access",
    summary:
      "The community group opened a new food pantry and the story has details about people who help families with food, support, and new local services for their neighborhood.",
    updated_at: "2026-07-22T10:30:00.000Z",
    generated_by: "openai",
    model: "gpt-4o-mini",
  };
}

function mismatchedSwissGermanSummary() {
  return {
    original_url: "https://publisher.example.com/food-pantry",
    language_code: "de_ch",
    title: "Lokale Gruppe eröffnet eine neue Lebensmittelausgabe",
    summary:
      "Die lokale Gruppe eröffnet eine neue Lebensmittelausgabe und unterstützt Familien mit frischen Mahlzeiten, Beratung und praktischer Hilfe in der Nachbarschaft.",
    updated_at: "2026-07-22T10:35:00.000Z",
    generated_by: "local",
    model: "qwen2.5:3b",
  };
}

function backendSnapshot({
  articleRows = [articleRow()],
  summaryRows = [englishLeakingFrenchSummary(), mismatchedSwissGermanSummary()],
} = {}) {
  return {
    rows: [
      {
        articleRows,
        summaryRows,
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

  query.in = chain("in");
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

        if (table === "public_feed_snapshot") {
          response = {
            data: snapshot.articleRows,
            error: null,
          };
        } else if (table === "article_summaries") {
          response = {
            data: snapshot.summaryRows,
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
  vi.stubEnv("TRANSLATION_QUALITY_AUDIT_LIMIT", "60");
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

describe("admin translation quality data access", () => {
  it("loads translation quality through the backend API and preserves quality findings", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(backendSnapshot());

    const { getTranslationQualityDashboardData } = await import(
      "@/lib/adminTranslationQuality"
    );
    const data = await getTranslationQualityDashboardData();
    const issueCodes = data.issueRows.map((issue) => issue.issueCode);
    const swissGermanSummary = data.languageSummaries.find(
      (summary) => summary.languageCode === "de-CH",
    );

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.articleCount).toBe(1);
    expect(data.expectedTranslationCount).toBe(5);
    expect(data.availableTranslationCount).toBe(2);
    expect(data.missingTranslationCount).toBe(3);
    expect(data.qualityWarningCount).toBeGreaterThanOrEqual(1);
    expect(data.criticalIssueCount).toBeGreaterThanOrEqual(1);
    expect(data.overallStatus).toBe("fail");
    expect(issueCodes).toEqual(
      expect.arrayContaining([
        "missing_translation",
        "language_code_mismatch",
        "looks_like_english",
      ]),
    );
    expect(swissGermanSummary).toMatchObject({
      availableCount: 1,
      criticalCount: 1,
    });
    expect(data.fallbackPolicy).toMatch(/fall back to the canonical English/);
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-translation-quality",
      expect.objectContaining({
        auditLimit: 60,
        summaryLookupLimit: 20000,
        targetLanguageCodes: expect.arrayContaining(["fr", "ja", "de-CH", "de", "el"]),
      }),
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps empty translation telemetry as a configured empty dashboard", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockResolvedValue(
      backendSnapshot({ articleRows: [], summaryRows: [] }),
    );

    const { getTranslationQualityDashboardData } = await import(
      "@/lib/adminTranslationQuality"
    );
    const data = await getTranslationQualityDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.articleCount).toBe(0);
    expect(data.expectedTranslationCount).toBe(0);
    expect(data.availableTranslationCount).toBe(0);
    expect(data.missingTranslationCount).toBe(0);
    expect(data.overallStatus).toBe("pass");
    expect(data.issueRows).toEqual([]);
  });

  it("surfaces backend API configuration failures as dashboard copy", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });
    mocks.callBackendDatabaseOperation.mockRejectedValue(
      new mocks.runtimeSafetyError("backend_api_config_missing"),
    );

    const { getTranslationQualityDashboardData } = await import(
      "@/lib/adminTranslationQuality"
    );
    const data = await getTranslationQualityDashboardData();

    expect(data.isConfigured).toBe(false);
    expect(data.errorMessage).toMatch(
      /NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/,
    );
    expect(data.errorMessage).not.toMatch(/SUPABASE/);
    expect(data.overallStatus).toBe("fail");
    expect(data.criticalIssueCount).toBe(1);
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

    const { getTranslationQualityDashboardData } = await import(
      "@/lib/adminTranslationQuality"
    );
    const data = await getTranslationQualityDashboardData();
    const articleQuery = supabaseClient.selectCalls.find(
      (call) => call.table === "public_feed_snapshot",
    )?.query;
    const summaryQuery = supabaseClient.selectCalls.find(
      (call) => call.table === "article_summaries",
    )?.query;

    expect(data.isConfigured).toBe(true);
    expect(articleQuery?.calls).toEqual(
      expect.arrayContaining([
        { method: "order", args: ["snapshot_rank", { ascending: true }] },
        { method: "limit", args: [60] },
      ]),
    );
    expect(summaryQuery?.calls).toEqual(
      expect.arrayContaining([
        {
          method: "in",
          args: ["original_url", ["https://publisher.example.com/food-pantry"]],
        },
        { method: "limit", args: [20000] },
      ]),
    );
    expect(summaryQuery?.calls).not.toEqual(
      expect.arrayContaining([
        {
          method: "in",
          args: ["language_code", expect.any(Array)],
        },
      ]),
    );
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).toHaveBeenCalledTimes(1);
    expect(mocks.getServerSupabase).toHaveBeenCalledTimes(1);
  });
});
