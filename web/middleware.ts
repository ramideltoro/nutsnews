import { NextResponse, type NextRequest } from "next/server";
import { articleCacheTag, SITE_SHELL_CACHE_TAG } from "@/lib/cacheTags";

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

function getPublicArticleId(pathname: string) {
  const match = pathname.match(/^\/articles\/([^/]+)\/?$/);

  if (!match || match[1] === "sitemap") {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
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

  if (isAdminRoute(pathname)) {
    setHeaders(response, getBypassCacheHeaders("bypass-admin-cache"));
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  const articleId = getPublicArticleId(pathname);

  if (articleId) {
    try {
      response.headers.set(
        "Cache-Tag",
        `${SITE_SHELL_CACHE_TAG},${articleCacheTag(articleId)}`,
      );
    } catch {
      setHeaders(response, getBypassCacheHeaders("bypass-invalid-article-cache-key"));
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/articles/:path*"],
};
