const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type PublicCachePolicyName =
  | "public-feed"
  | "public-article"
  | "public-static-page"
  | "public-search"
  | "public-sitemap"
  | "public-health"
  | "public-static-asset";

export type PublicCachePolicy = {
  browserMaxAgeSeconds: number;
  edgeMaxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  staleIfErrorSeconds: number;
  immutable?: boolean;
};

function positiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name];
  const parsed = value ? Number.parseInt(value, 10) : NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const PUBLIC_FEED_EDGE_TTL_SECONDS = positiveIntegerEnv(
  "NUTSNEWS_PUBLIC_FEED_EDGE_TTL_SECONDS",
  2 * HOUR,
);

const PUBLIC_CONTENT_EDGE_TTL_SECONDS = positiveIntegerEnv(
  "NUTSNEWS_PUBLIC_CONTENT_EDGE_TTL_SECONDS",
  30 * DAY,
);

const PUBLIC_SEARCH_EDGE_TTL_SECONDS = positiveIntegerEnv(
  "NUTSNEWS_PUBLIC_SEARCH_EDGE_TTL_SECONDS",
  6 * HOUR,
);

/**
 * Canonical cache registry. Route configuration, response helpers, edge IaC,
 * and regression tests must agree with these values.
 */
export const PUBLIC_CACHE_POLICIES = {
  "public-feed": {
    browserMaxAgeSeconds: 0,
    edgeMaxAgeSeconds: PUBLIC_FEED_EDGE_TTL_SECONDS,
    staleWhileRevalidateSeconds: 5 * MINUTE,
    staleIfErrorSeconds: 7 * DAY,
  },
  "public-article": {
    browserMaxAgeSeconds: 0,
    edgeMaxAgeSeconds: PUBLIC_CONTENT_EDGE_TTL_SECONDS,
    staleWhileRevalidateSeconds: 5 * MINUTE,
    staleIfErrorSeconds: 7 * DAY,
  },
  "public-static-page": {
    browserMaxAgeSeconds: 0,
    edgeMaxAgeSeconds: PUBLIC_CONTENT_EDGE_TTL_SECONDS,
    staleWhileRevalidateSeconds: 5 * MINUTE,
    staleIfErrorSeconds: 7 * DAY,
  },
  "public-search": {
    browserMaxAgeSeconds: 0,
    edgeMaxAgeSeconds: PUBLIC_SEARCH_EDGE_TTL_SECONDS,
    staleWhileRevalidateSeconds: 5 * MINUTE,
    staleIfErrorSeconds: DAY,
  },
  "public-sitemap": {
    browserMaxAgeSeconds: 0,
    edgeMaxAgeSeconds: PUBLIC_FEED_EDGE_TTL_SECONDS,
    staleWhileRevalidateSeconds: 5 * MINUTE,
    staleIfErrorSeconds: 7 * DAY,
  },
  "public-health": {
    browserMaxAgeSeconds: 0,
    edgeMaxAgeSeconds: MINUTE,
    staleWhileRevalidateSeconds: 5 * MINUTE,
    staleIfErrorSeconds: 5 * MINUTE,
  },
  "public-static-asset": {
    browserMaxAgeSeconds: 365 * DAY,
    edgeMaxAgeSeconds: 365 * DAY,
    staleWhileRevalidateSeconds: 0,
    staleIfErrorSeconds: 30 * DAY,
    immutable: true,
  },
} as const satisfies Record<PublicCachePolicyName, PublicCachePolicy>;

export const NO_STORE_CACHE_CONTROL = "no-store, max-age=0";

function formatBrowserCacheControl(policy: PublicCachePolicy) {
  if (policy.immutable) {
    return `public, max-age=${policy.browserMaxAgeSeconds}, immutable`;
  }

  return policy.browserMaxAgeSeconds > 0
    ? `public, max-age=${policy.browserMaxAgeSeconds}`
    : "public, max-age=0, must-revalidate";
}

function formatSharedCacheControl(policy: PublicCachePolicy) {
  const directives = ["public", `s-maxage=${policy.edgeMaxAgeSeconds}`];

  if (policy.staleWhileRevalidateSeconds > 0) {
    directives.push(`stale-while-revalidate=${policy.staleWhileRevalidateSeconds}`);
  }

  if (policy.staleIfErrorSeconds > 0) {
    directives.push(`stale-if-error=${policy.staleIfErrorSeconds}`);
  }

  if (policy.immutable) {
    directives.push("immutable");
  }

  return directives.join(", ");
}

export function getPublicCacheHeaders(
  policyName: PublicCachePolicyName,
  options: { cacheTags?: readonly string[] } = {},
) {
  const policy = PUBLIC_CACHE_POLICIES[policyName];
  const sharedCacheControl = formatSharedCacheControl(policy);
  const headers: Record<string, string> = {
    "Cache-Control": formatBrowserCacheControl(policy),
    "CDN-Cache-Control": sharedCacheControl,
    "Cloudflare-CDN-Cache-Control": sharedCacheControl,
    "Vercel-CDN-Cache-Control": sharedCacheControl,
    "X-NutsNews-Cache-Policy": `${policyName}-cache-${policy.edgeMaxAgeSeconds}s`,
    "X-NutsNews-Cache-Issue": "221",
  };

  if (options.cacheTags?.length) {
    headers["Cache-Tag"] = [...new Set(options.cacheTags)].join(",");
  }

  return headers;
}

export function getNoStoreCacheHeaders(policy = "bypass-cache") {
  return {
    "Cache-Control": NO_STORE_CACHE_CONTROL,
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "X-NutsNews-Cache-Policy": policy,
    "X-NutsNews-Cache-Issue": "221",
  } as const;
}

export function toNextHeaderEntries(headers: Readonly<Record<string, string>>) {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

// Compatibility exports used by existing routes while policy callers migrate.
export const PUBLIC_CDN_S_MAXAGE_SECONDS =
  PUBLIC_CACHE_POLICIES["public-feed"].edgeMaxAgeSeconds;
export const PUBLIC_CDN_STALE_WHILE_REVALIDATE_SECONDS =
  PUBLIC_CACHE_POLICIES["public-feed"].staleWhileRevalidateSeconds;
export const PUBLIC_PAGE_CACHE_CONTROL = getPublicCacheHeaders("public-feed")["Cache-Control"];
export const PUBLIC_CDN_CACHE_CONTROL = getPublicCacheHeaders("public-feed")["CDN-Cache-Control"];
export const PUBLIC_LONG_CACHE_CONTROL = PUBLIC_PAGE_CACHE_CONTROL;
export const ARTICLE_API_BROWSER_CACHE_CONTROL = PUBLIC_PAGE_CACHE_CONTROL;
export const ARTICLE_API_CACHE_HEADERS = getPublicCacheHeaders("public-feed", {
  cacheTags: ["public-feed"],
});
export const BYPASS_CACHE_HEADERS = getNoStoreCacheHeaders();
