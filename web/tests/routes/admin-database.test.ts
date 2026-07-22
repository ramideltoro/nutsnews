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

beforeEach(() => {
  vi.resetModules();
  mocks.callBackendDatabaseOperation.mockReset();
  mocks.getDatabaseProviderMode.mockReset();
  mocks.getRuntimeSafetyPolicy.mockReset();
  mocks.getServerSupabase.mockReset();
  mocks.getServerSupabaseConfig.mockReset();
  mocks.getRuntimeSafetyPolicy.mockReturnValue({
    databaseProviderMode: "supabase_primary",
  });
});

describe("admin database access", () => {
  it("dispatches admin reads to the backend API without touching Supabase in backend primary mode", async () => {
    const env = {
      NUTSNEWS_DATABASE_PROVIDER_MODE: "backend_postgres_primary",
    } as unknown as NodeJS.ProcessEnv;
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
    mocks.callBackendDatabaseOperation.mockResolvedValue({
      rows: [{ id: "article-1" }],
      rowCount: 1,
    });

    const { readAdminDatabase } = await import("@/lib/adminDatabase");
    const result = await readAdminDatabase(
      "load-admin-article-reviews",
      { limit: 25, filters: { decision: "accepted" } },
      async () => {
        throw new Error("Supabase handler should not run in backend primary mode.");
      },
      { env },
    );

    expect(result).toEqual({ rows: [{ id: "article-1" }], rowCount: 1 });
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-article-reviews",
      { limit: 25, filters: { decision: "accepted" } },
      { env },
    );
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("preserves lazy Supabase service-role behavior in Supabase primary mode", async () => {
    const supabaseClient = { from: vi.fn() };
    const supabaseConfig = {
      url: "https://stage-project.supabase.co",
      serviceRoleKey: "server-only-service-role-key",
    };
    mocks.getDatabaseProviderMode.mockReturnValue("supabase_primary");
    mocks.getServerSupabase.mockReturnValue(supabaseClient);
    mocks.getServerSupabaseConfig.mockReturnValue(supabaseConfig);

    const { readAdminDatabase } = await import("@/lib/adminDatabase");
    const result = await readAdminDatabase(
      "load-admin-feed-management",
      { limit: 50 },
      async (context) => ({
        rows: [
          {
            providerMode: context.providerMode,
            operation: context.operation,
            hasClient: context.getClient() === (supabaseClient as unknown),
            configUrl: context.getConfig().url,
          },
        ],
      }),
    );

    expect(result).toEqual({
      rows: [
        {
          providerMode: "supabase_primary",
          operation: "load-admin-feed-management",
          hasClient: true,
          configUrl: "https://stage-project.supabase.co",
        },
      ],
    });
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
    expect(mocks.getServerSupabase).toHaveBeenCalledTimes(1);
    expect(mocks.getServerSupabaseConfig).toHaveBeenCalledTimes(1);
  });

  it("uses Supabase for backend shadow mode until individual admin dashboards migrate", async () => {
    mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_shadow");

    const { readAdminDatabase } = await import("@/lib/adminDatabase");
    const result = await readAdminDatabase(
      "load-admin-production-readiness",
      {},
      async (context) => ({
        rows: [{ providerMode: context.providerMode }],
      }),
    );

    expect(result).toEqual({
      rows: [{ providerMode: "backend_postgres_shadow" }],
    });
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
  });

  it("turns missing backend config into an actionable admin database error", async () => {
    const error = new mocks.runtimeSafetyError("backend_api_config_missing");
    mocks.getDatabaseProviderMode.mockImplementation(() => {
      throw error;
    });
    mocks.getRuntimeSafetyPolicy.mockReturnValue({
      databaseProviderMode: "backend_postgres_primary",
    });

    const { AdminDatabaseAccessError, readAdminDatabase } = await import("@/lib/adminDatabase");

    let thrown: unknown;
    try {
      await readAdminDatabase(
        "load-admin-ai-usage",
        {},
        async () => ({ rows: [] }),
      );
    } catch (caught) {
      thrown = caught;
    }

    expect(thrown).toBeInstanceOf(AdminDatabaseAccessError);
    expect(thrown).toMatchObject({
      name: "AdminDatabaseAccessError",
      code: "backend_api_config_missing",
      operation: "load-admin-ai-usage",
      providerMode: "backend_postgres_primary",
    });
    expect((thrown as Error).message).toMatch(
      /NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/,
    );
    expect((thrown as Error).message).not.toMatch(
      /Server-side Supabase access is not configured/,
    );
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("declares typed admin read and mutation operation names", async () => {
    const {
      ADMIN_DATABASE_MUTATION_OPERATIONS,
      ADMIN_DATABASE_READ_OPERATIONS,
    } = await import("@/lib/adminDatabase");

    expect(ADMIN_DATABASE_READ_OPERATIONS).toEqual(
      expect.arrayContaining([
        "load-admin-production-readiness",
        "load-admin-article-reviews",
        "load-admin-article-engagement",
        "load-admin-ai-usage",
        "load-admin-local-ai",
        "load-admin-translation-quality",
        "load-admin-guardrails",
        "load-admin-worker-shards",
        "load-admin-rss-feed-health",
        "load-admin-feed-management",
        "load-admin-audit-log",
      ]),
    );
    expect(ADMIN_DATABASE_MUTATION_OPERATIONS).toEqual(
      expect.arrayContaining([
        "set-admin-rss-feed-active-status",
        "set-admin-rss-feed-trust-tier",
        "insert-admin-audit-log-event",
      ]),
    );
  });
});
