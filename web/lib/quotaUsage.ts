import { createClient } from "@supabase/supabase-js";

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
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

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
    console.warn("Quota usage event recording failed", error);
    return false;
  }
}
