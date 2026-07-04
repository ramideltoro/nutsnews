export const PUBLIC_PAGE_CACHE_CONTROL =
  "public, max-age=60, s-maxage=900, stale-while-revalidate=3600";

export const PUBLIC_CDN_CACHE_CONTROL =
  "public, s-maxage=900, stale-while-revalidate=3600";

export const PUBLIC_CLOUDFLARE_CDN_CACHE_CONTROL =
  "public, max-age=3600, stale-while-revalidate=86400";

export const PUBLIC_LONG_CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export const NO_STORE_CACHE_CONTROL = "no-store, max-age=0";

export const ARTICLE_API_CACHE_HEADERS = {
  "Cache-Control": PUBLIC_PAGE_CACHE_CONTROL,
  "CDN-Cache-Control": PUBLIC_CDN_CACHE_CONTROL,
  "Cloudflare-CDN-Cache-Control": PUBLIC_CLOUDFLARE_CDN_CACHE_CONTROL,
  "Vercel-CDN-Cache-Control": PUBLIC_CDN_CACHE_CONTROL,
  "X-NutsNews-Cache-Policy": "public-api-cache-900s",
  "X-NutsNews-Cache-Issue": "7",
} as const;

export const BYPASS_CACHE_HEADERS = {
  "Cache-Control": NO_STORE_CACHE_CONTROL,
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-NutsNews-Cache-Policy": "bypass-cache",
  "X-NutsNews-Cache-Issue": "7",
} as const;
