import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { BYPASS_CACHE_HEADERS } from "@/lib/cacheHeaders";
import {
  CACHE_REVALIDATION_HEADERS,
  CACHE_REVALIDATION_MAX_AGE_SECONDS,
  CACHE_REVALIDATION_MAX_TAGS,
  verifyCacheRevalidationSignature,
} from "@/lib/cacheRevalidationAuth";
import { isAllowlistedCacheTag } from "@/lib/cacheTags";
import { logInfo, logWarn } from "@/lib/logger";

type CacheRevalidationBody = {
  tags?: unknown;
};

const seenRequestIds = new Map<string, number>();

function noStoreJson(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: BYPASS_CACHE_HEADERS,
  });
}

function pruneReplayWindow(nowSeconds: number) {
  for (const [requestId, expiresAt] of seenRequestIds) {
    if (expiresAt <= nowSeconds) {
      seenRequestIds.delete(requestId);
    }
  }

  while (seenRequestIds.size > 1_000) {
    const oldest = seenRequestIds.keys().next().value;
    if (typeof oldest !== "string") break;
    seenRequestIds.delete(oldest);
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const secret = process.env.NUTSNEWS_CACHE_REVALIDATION_SECRET;

  if (!secret || secret.length < 32) {
    await logWarn(
      "cache.revalidation.unconfigured",
      "Cache revalidation rejected because its signing secret is unavailable.",
    );
    return noStoreJson({ error: "Cache revalidation is unavailable" }, 503);
  }

  let body: CacheRevalidationBody;

  try {
    body = (await request.json()) as CacheRevalidationBody;
  } catch {
    return noStoreJson({ error: "Invalid JSON body" }, 400);
  }

  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.filter((tag): tag is string => typeof tag === "string"))]
    : [];
  const timestamp = request.headers.get(CACHE_REVALIDATION_HEADERS.timestamp) ?? "";
  const requestId = request.headers.get(CACHE_REVALIDATION_HEADERS.requestId)?.trim() ?? "";
  const signature = request.headers.get(CACHE_REVALIDATION_HEADERS.signature) ?? "";
  const parsedTimestamp = Number(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1_000);

  if (
    tags.length === 0 ||
    tags.length > CACHE_REVALIDATION_MAX_TAGS ||
    tags.some((tag) => !isAllowlistedCacheTag(tag))
  ) {
    return noStoreJson({ error: "One or more cache tags are not allowed" }, 400);
  }

  if (
    !requestId ||
    requestId.length > 128 ||
    !Number.isInteger(parsedTimestamp) ||
    Math.abs(nowSeconds - parsedTimestamp) > CACHE_REVALIDATION_MAX_AGE_SECONDS
  ) {
    return noStoreJson({ error: "Stale or invalid signed request" }, 401);
  }

  pruneReplayWindow(nowSeconds);

  if (seenRequestIds.has(requestId)) {
    return noStoreJson({ error: "Signed request has already been used" }, 409);
  }

  if (
    !verifyCacheRevalidationSignature(
      secret,
      timestamp,
      requestId,
      tags,
      signature,
    )
  ) {
    return noStoreJson({ error: "Invalid signature" }, 401);
  }

  seenRequestIds.set(requestId, nowSeconds + CACHE_REVALIDATION_MAX_AGE_SECONDS);

  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }

  await logInfo(
    "cache.revalidation.completed",
    "Signed cache revalidation completed.",
    {
      requestId,
      tags,
      tagCount: tags.length,
      durationMs: Date.now() - startedAt,
    },
  );

  return noStoreJson({ revalidated: true, requestId, tags }, 200);
}
