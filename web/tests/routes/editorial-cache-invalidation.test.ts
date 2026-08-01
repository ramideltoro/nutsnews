import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
}));

vi.mock("@/lib/logger", () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}));

beforeEach(() => {
  delete process.env.CLOUDFLARE_CACHE_PURGE_API_TOKEN;
  delete process.env.CLOUDFLARE_ZONE_ID;
  mocks.logInfo.mockReset();
  mocks.logWarn.mockReset();
  mocks.revalidateTag.mockReset();
  vi.unstubAllGlobals();
});

describe("editorial cache invalidation", () => {
  it("invalidates only the edited article and the public feed", async () => {
    process.env.CLOUDFLARE_CACHE_PURGE_API_TOKEN = "zone-cache-purge-token";
    process.env.CLOUDFLARE_ZONE_ID = "0123456789abcdef0123456789abcdef";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { invalidateArticleAndFeedCaches } = await import("@/lib/editorialCacheInvalidation");
    const result = await invalidateArticleAndFeedCaches("article-123");

    expect(result).toEqual({
      tags: ["article:article-123", "public-feed"],
      cloudflarePurged: true,
    });
    expect(mocks.revalidateTag).toHaveBeenNthCalledWith(1, "article:article-123", { expire: 0 });
    expect(mocks.revalidateTag).toHaveBeenNthCalledWith(2, "public-feed", { expire: 0 });
    expect(mocks.revalidateTag).not.toHaveBeenCalledWith("article:unrelated", expect.anything());
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(options.body))).toEqual({
      tags: ["article:article-123", "public-feed"],
    });
  });

  it("keeps a committed edit successful when Cloudflare invalidation fails", async () => {
    process.env.CLOUDFLARE_CACHE_PURGE_API_TOKEN = "zone-cache-purge-token";
    process.env.CLOUDFLARE_ZONE_ID = "0123456789abcdef0123456789abcdef";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    const { invalidateArticleAndFeedCaches } = await import("@/lib/editorialCacheInvalidation");
    const result = await invalidateArticleAndFeedCaches("article-456");

    expect(result.cloudflarePurged).toBe(false);
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(2);
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "cache.cloudflare_purge.failed",
      expect.any(String),
      expect.objectContaining({ status: 503 }),
    );
  });

  it("keeps a committed edit successful when the purge request cannot be delivered", async () => {
    process.env.CLOUDFLARE_CACHE_PURGE_API_TOKEN = "zone-cache-purge-token";
    process.env.CLOUDFLARE_ZONE_ID = "0123456789abcdef0123456789abcdef";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    const { invalidateArticleAndFeedCaches } = await import("@/lib/editorialCacheInvalidation");
    const result = await invalidateArticleAndFeedCaches("article-789");

    expect(result.cloudflarePurged).toBe(false);
    expect(mocks.revalidateTag).toHaveBeenCalledTimes(2);
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "cache.cloudflare_purge.failed",
      expect.any(String),
      expect.objectContaining({ error: "network unavailable" }),
    );
  });
});
