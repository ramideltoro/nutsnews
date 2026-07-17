import { NextRequest, NextResponse } from "next/server";
import { BYPASS_CACHE_HEADERS } from "@/lib/cacheHeaders";
import {
  type ArticleEngagementEventType,
  recordArticleEngagementEvent,
} from "@/lib/articleEngagement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 2_048;
const MAX_SOURCE_LENGTH = 160;
const MAX_CATEGORY_LENGTH = 96;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EngagementPayload = {
  eventType?: unknown;
  articleId?: unknown;
  source?: unknown;
  category?: unknown;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 202,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...BYPASS_CACHE_HEADERS,
      ...headers,
    },
  });
}

function getBodySizeBytes(value: string) {
  return new TextEncoder().encode(value).length;
}

function normalizeText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.replace(/[^\S\r\n]+/g, " ").replace(/[\r\n\t]/g, " ").trim();

  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeEventType(value: unknown): ArticleEngagementEventType | null {
  if (value === "outbound_click" || value === "category_interest") {
    return value;
  }

  return null;
}

function isAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const requestUrl = new URL(request.url);
  const forwardedProto =
    request.headers.get("x-forwarded-proto") ||
    requestUrl.protocol.replace(":", "");
  const forwardedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const allowedOrigins = new Set([
    requestUrl.origin,
    "https://www.nutsnews.com",
    "https://nutsnews.com",
  ]);

  if (forwardedHost) {
    allowedOrigins.add(`${forwardedProto}://${forwardedHost}`);
  }

  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://127.0.0.1:3000");
  }

  return allowedOrigins.has(origin);
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return jsonResponse({ error: "This engagement request is not allowed." }, 403);
  }

  const contentType = request.headers.get("content-type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse({ error: "Please submit a valid engagement event." }, 415);
  }

  let bodyText = "";

  try {
    bodyText = await request.text();
  } catch {
    return jsonResponse({ error: "Please submit a valid engagement event." }, 400);
  }

  if (getBodySizeBytes(bodyText) > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: "The engagement event is too large." }, 413);
  }

  let payload: EngagementPayload;

  try {
    payload = JSON.parse(bodyText) as EngagementPayload;
  } catch {
    return jsonResponse({ error: "Please submit a valid engagement event." }, 400);
  }

  const eventType = normalizeEventType(payload.eventType);

  if (!eventType) {
    return jsonResponse({ error: "Unsupported engagement event type." }, 400);
  }

  const articleId =
    typeof payload.articleId === "string" ? payload.articleId.trim() : null;

  if (eventType === "outbound_click" && (!articleId || !UUID_PATTERN.test(articleId))) {
    return jsonResponse({ error: "A valid article ID is required." }, 400);
  }

  const source = normalizeText(payload.source, "unknown", MAX_SOURCE_LENGTH);
  const category = normalizeText(
    payload.category,
    "uncategorized",
    MAX_CATEGORY_LENGTH,
  );
  const result = await recordArticleEngagementEvent({
    eventType,
    articleId: articleId && UUID_PATTERN.test(articleId) ? articleId : null,
    source,
    category,
  });

  return jsonResponse({
    ok: true,
    recorded: result.recorded,
    reason: result.reason,
  });
}
