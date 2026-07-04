import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";
import {
  PUBLIC_CDN_CACHE_CONTROL,
  PUBLIC_CDN_S_MAXAGE_SECONDS,
  PUBLIC_PAGE_CACHE_CONTROL,
} from "./lib/cacheHeaders";
import { getSecurityHeaders } from "./lib/securityHeaders";

const PUBLIC_LONG_CDN_CACHE_CONTROL = PUBLIC_CDN_CACHE_CONTROL;

const PUBLIC_LONG_CACHE_CONTROL = PUBLIC_PAGE_CACHE_CONTROL;

const STATIC_ASSET_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

const NO_STORE_CACHE_CONTROL = "no-store, max-age=0";

const GLOBAL_SECURITY_HEADERS = Object.entries(
  getSecurityHeaders({ isDevelopment: process.env.NODE_ENV !== "production" }),
).map(([key, value]) => ({ key, value }));

const shouldUploadSentrySourceMaps =
  (process.env.VERCEL === "1" || process.env.SENTRY_ENABLE_SOURCE_MAP_UPLOAD === "1") &&
  Boolean(process.env.SENTRY_AUTH_TOKEN) &&
  Boolean(process.env.SENTRY_ORG) &&
  Boolean(process.env.SENTRY_PROJECT);

function publicCacheHeaders(
  policy: string,
  cacheControl = PUBLIC_PAGE_CACHE_CONTROL,
  cdnCacheControl = PUBLIC_CDN_CACHE_CONTROL,
) {
  return [
    {
      key: "Cache-Control",
      value: cacheControl,
    },
    {
      key: "CDN-Cache-Control",
      value: cdnCacheControl,
    },
    {
      key: "Cloudflare-CDN-Cache-Control",
      value: cdnCacheControl,
    },
    {
      key: "Vercel-CDN-Cache-Control",
      value: cdnCacheControl,
    },
    {
      key: "X-NutsNews-Cache-Policy",
      value: policy,
    },
    {
      key: "X-NutsNews-Cache-Issue",
      value: "7",
    },
  ];
}

function noStoreHeaders(policy: string) {
  return [
    {
      key: "Cache-Control",
      value: NO_STORE_CACHE_CONTROL,
    },
    {
      key: "CDN-Cache-Control",
      value: "no-store",
    },
    {
      key: "Cloudflare-CDN-Cache-Control",
      value: "no-store",
    },
    {
      key: "Vercel-CDN-Cache-Control",
      value: "no-store",
    },
    {
      key: "X-NutsNews-Cache-Policy",
      value: policy,
    },
    {
      key: "X-NutsNews-Cache-Issue",
      value: "7",
    },
  ];
}

const nextConfig: NextConfig = {
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
        headers: publicCacheHeaders(`public-home-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s`),
      },
      {
        source: "/about",
        headers: publicCacheHeaders(`public-about-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s`),
      },
      {
        source: "/contact",
        headers: publicCacheHeaders(`public-contact-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s`),
      },
      {
        source: "/privacy",
        headers: publicCacheHeaders(`public-privacy-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s`),
      },
      {
        source: "/articles/:path*",
        headers: publicCacheHeaders(`public-article-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s`),
      },
      {
        source: "/api/articles",
        headers: publicCacheHeaders(`public-api-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s`),
      },
      {
        source: "/api/home-feed",
        headers: publicCacheHeaders(`public-home-feed-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s`),
      },
      {
        source: "/api/contact",
        headers: noStoreHeaders("bypass-contact-api-cache"),
      },
      {
        source: "/opengraph-image",
        headers: publicCacheHeaders("public-og-image-cache-3600s", PUBLIC_LONG_CACHE_CONTROL, PUBLIC_LONG_CDN_CACHE_CONTROL),
      },
      {
        source: "/articles/:id/opengraph-image",
        headers: publicCacheHeaders("public-article-og-image-cache-3600s", PUBLIC_LONG_CACHE_CONTROL, PUBLIC_LONG_CDN_CACHE_CONTROL),
      },
      {
        source: "/icon.png",
        headers: [
          {
            key: "Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "CDN-Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "Vercel-CDN-Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "X-NutsNews-Cache-Policy",
            value: "public-static-asset-cache-immutable",
          },
        ],
      },
      {
        source: "/apple-icon.png",
        headers: [
          {
            key: "Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "CDN-Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "Vercel-CDN-Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "X-NutsNews-Cache-Policy",
            value: "public-static-asset-cache-immutable",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "CDN-Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "Cloudflare-CDN-Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "Vercel-CDN-Cache-Control",
            value: STATIC_ASSET_CACHE_CONTROL,
          },
          {
            key: "X-NutsNews-Cache-Policy",
            value: "public-static-asset-cache",
          },
        ],
      },
      {
        source: "/robots.txt",
        headers: publicCacheHeaders("public-robots-cache-3600s", PUBLIC_LONG_CACHE_CONTROL, PUBLIC_LONG_CDN_CACHE_CONTROL),
      },
      {
        source: "/sitemap.xml",
        headers: publicCacheHeaders("public-sitemap-cache-3600s", PUBLIC_LONG_CACHE_CONTROL, PUBLIC_LONG_CDN_CACHE_CONTROL),
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
        source: "/monitoring",
        headers: noStoreHeaders("bypass-monitoring-cache"),
      },
      {
        source: "/monitoring/:path*",
        headers: noStoreHeaders("bypass-monitoring-cache"),
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: shouldUploadSentrySourceMaps ? process.env.SENTRY_ORG : undefined,
  project: shouldUploadSentrySourceMaps ? process.env.SENTRY_PROJECT : undefined,
  authToken: shouldUploadSentrySourceMaps ? process.env.SENTRY_AUTH_TOKEN : undefined,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  telemetry: false,
  sourcemaps: {
    disable: !shouldUploadSentrySourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
});
