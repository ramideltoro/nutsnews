import "server-only";

import { revalidateTag } from "next/cache";

import { articleCacheTag, PUBLIC_FEED_CACHE_TAG } from "@/lib/cacheTags";
import { logInfo, logWarn } from "@/lib/logger";

export async function purgeCloudflareCacheTags(tags: readonly string[]) {
  const apiToken = process.env.CLOUDFLARE_CACHE_PURGE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;

  if (!apiToken || !zoneId) {
    await logWarn(
      "cache.cloudflare_purge.skipped",
      "Cloudflare tag purge was skipped because scoped credentials are unavailable.",
      { tags },
    );
    return false;
  }

  let response: Response;

  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tags }),
        cache: "no-store",
      },
    );
  } catch (error) {
    await logWarn(
      "cache.cloudflare_purge.failed",
      "Cloudflare editorial tag purge could not be delivered.",
      {
        tags,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return false;
  }

  if (!response.ok) {
    await logWarn(
      "cache.cloudflare_purge.failed",
      "Cloudflare rejected an editorial tag purge.",
      { tags, status: response.status },
    );
    return false;
  }

  return true;
}

/**
 * Call this after an article edit or removal has committed successfully.
 * Cache failure is observable but never rolls the editorial mutation back.
 */
export async function invalidateArticleAndFeedCaches(articleId: string) {
  const tags = [articleCacheTag(articleId), PUBLIC_FEED_CACHE_TAG] as const;

  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }

  const cloudflarePurged = await purgeCloudflareCacheTags(tags);

  await logInfo(
    "cache.editorial_invalidation.completed",
    "Editorial mutation cache invalidation completed.",
    { articleId, tags, cloudflarePurged },
  );

  return { tags, cloudflarePurged };
}
