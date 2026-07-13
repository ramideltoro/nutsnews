import { getServerSupabase } from "@/lib/supabase";
import { RuntimeSafetyError, assertIsolatedDataMutation } from "@/lib/runtimeSafety";

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
