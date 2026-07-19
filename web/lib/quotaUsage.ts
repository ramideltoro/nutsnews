import {
  callBackendDatabaseOperation,
  type DatabaseProviderMode,
} from "@/lib/backendDatabase";
import { getServerSupabase } from "@/lib/supabase";
import {
  RuntimeSafetyError,
  assertIsolatedDataMutation,
  getDatabaseProviderMode,
} from "@/lib/runtimeSafety";

type QuotaUsageEvent = {
  eventType: string;
  eventSource: string;
  provider?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
};

async function recordBackendQuotaUsageEvent({
  eventType,
  eventSource,
  provider,
  quantity = 1,
  metadata = {},
}: QuotaUsageEvent) {
  await callBackendDatabaseOperation("record-quota-usage-event", {
    eventType,
    eventSource,
    provider: provider ?? null,
    quantity,
    metadata,
    // Before production cutover, verify this operation against the backend
    // runbook evidence in nutsnews-backend#119.
    cutoverRunbook: "runbooks/DB_MIGRATION_PRODUCTION_CUTOVER.md",
  });
}

export async function recordQuotaUsageEvent({
  eventType,
  eventSource,
  provider,
  quantity = 1,
  metadata = {},
}: {
  eventType: string;
  eventSource: string;
  provider?: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}) {
  try {
    assertIsolatedDataMutation("quota-usage-event");
    const providerMode = getDatabaseProviderMode() as DatabaseProviderMode;

    if (providerMode === "backend_postgres_primary") {
      await recordBackendQuotaUsageEvent({
        eventType,
        eventSource,
        provider,
        quantity,
        metadata,
      });

      return true;
    }

    const supabase = getServerSupabase();

    const { error } = await supabase.from("quota_usage_events").insert({
      event_type: eventType,
      event_source: eventSource,
      provider: provider ?? null,
      quantity,
      metadata,
    });

    if (error) {
      console.warn("Unable to record quota usage event", error.message);
      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof RuntimeSafetyError) {
      return false;
    }
    console.warn("Quota usage event recording failed", error);
    return false;
  }
}
