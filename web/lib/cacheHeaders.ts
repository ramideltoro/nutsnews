const DEFAULT_PUBLIC_CDN_S_MAXAGE_SECONDS = 3600;
const DEFAULT_PUBLIC_CDN_STALE_WHILE_REVALIDATE_SECONDS = 86400;

function positiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name];
  const parsed = value ? Number.parseInt(value, 10) : NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const PUBLIC_CDN_S_MAXAGE_SECONDS = positiveIntegerEnv(
  "NUTSNEWS_PUBLIC_CDN_S_MAXAGE_SECONDS",
  DEFAULT_PUBLIC_CDN_S_MAXAGE_SECONDS,
);

export const PUBLIC_CDN_STALE_WHILE_REVALIDATE_SECONDS = positiveIntegerEnv(
  "NUTSNEWS_PUBLIC_CDN_STALE_WHILE_REVALIDATE_SECONDS",
  DEFAULT_PUBLIC_CDN_STALE_WHILE_REVALIDATE_SECONDS,
);

export const PUBLIC_PAGE_CACHE_CONTROL =
  "public, max-age=0, must-revalidate";

export const PUBLIC_CDN_CACHE_CONTROL =
  `public, s-maxage=${PUBLIC_CDN_S_MAXAGE_SECONDS}, stale-while-revalidate=${PUBLIC_CDN_STALE_WHILE_REVALIDATE_SECONDS}`;

export const PUBLIC_LONG_CACHE_CONTROL =
  PUBLIC_PAGE_CACHE_CONTROL;

export const NO_STORE_CACHE_CONTROL = "no-store, max-age=0";

export const ARTICLE_API_CACHE_HEADERS = {
  "Cache-Control": PUBLIC_PAGE_CACHE_CONTROL,
  "CDN-Cache-Control": PUBLIC_CDN_CACHE_CONTROL,
  "Cloudflare-CDN-Cache-Control": PUBLIC_CDN_CACHE_CONTROL,
  "Vercel-CDN-Cache-Control": PUBLIC_CDN_CACHE_CONTROL,
  "X-NutsNews-Cache-Policy": `public-api-cache-${PUBLIC_CDN_S_MAXAGE_SECONDS}s`,
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
