import { getServerSupabase } from "@/lib/supabase";
import { RuntimeSafetyError, assertIsolatedDataMutation } from "@/lib/runtimeSafety";

export type ArticleEngagementEventType = "outbound_click" | "category_interest";

export type ArticleEngagementRecordResult = {
  recorded: boolean;
  reason: "recorded" | "runtime_disabled" | "database_error";
};

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
