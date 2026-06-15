import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PAGE_CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=3600";

const PUBLIC_CDN_CACHE_CONTROL =
  "public, max-age=300, stale-while-revalidate=3600";

const PUBLIC_LONG_CACHE_CONTROL =
  "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

const NO_STORE_CACHE_CONTROL = "no-store, max-age=0";

function setHeaders(response: NextResponse, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
}

function getPublicCacheHeaders(policy: string, cacheControl = PUBLIC_PAGE_CACHE_CONTROL) {
  return {
    "Cache-Control": cacheControl,
    "CDN-Cache-Control": PUBLIC_CDN_CACHE_CONTROL,
    "Cloudflare-CDN-Cache-Control": PUBLIC_CDN_CACHE_CONTROL,
    "Vercel-CDN-Cache-Control": PUBLIC_CDN_CACHE_CONTROL,
    "X-NutsNews-Cache-Policy": policy,
    "X-NutsNews-Cache-Issue": "7",
  };
}

function getBypassCacheHeaders(policy: string) {
  return {
    "Cache-Control": NO_STORE_CACHE_CONTROL,
    "CDN-Cache-Control": "no-store",
    "Cloudflare-CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "X-NutsNews-Cache-Policy": policy,
    "X-NutsNews-Cache-Issue": "7",
  };
}

function isBypassRoute(pathname: string) {
  return (
    pathname === "/monitoring" ||
    pathname.startsWith("/monitoring/") ||
    pathname === "/api/log-test" ||
    pathname.startsWith("/api/log-test/") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
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
    pathname === "/api/articles" ||
    pathname.startsWith("/articles/") ||
    isLongCachePublicRoute(pathname)
  );
}

function getPolicyName(pathname: string) {
  if (pathname === "/") {
    return "public-home-cache-300s";
  }

  if (pathname === "/api/articles") {
    return "public-api-cache-300s";
  }

  if (pathname.startsWith("/articles/")) {
    return "public-article-cache-300s";
  }

  if (isLongCachePublicRoute(pathname)) {
    return "public-long-cache-3600s";
  }

  return "public-page-cache-300s";
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  if (isBypassRoute(pathname)) {
    setHeaders(response, getBypassCacheHeaders("bypass-operational-cache"));
    return response;
  }

  if (isPublicReaderRoute(pathname)) {
    const cacheControl = isLongCachePublicRoute(pathname)
      ? PUBLIC_LONG_CACHE_CONTROL
      : PUBLIC_PAGE_CACHE_CONTROL;

    setHeaders(response, getPublicCacheHeaders(getPolicyName(pathname), cacheControl));
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/about",
    "/articles/:path*",
    "/api/articles",
    "/api/log-test",
    "/api/log-test/:path*",
    "/api/auth/:path*",
    "/admin",
    "/admin/:path*",
    "/monitoring",
    "/monitoring/:path*",
    "/opengraph-image",
    "/robots.txt",
    "/sitemap.xml",
  ],
};
