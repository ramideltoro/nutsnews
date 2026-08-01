import { describe, expect, it } from "vitest";

import {
  getNoStoreCacheHeaders,
  getPublicCacheHeaders,
  PUBLIC_CACHE_POLICIES,
} from "@/lib/cacheHeaders";
import { articleCacheTag, isAllowlistedCacheTag } from "@/lib/cacheTags";

describe("canonical public cache policy registry", () => {
  it("keeps publication freshness at two hours with seven-day stale-on-error", () => {
    expect(PUBLIC_CACHE_POLICIES["public-feed"]).toMatchObject({
      edgeMaxAgeSeconds: 7_200,
      staleWhileRevalidateSeconds: 300,
      staleIfErrorSeconds: 604_800,
    });

    const headers = getPublicCacheHeaders("public-feed", {
      cacheTags: ["public-feed", "public-feed"],
    });
    expect(headers["Cache-Control"]).toBe("public, max-age=0, must-revalidate");
    expect(headers["CDN-Cache-Control"]).toContain("s-maxage=7200");
    expect(headers["CDN-Cache-Control"]).toContain("stale-while-revalidate=300");
    expect(headers["CDN-Cache-Control"]).toContain("stale-if-error=604800");
    expect(headers["X-NutsNews-Cache-Policy"]).toBe("public-feed-cache-7200s");
    expect(headers["Cache-Tag"]).toBe("public-feed");
  });

  it("keeps long-lived content and normalized search policies distinct", () => {
    expect(PUBLIC_CACHE_POLICIES["public-article"].edgeMaxAgeSeconds).toBe(2_592_000);
    expect(PUBLIC_CACHE_POLICIES["public-static-page"].edgeMaxAgeSeconds).toBe(2_592_000);
    expect(PUBLIC_CACHE_POLICIES["public-search"].edgeMaxAgeSeconds).toBe(21_600);
  });

  it("always emits no-store across shared cache control headers", () => {
    const headers = getNoStoreCacheHeaders("bypass-test-cache");
    expect(headers["Cache-Control"]).toBe("no-store, max-age=0");
    expect(headers["Cloudflare-CDN-Cache-Control"]).toBe("no-store");
    expect(headers["Vercel-CDN-Cache-Control"]).toBe("no-store");
    expect(headers["X-NutsNews-Cache-Policy"]).toBe("bypass-test-cache");
  });

  it("allows only the coordinated tag vocabulary", () => {
    expect(articleCacheTag("article_123-en")).toBe("article:article_123-en");
    expect(isAllowlistedCacheTag("public-feed")).toBe(true);
    expect(isAllowlistedCacheTag("site-shell")).toBe(true);
    expect(isAllowlistedCacheTag("article:article_123-en")).toBe(true);
    expect(isAllowlistedCacheTag("article:../admin")).toBe(false);
    expect(() => articleCacheTag("article:unexpected")).toThrow();
  });
});
