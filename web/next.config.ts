import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
import {
  getNoStoreCacheHeaders,
  getPublicCacheHeaders,
  toNextHeaderEntries,
  type PublicCachePolicyName,
} from "./lib/cacheHeaders";
import { PUBLIC_FEED_CACHE_TAG, SITE_SHELL_CACHE_TAG } from "./lib/cacheTags";
import { getSecurityHeaders } from "./lib/securityHeaders";

const GLOBAL_SECURITY_HEADERS = Object.entries(
  getSecurityHeaders({ isDevelopment: process.env.NODE_ENV !== "production" }),
).map(([key, value]) => ({ key, value }));

const shouldUploadSentrySourceMaps =
  (process.env.VERCEL === "1" || process.env.SENTRY_ENABLE_SOURCE_MAP_UPLOAD === "1") &&
  Boolean(process.env.SENTRY_AUTH_TOKEN) &&
  Boolean(process.env.SENTRY_ORG) &&
  Boolean(process.env.SENTRY_PROJECT);

function publicCacheHeaders(
  policy: PublicCachePolicyName,
  cacheTags: readonly string[] = [],
) {
  return toNextHeaderEntries(getPublicCacheHeaders(policy, { cacheTags }));
}

function noStoreHeaders(policy: string) {
  return toNextHeaderEntries(getNoStoreCacheHeaders(policy));
}

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  poweredByHeader: false,
  turbopack: {
    root: path.join(__dirname),
  },

  images: {
    // NutsNews stores publisher image URLs from many trusted RSS/article pages,
    // so the optimizer needs to accept the image hosts discovered by ingestion.
    // The ingestion pipeline still controls which image_url values reach the
    // public feed, and SVG images are rendered unoptimized by the component.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    qualities: [72, 75],
    deviceSizes: [360, 414, 640, 750, 828, 1080],
    imageSizes: [96, 128, 256, 384, 512],
    minimumCacheTTL: 86_400,
    maximumRedirects: 2,
    maximumResponseBody: 8_000_000,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: GLOBAL_SECURITY_HEADERS,
      },
      {
        source: "/",
        headers: publicCacheHeaders("public-feed", [PUBLIC_FEED_CACHE_TAG, SITE_SHELL_CACHE_TAG]),
      },
      {
        source: "/about",
        headers: publicCacheHeaders("public-static-page", [SITE_SHELL_CACHE_TAG]),
      },
      {
        source: "/contact",
        headers: publicCacheHeaders("public-static-page", [SITE_SHELL_CACHE_TAG]),
      },
      {
        source: "/apps",
        headers: publicCacheHeaders("public-static-page", [SITE_SHELL_CACHE_TAG]),
      },
      {
        source: "/saved",
        headers: publicCacheHeaders("public-static-page", [SITE_SHELL_CACHE_TAG]),
      },
      {
        source: "/privacy/:path*",
        headers: publicCacheHeaders("public-static-page", [SITE_SHELL_CACHE_TAG]),
      },
      {
        source: "/articles/:path*",
        headers: publicCacheHeaders("public-article"),
      },
      {
        source: "/api/articles",
        headers: publicCacheHeaders("public-feed", [PUBLIC_FEED_CACHE_TAG]),
      },
      {
        source: "/api/home-feed",
        headers: publicCacheHeaders("public-feed", [PUBLIC_FEED_CACHE_TAG]),
      },
      {
        source: "/api/search",
        headers: publicCacheHeaders("public-search", [PUBLIC_FEED_CACHE_TAG]),
      },
      {
        source: "/_next/image",
        headers: publicCacheHeaders("public-article"),
      },
      {
        source: "/healthz",
        headers: publicCacheHeaders("public-health"),
      },
      {
        source: "/readyz",
        headers: noStoreHeaders("bypass-readiness-cache"),
      },
      {
        source: "/api/contact",
        headers: noStoreHeaders("bypass-contact-api-cache"),
      },
      {
        source: "/api/engagement",
        headers: noStoreHeaders("bypass-engagement-api-cache"),
      },
      {
        source: "/opengraph-image",
        headers: publicCacheHeaders("public-static-page", [SITE_SHELL_CACHE_TAG]),
      },
      {
        source: "/articles/:id/opengraph-image",
        headers: publicCacheHeaders("public-article"),
      },
      {
        source: "/icon.png",
        headers: publicCacheHeaders("public-static-asset"),
      },
      {
        source: "/apple-icon.png",
        headers: publicCacheHeaders("public-static-asset"),
      },
      {
        source: "/favicon.ico",
        headers: publicCacheHeaders("public-static-asset"),
      },
      {
        source: "/robots.txt",
        headers: publicCacheHeaders("public-sitemap", [PUBLIC_FEED_CACHE_TAG]),
      },
      {
        source: "/sitemap.xml",
        headers: publicCacheHeaders("public-sitemap", [PUBLIC_FEED_CACHE_TAG]),
      },
      {
        source: "/sitemap-index.xml",
        headers: publicCacheHeaders("public-sitemap", [PUBLIC_FEED_CACHE_TAG]),
      },
      {
        source: "/articles/sitemap/:path*",
        headers: publicCacheHeaders("public-sitemap", [PUBLIC_FEED_CACHE_TAG]),
      },
      {
        source: "/admin/:path*",
        headers: noStoreHeaders("bypass-admin-cache"),
      },
      {
        source: "/api/auth/:path*",
        headers: noStoreHeaders("bypass-auth-cache"),
      },
      {
        source: "/api/log-test",
        headers: noStoreHeaders("bypass-log-test-cache"),
      },
      {
        source: "/api/log-test/:path*",
        headers: noStoreHeaders("bypass-log-test-cache"),
      },
      {
        source: "/api/internal/:path*",
        headers: noStoreHeaders("bypass-internal-api-cache"),
      },
      {
        source: "/api/runtime-config",
        headers: noStoreHeaders("bypass-runtime-config-cache"),
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: shouldUploadSentrySourceMaps ? process.env.SENTRY_ORG : undefined,
  project: shouldUploadSentrySourceMaps ? process.env.SENTRY_PROJECT : undefined,
  authToken: shouldUploadSentrySourceMaps ? process.env.SENTRY_AUTH_TOKEN : undefined,
  widenClientFileUpload: true,
  telemetry: false,
  sourcemaps: {
    disable: !shouldUploadSentrySourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
});
