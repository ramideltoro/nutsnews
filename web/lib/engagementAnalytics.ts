"use client";

import type { Article } from "@/lib/articles";
import {
  browserRequestsAnalyticsOptOut,
  getAnalyticsConsentState,
} from "@/lib/analyticsConsent";

type ArticleEngagementEventType = "outbound_click" | "category_interest";

type ArticleEngagementPayload = {
  eventType: ArticleEngagementEventType;
  articleId?: string;
  source: string;
  category: string;
};

const MAX_SOURCE_LENGTH = 160;
const MAX_CATEGORY_LENGTH = 96;

function normalizeText(value: string | null | undefined, fallback: string, maxLength: number) {
  const normalized = value
    ?.replace(/[^\S\r\n]+/g, " ")
    .replace(/[\r\n\t]/g, " ")
    .trim();

  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function canRecordEngagement() {
  return (
    typeof window !== "undefined" &&
    !browserRequestsAnalyticsOptOut() &&
    getAnalyticsConsentState() === "granted"
  );
}

function sendArticleEngagementEvent(payload: ArticleEngagementPayload) {
  if (!canRecordEngagement()) {
    return false;
  }

  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });

    if (navigator.sendBeacon("/api/engagement", blob)) {
      return true;
    }
  }

  void fetch("/api/engagement", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);

  return true;
}

export function recordArticleOutboundClick(
  article: Pick<Article, "id" | "source" | "category">,
) {
  const source = normalizeText(article.source, "unknown", MAX_SOURCE_LENGTH);
  const category = normalizeText(
    article.category,
    "uncategorized",
    MAX_CATEGORY_LENGTH,
  );

  sendArticleEngagementEvent({
    eventType: "outbound_click",
    articleId: article.id,
    source,
    category,
  });

  sendArticleEngagementEvent({
    eventType: "category_interest",
    source,
    category,
  });
}
