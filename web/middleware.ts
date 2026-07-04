import { NextResponse, type NextRequest } from "next/server";

const NO_STORE_CACHE_CONTROL = "no-store, max-age=0";

type HeaderMap = Record<string, string>;

function setHeaders(response: NextResponse, headers: HeaderMap) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
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

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  if (isOperationalNoStoreRoute(pathname)) {
    setHeaders(response, getBypassCacheHeaders("bypass-operational-cache"));

    if (isAdminRoute(pathname)) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/monitoring/:path*",
    "/api/log-test/:path*",
    "/api/auth/:path*",
    "/api/contact",
  ],
};
