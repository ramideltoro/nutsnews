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

export type ArticleEngagementEventType = "outbound_click" | "category_interest";

export type ArticleEngagementRecordResult = {
  recorded: boolean;
  reason: "recorded" | "runtime_disabled" | "database_error";
};

async function recordBackendArticleEngagementEvent({
  eventType,
  articleId,
  source,
  category,
}: {
  eventType: ArticleEngagementEventType;
  articleId: string | null;
  source: string;
  category: string;
}) {
  await callBackendDatabaseOperation("record-article-engagement-event", {
    eventType,
    articleId: eventType === "category_interest" ? null : articleId,
    source,
    category,
    quantity: 1,
    // Before production cutover, verify this operation against the backend
    // runbook evidence in nutsnews-backend#119.
    cutoverRunbook: "runbooks/DB_MIGRATION_PRODUCTION_CUTOVER.md",
  });
}

export async function recordArticleEngagementEvent({
  eventType,
  articleId,
  source,
  category,
}: {
  eventType: ArticleEngagementEventType;
  articleId: string | null;
  source: string;
  category: string;
}): Promise<ArticleEngagementRecordResult> {
  try {
    assertIsolatedDataMutation("article-engagement-event");
    const providerMode = getDatabaseProviderMode() as DatabaseProviderMode;

    if (providerMode === "backend_postgres_primary") {
      await recordBackendArticleEngagementEvent({
        eventType,
        articleId,
        source,
        category,
      });

      return {
        recorded: true,
        reason: "recorded",
      };
    }

    const supabase = getServerSupabase();

    const { error } = await supabase.rpc("record_article_engagement_event", {
      p_event_type: eventType,
      p_article_id: eventType === "category_interest" ? null : articleId,
      p_source: source,
      p_category: category,
      p_quantity: 1,
    });

    if (error) {
      console.warn("Unable to record article engagement event", error.message);

      return {
        recorded: false,
        reason: "database_error",
      };
    }

    return {
      recorded: true,
      reason: "recorded",
    };
  } catch (error) {
    if (error instanceof RuntimeSafetyError) {
      return {
        recorded: false,
        reason: "runtime_disabled",
      };
    }

    console.warn("Article engagement event recording failed", error);

    return {
      recorded: false,
      reason: "database_error",
    };
  }
}
