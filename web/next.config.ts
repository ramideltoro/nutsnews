import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const PUBLIC_PAGE_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";

const PUBLIC_CDN_CACHE_CONTROL =
  "public, max-age=300, stale-while-revalidate=3600";

const PUBLIC_LONG_CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

const STATIC_ASSET_CACHE_CONTROL =
  "public, max-age=86400, stale-while-revalidate=604800";

const NO_STORE_CACHE_CONTROL = "no-store, max-age=0";

function publicCacheHeaders(policy: string, cacheControl = PUBLIC_PAGE_CACHE_CONTROL) {
  return [
    {
      key: "Cache-Control",
      value: cacheControl,
    },
    {
      key: "CDN-Cache-Control",
      value: PUBLIC_CDN_CACHE_CONTROL,
    },
    {
      key: "Cloudflare-CDN-Cache-Control",
      value: PUBLIC_CDN_CACHE_CONTROL,
    },
    {
      key: "Vercel-CDN-Cache-Control",
      value: PUBLIC_CDN_CACHE_CONTROL,
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
  turbopack: {
    root: path.join(__dirname),
  },

  async headers() {
    return [
      {
        source: "/",
        headers: publicCacheHeaders("public-home-cache-300s"),
      },
      {
        source: "/about",
        headers: publicCacheHeaders("public-about-cache-300s"),
      },
      {
        source: "/articles/:path*",
        headers: publicCacheHeaders("public-article-cache-300s"),
      },
      {
        source: "/api/articles",
        headers: publicCacheHeaders("public-api-cache-300s"),
      },
      {
        source: "/opengraph-image",
        headers: publicCacheHeaders("public-og-image-cache-3600s", PUBLIC_LONG_CACHE_CONTROL),
      },
      {
        source: "/articles/:id/opengraph-image",
        headers: publicCacheHeaders("public-article-og-image-cache-3600s", PUBLIC_LONG_CACHE_CONTROL),
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
            key: "X-NutsNews-Cache-Policy",
            value: "public-static-asset-cache",
          },
        ],
      },
      {
        source: "/robots.txt",
        headers: publicCacheHeaders("public-robots-cache-3600s", PUBLIC_LONG_CACHE_CONTROL),
      },
      {
        source: "/sitemap.xml",
        headers: publicCacheHeaders("public-sitemap-cache-3600s", PUBLIC_LONG_CACHE_CONTROL),
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
        source: "/api/health",
        headers: noStoreHeaders("bypass-health-cache"),
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
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
});
