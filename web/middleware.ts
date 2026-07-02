import { NextResponse, type NextRequest } from "next/server";
import { getSecurityHeaders } from "@/lib/securityHeaders";

const PUBLIC_PAGE_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const PUBLIC_CDN_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=300";
const PUBLIC_LONG_CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
const PUBLIC_LONG_CDN_CACHE_CONTROL =
  "public, s-maxage=3600, stale-while-revalidate=86400";
const NO_STORE_CACHE_CONTROL = "no-store, max-age=0";

type HeaderMap = Record<string, string>;

function setHeaders(response: NextResponse, headers: HeaderMap) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
}

function getPublicCacheHeaders(
  policy: string,
  cacheControl = PUBLIC_PAGE_CACHE_CONTROL,
  cdnCacheControl = PUBLIC_CDN_CACHE_CONTROL,
): HeaderMap {
  return {
    "Cache-Control": cacheControl,
    "CDN-Cache-Control": cdnCacheControl,
    "Cloudflare-CDN-Cache-Control": cdnCacheControl,
    "Vercel-CDN-Cache-Control": cdnCacheControl,
    "X-NutsNews-Cache-Policy": policy,
    "X-NutsNews-Cache-Issue": "7",
  };
}

function getBypassCacheHeaders(policy: string): HeaderMap {
  return {
    "Cache-Control": NO_STORE_CACHE_CONTROL,
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "X-NutsNews-Cache-Policy": policy,
    "X-NutsNews-Cache-Issue": "7",
  };
}

function isAdminRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isOperationalNoStoreRoute(pathname: string) {
  return (
    pathname === "/monitoring" ||
    pathname.startsWith("/monitoring/") ||
    pathname === "/api/log-test" ||
    pathname.startsWith("/api/log-test/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/contact" ||
    isAdminRoute(pathname)
  );
}

function isLongCachePublicRoute(pathname: string) {
  return (
    pathname === "/opengraph-image" ||
    pathname.endsWith("/opengraph-image") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

function isPublicReaderRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/about" ||
    pathname === "/contact" ||
    pathname === "/privacy" ||
    pathname === "/api/articles" ||
    pathname === "/api/search" ||
    pathname.startsWith("/articles/") ||
    isLongCachePublicRoute(pathname)
  );
}

function getPolicyName(pathname: string) {
  if (pathname === "/") return "public-home-cache-300s";
  if (pathname === "/api/articles") return "public-api-cache-300s";
  if (pathname === "/api/search") return "public-search-cache-60s";
  if (pathname === "/robots.txt") return "public-robots-cache-3600s";
  if (pathname === "/sitemap.xml") return "public-sitemap-cache-3600s";
  if (pathname === "/opengraph-image") return "public-og-image-cache-3600s";
  if (pathname.endsWith("/opengraph-image")) {
    return "public-article-og-image-cache-3600s";
  }
  if (pathname.startsWith("/articles/")) return "public-article-cache-300s";
  if (isLongCachePublicRoute(pathname)) return "public-long-cache-3600s";
  return "public-page-cache-300s";
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  setHeaders(
    response,
    getSecurityHeaders({
      isDevelopment: process.env.NODE_ENV !== "production",
    }),
  );

  if (isOperationalNoStoreRoute(pathname)) {
    setHeaders(response, getBypassCacheHeaders("bypass-operational-cache"));

    if (isAdminRoute(pathname)) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    }

    return response;
  }

  if (isPublicReaderRoute(pathname)) {
    const cacheControl = isLongCachePublicRoute(pathname)
      ? PUBLIC_LONG_CACHE_CONTROL
      : PUBLIC_PAGE_CACHE_CONTROL;

    setHeaders(
      response,
      getPublicCacheHeaders(
        getPolicyName(pathname),
        cacheControl,
        isLongCachePublicRoute(pathname)
          ? PUBLIC_LONG_CDN_CACHE_CONTROL
          : PUBLIC_CDN_CACHE_CONTROL,
      ),
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
