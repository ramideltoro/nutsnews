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
    assertDataMutation: vi.fn(),
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
  assertDataMutation: mocks.assertDataMutation,
  getDatabaseProviderMode: mocks.getDatabaseProviderMode,
  getRuntimeSafetyPolicy: mocks.getRuntimeSafetyPolicy,
}));

vi.mock("@/lib/supabase", () => ({
  getServerSupabase: mocks.getServerSupabase,
  getServerSupabaseConfig: mocks.getServerSupabaseConfig,
}));

type FetchCall = {
  url: string;
  init: RequestInit | undefined;
};

function feedQualityRow(overrides: Record<string, unknown> = {}) {
  return {
    feed_id: 1,
    source: "Strong Source",
    feed_url: "https://publisher.example/feed.xml",
    is_active: true,
    is_positive_source: true,
    source_trust_tier: "trusted",
    publisher_allowlist_status: "allowlisted",
    recommended_trust_tier: "trusted",
    tier_recommendation_reason: "Strong source quality.",
    feed_health_id: 10,
    last_checked_at: "2026-07-22T11:45:00.000Z",
    last_success_at: "2026-07-22T11:45:00.000Z",
    last_failure_at: null,
    last_status: 200,
    last_error_message: null,
    last_article_count: 12,
    last_image_count: 10,
    last_accepted_count: 6,
    last_rejected_count: 1,
    consecutive_failure_count: 0,
    total_fetch_count: "10",
    total_success_count: "9",
    total_failure_count: "1",
    total_article_count: "40",
    total_image_count: "32",
    total_accepted_count: "18",
    total_rejected_count: "4",
    unique_reviewed_url_count: "22",
    unique_published_url_count: "14",
    success_rate_pct: "90",
    thumbnail_rate_pct: "80",
    accepted_rate_pct: "82",
    failure_rate_pct: "10",
    duplicate_rate_pct: "8",
    quality_score: "94",
    quality_grade: "excellent",
    quality_reason: "High acceptance and image coverage.",
    updated_at: "2026-07-22T11:45:00.000Z",
    ...overrides,
  };
}

function weakFeedQualityRow() {
  return feedQualityRow({
    feed_id: 2,
    source: "Weak Source",
    feed_url: "https://publisher.example/weak.xml",
    is_active: true,
    is_positive_source: false,
    source_trust_tier: "experimental",
    publisher_allowlist_status: "candidate",
    recommended_trust_tier: "disabled",
    tier_recommendation_reason: "Repeated failures.",
    last_checked_at: "2026-07-22T10:00:00.000Z",
    consecutive_failure_count: 3,
    total_fetch_count: 8,
    total_success_count: 2,
    total_failure_count: 6,
    total_article_count: 20,
    total_image_count: 1,
    total_accepted_count: 0,
    total_rejected_count: 10,
    success_rate_pct: 25,
    thumbnail_rate_pct: 5,
    accepted_rate_pct: 0,
    failure_rate_pct: 75,
    duplicate_rate_pct: 30,
    quality_score: 22,
    quality_grade: "poor",
    quality_reason: "Low quality.",
  });
}

function inactiveFeedQualityRow() {
  return feedQualityRow({
    feed_id: 3,
    source: "Disabled Source",
    feed_url: "https://publisher.example/disabled.xml",
    is_active: false,
    source_trust_tier: "disabled",
    publisher_allowlist_status: "blocked",
    recommended_trust_tier: "disabled",
    quality_score: 0,
    quality_grade: "inactive",
    last_checked_at: null,
  });
}

function auditEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "audit-1",
    created_at: "2026-07-22T12:00:00.000Z",
    actor_email: "admin@example.com",
    action: "rss_feed.trust_tier_update",
    target_type: "rss_feed",
    target_id: "1",
    target_label: "Strong Source",
    before_values: {
      source_trust_tier: "experimental",
      publisher_allowlist_status: "candidate",
    },
    after_values: {
      source_trust_tier: "trusted",
      publisher_allowlist_status: "allowlisted",
    },
    metadata: {
      surface: "admin_feed_management",
    },
    ...overrides,
  };
}

function rowsResult(rows: Array<Record<string, unknown>>) {
  return {
    rows,
    rowCount: rows.length,
    generatedAt: "2026-07-22T12:00:00.000Z",
  };
}

function mockBackendPrimary() {
  mocks.getDatabaseProviderMode.mockReturnValue("backend_postgres_primary");
  mocks.getRuntimeSafetyPolicy.mockReturnValue({
    databaseProviderMode: "backend_postgres_primary",
  });
}

function mockSupabasePrimary() {
  mocks.getDatabaseProviderMode.mockReturnValue("supabase_primary");
  mocks.getRuntimeSafetyPolicy.mockReturnValue({
    databaseProviderMode: "supabase_primary",
  });
  mocks.getServerSupabaseConfig.mockReturnValue({
    url: "https://stage-project.supabase.co",
    serviceRoleKey: "server-only-service-role-key",
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-22T12:00:00.000Z"));
  mocks.assertDataMutation.mockReset();
  mocks.callBackendDatabaseOperation.mockReset();
  mocks.getDatabaseProviderMode.mockReset();
  mocks.getRuntimeSafetyPolicy.mockReset();
  mocks.getServerSupabase.mockReset();
  mocks.getServerSupabaseConfig.mockReset();
  mockSupabasePrimary();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("admin feed management provider-neutral data access", () => {
  it("loads Feed Management through the backend API and preserves ranking/status logic", async () => {
    mockBackendPrimary();
    mocks.callBackendDatabaseOperation.mockResolvedValue(
      rowsResult([feedQualityRow(), weakFeedQualityRow(), inactiveFeedQualityRow()]),
    );

    const { getAdminFeedManagementDashboardData } = await import(
      "@/lib/adminFeedManagement"
    );
    const data = await getAdminFeedManagementDashboardData();
    const statuses = new Map(data.feeds.map((feed) => [feed.source, feed.status]));

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(statuses.get("Weak Source")).toBe("failing");
    expect(statuses.get("Strong Source")).toBe("active");
    expect(statuses.get("Disabled Source")).toBe("inactive");
    expect(data.summary).toMatchObject({
      totalFeeds: 3,
      activeFeeds: 2,
      inactiveFeeds: 1,
      trustedFeeds: 1,
      disabledTierFeeds: 1,
      allowlistedPublishers: 1,
      blockedPublishers: 1,
      failingFeeds: 1,
      excellentFeeds: 1,
      poorFeeds: 1,
    });
    expect(data.lowQualityFeeds.map((feed) => feed.source)).toContain("Weak Source");
    expect(data.recommendedDisableFeeds.map((feed) => feed.source)).toContain("Weak Source");
    expect(data.bestQualityFeeds[0]).toMatchObject({
      source: "Strong Source",
      qualityScore: 94,
    });
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-feed-management",
      { limit: 10000 },
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
    expect(mocks.getServerSupabase).not.toHaveBeenCalled();
  });

  it("keeps empty feed management telemetry as a configured empty dashboard", async () => {
    mockBackendPrimary();
    mocks.callBackendDatabaseOperation.mockResolvedValue(rowsResult([]));

    const { getAdminFeedManagementDashboardData } = await import(
      "@/lib/adminFeedManagement"
    );
    const data = await getAdminFeedManagementDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.summary.totalFeeds).toBe(0);
    expect(data.feeds).toEqual([]);
  });

  it("surfaces backend setup failures for Feed Management without Supabase env copy", async () => {
    mockBackendPrimary();
    mocks.callBackendDatabaseOperation.mockRejectedValue(
      new mocks.runtimeSafetyError("backend_api_config_missing"),
    );

    const { getAdminFeedManagementDashboardData } = await import(
      "@/lib/adminFeedManagement"
    );
    const data = await getAdminFeedManagementDashboardData();

    expect(data.isConfigured).toBe(false);
    expect(data.errorMessage).toMatch(
      /NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/,
    );
    expect(data.errorMessage).not.toMatch(/SUPABASE/);
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps Supabase primary Feed Management reads behind the fallback", async () => {
    const fetchCalls: FetchCall[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init });
      return Response.json([feedQualityRow()]);
    }));

    const { getAdminFeedManagementDashboardData } = await import(
      "@/lib/adminFeedManagement"
    );
    const data = await getAdminFeedManagementDashboardData();

    expect(data.isConfigured).toBe(true);
    expect(data.summary.totalFeeds).toBe(1);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain("/rest/v1/feed_quality_scores");
    expect(fetchCalls[0].url).toContain("order=quality_score.asc,total_accepted_count.desc");
    expect(fetchCalls[0].init?.cache).toBe("no-store");
    expect((fetchCalls[0].init?.headers as Record<string, string>).apikey).toBe(
      "server-only-service-role-key",
    );
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).toHaveBeenCalledTimes(1);
  });

  it("mutates feed active status through the backend API and requires audit evidence", async () => {
    mockBackendPrimary();
    mocks.callBackendDatabaseOperation.mockResolvedValue({
      ok: true,
      changed: true,
      auditEventId: "audit-1",
    });

    const { setAdminRssFeedActiveStatus } = await import(
      "@/lib/adminFeedManagement"
    );
    const result = await setAdminRssFeedActiveStatus({
      actorEmail: " Admin@Example.COM ",
      feedUrl: "https://publisher.example/feed.xml",
      isActive: false,
    });

    expect(result).toEqual({ ok: true, message: "Feed disabled." });
    expect(mocks.assertDataMutation).toHaveBeenCalledWith("admin-feed-management");
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "set-admin-rss-feed-active-status",
      {
        actorEmail: "admin@example.com",
        feedUrl: "https://publisher.example/feed.xml",
        active: false,
      },
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("rejects backend feed mutations that do not return an audit event", async () => {
    mockBackendPrimary();
    mocks.callBackendDatabaseOperation.mockResolvedValue({
      ok: true,
      changed: true,
      auditEventId: null,
    });

    const { setAdminRssFeedActiveStatus } = await import(
      "@/lib/adminFeedManagement"
    );
    const result = await setAdminRssFeedActiveStatus({
      actorEmail: "admin@example.com",
      feedUrl: "https://publisher.example/feed.xml",
      isActive: true,
    });

    expect(result).toEqual({
      ok: false,
      message: "Feed status changed, but the audit event was not returned.",
    });
  });

  it("mutates source trust tier and publisher allowlist through the backend API", async () => {
    mockBackendPrimary();
    mocks.callBackendDatabaseOperation.mockResolvedValue({
      ok: true,
      changed: true,
      auditEventId: "audit-2",
      nextSourceTrustTier: "disabled",
      nextPublisherAllowlistStatus: "blocked",
    });

    const { setAdminRssFeedTrustTier } = await import(
      "@/lib/adminFeedManagement"
    );
    const result = await setAdminRssFeedTrustTier({
      actorEmail: "admin@example.com",
      feedUrl: "https://publisher.example/feed.xml",
      sourceTrustTier: "disabled",
      publisherAllowlistStatus: "blocked",
    });

    expect(result).toEqual({
      ok: true,
      message: "Source trust tier set to Disabled and feed disabled.",
    });
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "set-admin-rss-feed-trust-tier",
      {
        actorEmail: "admin@example.com",
        feedUrl: "https://publisher.example/feed.xml",
        sourceTrustTier: "disabled",
        publisherAllowlistStatus: "blocked",
      },
      { cache: "no-store" },
    );
  });

  it("denies unsafe feed mutation URLs before backend or Supabase access", async () => {
    mockBackendPrimary();

    const { setAdminRssFeedTrustTier } = await import(
      "@/lib/adminFeedManagement"
    );
    const result = await setAdminRssFeedTrustTier({
      actorEmail: "admin@example.com",
      feedUrl: "http://169.254.169.254/latest/meta-data",
      sourceTrustTier: "trusted",
      publisherAllowlistStatus: "allowlisted",
    });

    expect(result).toEqual({ ok: false, message: "Feed URL is not allowed." });
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("keeps Supabase primary feed mutations behind audited RPC fallbacks", async () => {
    const fetchCalls: FetchCall[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init });

      if (url.includes("set_rss_feed_active_with_audit")) {
        return Response.json([
          {
            feed_id: 1,
            feed_source: "Strong Source",
            feed_url: "https://publisher.example/feed.xml",
            previous_is_active: true,
            next_is_active: false,
            audit_event_id: "audit-active",
          },
        ]);
      }

      if (url.includes("set_rss_feed_trust_tier_with_audit")) {
        return Response.json([
          {
            feed_id: 1,
            feed_source: "Strong Source",
            feed_url: "https://publisher.example/feed.xml",
            previous_source_trust_tier: "experimental",
            next_source_trust_tier: "watchlist",
            previous_publisher_allowlist_status: "candidate",
            next_publisher_allowlist_status: "candidate",
            previous_is_active: true,
            next_is_active: true,
            audit_event_id: "audit-trust",
          },
        ]);
      }

      throw new Error(`Unexpected URL ${url}`);
    }));

    const {
      setAdminRssFeedActiveStatus,
      setAdminRssFeedTrustTier,
    } = await import("@/lib/adminFeedManagement");
    const activeResult = await setAdminRssFeedActiveStatus({
      actorEmail: "admin@example.com",
      feedUrl: "https://publisher.example/feed.xml",
      isActive: false,
    });
    const tierResult = await setAdminRssFeedTrustTier({
      actorEmail: "admin@example.com",
      feedUrl: "https://publisher.example/feed.xml",
      sourceTrustTier: "watchlist",
      publisherAllowlistStatus: "candidate",
    });

    expect(activeResult).toEqual({ ok: true, message: "Feed disabled." });
    expect(tierResult).toEqual({
      ok: true,
      message: "Source trust tier updated to Watchlist.",
    });
    expect(fetchCalls.map((call) => call.url)).toEqual([
      "https://stage-project.supabase.co/rest/v1/rpc/set_rss_feed_active_with_audit",
      "https://stage-project.supabase.co/rest/v1/rpc/set_rss_feed_trust_tier_with_audit",
    ]);
    expect(
      JSON.parse(String(fetchCalls[0].init?.body)),
    ).toMatchObject({
      p_actor_email: "admin@example.com",
      p_feed_url: "https://publisher.example/feed.xml",
      p_is_active: false,
    });
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
  });
});

describe("admin audit log provider-neutral data access", () => {
  it("loads Audit Log through the backend API and preserves labels and values", async () => {
    mockBackendPrimary();
    mocks.callBackendDatabaseOperation.mockResolvedValue(rowsResult([auditEventRow()]));

    const { getAdminAuditLogData } = await import("@/lib/adminAuditLog");
    const data = await getAdminAuditLogData(25);

    expect(data.isConfigured).toBe(true);
    expect(data.errorMessage).toBeNull();
    expect(data.events[0]).toMatchObject({
      id: "audit-1",
      actorEmail: "admin@example.com",
      actionLabel: "RSS source trust tier updated",
      targetType: "rss_feed",
      targetId: "1",
      targetLabel: "Strong Source",
      beforeValues: {
        source_trust_tier: "experimental",
      },
      afterValues: {
        source_trust_tier: "trusted",
      },
      metadata: {
        surface: "admin_feed_management",
      },
    });
    expect(mocks.callBackendDatabaseOperation).toHaveBeenCalledWith(
      "load-admin-audit-log",
      { limit: 25 },
      { cache: "no-store" },
    );
    expect(mocks.getServerSupabaseConfig).not.toHaveBeenCalled();
  });

  it("surfaces backend setup failures for Audit Log without Supabase env copy", async () => {
    mockBackendPrimary();
    mocks.callBackendDatabaseOperation.mockRejectedValue(
      new mocks.runtimeSafetyError("backend_api_config_missing"),
    );

    const { getAdminAuditLogData } = await import("@/lib/adminAuditLog");
    const data = await getAdminAuditLogData();

    expect(data.isConfigured).toBe(false);
    expect(data.errorMessage).toMatch(
      /NUTSNEWS_BACKEND_API_URL and NUTSNEWS_BACKEND_API_TOKEN/,
    );
    expect(data.errorMessage).not.toMatch(/SUPABASE/);
  });

  it("keeps Supabase primary Audit Log reads behind the fallback", async () => {
    const fetchCalls: FetchCall[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      fetchCalls.push({ url, init });
      return Response.json([auditEventRow()]);
    }));

    const { getAdminAuditLogData } = await import("@/lib/adminAuditLog");
    const data = await getAdminAuditLogData(500);

    expect(data.isConfigured).toBe(true);
    expect(data.events).toHaveLength(1);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain("/rest/v1/admin_audit_events");
    expect(fetchCalls[0].url).toContain("order=created_at.desc");
    expect(fetchCalls[0].url).toContain("limit=50");
    expect((fetchCalls[0].init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer server-only-service-role-key",
    );
    expect(mocks.callBackendDatabaseOperation).not.toHaveBeenCalled();
  });
});
