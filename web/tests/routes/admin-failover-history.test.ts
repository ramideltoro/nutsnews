import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { failoverStatusExamples } from "@/lib/failoverStatusContract";

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-07-23T12:00:00.000Z");
const ORIGINAL_STATUS_URL = process.env.NUTSNEWS_FAILOVER_CONTROLLER_STATUS_URL;
const ORIGINAL_STATUS_SECRET = process.env.NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET;
const ORIGINAL_ACTION_SECRET = process.env.NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET;

function restoreOptionalEnv(name: string, value: string | undefined) {
  if (typeof value === "string") {
    process.env[name] = value;
  } else {
    delete process.env[name];
  }
}

function statusPayload(overrides: Record<string, unknown> = {}) {
  return {
    ...failoverStatusExamples.healthyVpsPrimary,
    generatedAt: "2026-07-23T11:59:55.000Z",
    lastVpsCheckAt: "2026-07-23T11:59:55.000Z",
    nextCheckDueAt: "2026-07-23T12:00:10.000Z",
    ...overrides,
  };
}

const healthyHistoryRow = {
  checkedAt: "2026-07-23T11:59:55.000Z",
  source: "scheduled_watchdog",
  healthResult: "reachable",
  vpsReachable: true,
  vpsStatus: 200,
  vpsLatencyMs: 42,
  observedDeploymentTarget: "production-vps",
  consecutiveVpsFailures: 0,
  activeDnsTarget: "vps",
  desiredDnsTarget: "vps",
  errorCode: null,
};

async function loadDashboardData(response: Response) {
  const fetchMock = vi.fn(async () => response);

  vi.stubGlobal("fetch", fetchMock);
  const { getAdminFailoverDashboardData } = await import("@/lib/adminFailover");
  const data = await getAdminFailoverDashboardData();

  return { data, fetchMock };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.NUTSNEWS_FAILOVER_CONTROLLER_STATUS_URL = "https://controller.example.test/status?mode=dashboard";
  process.env.NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET = "test-status-secret";
  process.env.NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET = "";
});

afterEach(() => {
  restoreOptionalEnv("NUTSNEWS_FAILOVER_CONTROLLER_STATUS_URL", ORIGINAL_STATUS_URL);
  restoreOptionalEnv("NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET", ORIGINAL_STATUS_SECRET);
  restoreOptionalEnv("NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET", ORIGINAL_ACTION_SECRET);
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("admin failover health history", () => {
  it("renders controller health history rows when present", async () => {
    const { data, fetchMock } = await loadDashboardData(Response.json(statusPayload({
      healthHistory: [
        healthyHistoryRow,
        {
          checkedAt: "2026-07-23T11:59:40.000Z",
          source: "manual_fetch",
          healthResult: "timeout",
          vpsReachable: false,
          vpsStatus: "timeout",
          vpsLatencyMs: 5000,
          observedDeploymentTarget: "unknown",
          consecutiveVpsFailures: 1,
          activeDnsTarget: "vps",
          desiredDnsTarget: "vps",
          errorCode: "timeout",
        },
      ],
    })));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(data.controllerReachable).toBe(true);
    expect(data.healthHistoryAvailable).toBe(true);
    expect(data.dnsHistoryAvailable).toBe(false);
    expect(data.historyAvailable).toBe(false);
    expect(data.historyMessage).toContain("DNS-change history");
    expect(data.historyMessage).not.toContain("health-check and DNS-change rows are not available");
    expect(data.recentHealthChecks).toHaveLength(2);
    expect(data.recentHealthChecks[0]).toMatchObject({
      timestamp: "2026-07-23T11:59:55.000Z",
      value: "Reachable",
      tone: "ok",
      source: "controller_history",
    });
    expect(data.recentHealthChecks[1]).toMatchObject({
      timestamp: "2026-07-23T11:59:40.000Z",
      value: "Unreachable",
      tone: "danger",
      source: "controller_history",
    });
  });

  it("falls back to the latest status snapshot when health history is empty", async () => {
    const { data } = await loadDashboardData(Response.json(statusPayload({ healthHistory: [] })));

    expect(data.controllerReachable).toBe(true);
    expect(data.healthHistoryAvailable).toBe(false);
    expect(data.historyMessage).toContain("Historical health-check and DNS-change rows");
    expect(data.recentHealthChecks).toHaveLength(1);
    expect(data.recentHealthChecks[0]).toMatchObject({
      id: "latest-vps-check",
      timestamp: "2026-07-23T11:59:55.000Z",
      value: "Reachable",
      source: "status_snapshot",
    });
  });

  it("keeps history unavailable when the controller status request fails", async () => {
    const { data } = await loadDashboardData(Response.json(
      { ok: false, error: "failover_state_unavailable" },
      { status: 503 },
    ));

    expect(data.controllerReachable).toBe(false);
    expect(data.healthHistoryAvailable).toBe(false);
    expect(data.dnsHistoryAvailable).toBe(false);
    expect(data.historyAvailable).toBe(false);
    expect(data.recentHealthChecks).toEqual([]);
    expect(data.recentDnsChanges).toEqual([]);
    expect(data.errorMessage).toBe("Failover controller status returned HTTP 503.");
  });
});

describe("admin failover DNS history", () => {
  it("renders controller DNS history rows when present", async () => {
    const { data } = await loadDashboardData(Response.json(statusPayload({
      healthHistory: [healthyHistoryRow],
      dnsHistory: [
        {
          changedAt: "2026-07-23T11:59:55.000Z",
          dnsAction: "manual_failover_to_vercel",
          previousTarget: "vps",
          newTarget: "vercel",
          activeDnsTarget: "vercel",
          desiredDnsTarget: "vercel",
          actualApexDnsTarget: "vercel",
          actualWwwDnsTarget: "vercel",
          result: "success",
          skipReason: null,
          errorCode: null,
        },
        {
          changedAt: "2026-07-23T11:59:40.000Z",
          dnsAction: "failover_to_vercel",
          previousTarget: "vps",
          newTarget: "vps",
          activeDnsTarget: "vps",
          desiredDnsTarget: "vercel",
          actualApexDnsTarget: "vps",
          actualWwwDnsTarget: "vps",
          result: "skipped",
          skipReason: "dns_write_not_implemented_for_observation_only_controller",
          errorCode: null,
        },
        {
          changedAt: "2026-07-23T11:59:25.000Z",
          dnsAction: "no_op",
          previousTarget: "vps",
          newTarget: "vps",
          activeDnsTarget: "vps",
          desiredDnsTarget: "vps",
          actualApexDnsTarget: "vps",
          actualWwwDnsTarget: "vps",
          result: "success",
          skipReason: "active_dns_target_matches_desired_target",
          errorCode: null,
        },
        {
          changedAt: "2026-07-23T11:59:10.000Z",
          dnsAction: "drift_detected",
          previousTarget: "vps",
          newTarget: "vps",
          activeDnsTarget: "vps",
          desiredDnsTarget: "vps",
          actualApexDnsTarget: "vercel",
          actualWwwDnsTarget: "vps",
          result: "skipped",
          skipReason: "actual_dns_target_differs_from_desired_target",
          errorCode: null,
        },
        {
          changedAt: "2026-07-23T11:58:55.000Z",
          dnsAction: "dns_api_error",
          previousTarget: "vps",
          newTarget: "vps",
          activeDnsTarget: "vps",
          desiredDnsTarget: "vps",
          actualApexDnsTarget: "unknown",
          actualWwwDnsTarget: "unknown",
          result: "failed",
          skipReason: "dns_readback_failed",
          errorCode: "cloudflare_dns_api_error",
        },
      ],
    })));

    expect(data.healthHistoryAvailable).toBe(true);
    expect(data.dnsHistoryAvailable).toBe(true);
    expect(data.historyAvailable).toBe(true);
    expect(data.historyMessage).toBe("");
    expect(data.recentDnsChanges).toHaveLength(5);
    expect(data.recentDnsChanges[0]).toMatchObject({
      title: "Manual failover",
      value: "Vercel",
      tone: "watch",
      source: "controller_history",
    });
    expect(data.recentDnsChanges[1]).toMatchObject({
      title: "Failover decision",
      value: "Skipped",
      tone: "watch",
      source: "controller_history",
    });
    expect(data.recentDnsChanges[2]).toMatchObject({
      title: "No DNS change",
      value: "VPS",
      tone: "neutral",
    });
    expect(data.recentDnsChanges[3]).toMatchObject({
      title: "DNS drift detected",
      value: "Skipped",
      tone: "danger",
    });
    expect(data.recentDnsChanges[4]).toMatchObject({
      title: "DNS API error",
      value: "Failed",
      tone: "danger",
    });
  });

  it("falls back to the latest status snapshot when DNS history is empty", async () => {
    const { data } = await loadDashboardData(Response.json(statusPayload({
      healthHistory: [healthyHistoryRow],
      dnsHistory: [],
    })));

    expect(data.healthHistoryAvailable).toBe(true);
    expect(data.dnsHistoryAvailable).toBe(false);
    expect(data.historyAvailable).toBe(false);
    expect(data.historyMessage).toContain("DNS-change history");
    expect(data.recentDnsChanges).toHaveLength(1);
    expect(data.recentDnsChanges[0]).toMatchObject({
      id: "no-recent-dns-change",
      value: "No change",
      source: "status_snapshot",
    });
  });
});
