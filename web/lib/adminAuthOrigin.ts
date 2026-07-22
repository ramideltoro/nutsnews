const DEFAULT_ADMIN_CANONICAL_ORIGIN = "https://www.nutsnews.com";
const DEFAULT_ADMIN_DIRECT_ORIGIN = "https://vps.nutsnews.com";

function normalizeOrigin(value: string | undefined, fallback: string) {
  const candidate = (value || fallback).trim();
  const url = new URL(candidate);

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.pathname !== "" && url.pathname !== "/") ||
    url.search ||
    url.hash
  ) {
    throw new Error("Admin auth origins must be bare HTTPS origins.");
  }

  return url.origin;
}

export function getAdminCanonicalOrigin(env: NodeJS.ProcessEnv = process.env) {
  return normalizeOrigin(env.NUTSNEWS_ADMIN_CANONICAL_ORIGIN, DEFAULT_ADMIN_CANONICAL_ORIGIN);
}

export function getAdminDirectOrigin(env: NodeJS.ProcessEnv = process.env) {
  return normalizeOrigin(env.NUTSNEWS_ADMIN_DIRECT_ORIGIN, DEFAULT_ADMIN_DIRECT_ORIGIN);
}

export function getAdminSignInRedirectUrl(env: NodeJS.ProcessEnv = process.env) {
  return `${getAdminCanonicalOrigin(env)}/admin`;
}

export function getAdminOAuthCallbackUrl(env: NodeJS.ProcessEnv = process.env) {
  return `${getAdminCanonicalOrigin(env)}/api/auth/callback/google`;
}

function safeAdminPath(url: URL) {
  if (url.pathname === "/" || url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  return "/admin";
}

export function canonicalizeAdminAuthRedirect(
  redirectUrl: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const canonicalOrigin = getAdminCanonicalOrigin(env);
  const directOrigin = getAdminDirectOrigin(env);

  if (redirectUrl.startsWith("//")) {
    return `${canonicalOrigin}/admin`;
  }

  const parsed = new URL(redirectUrl, canonicalOrigin);

  if (parsed.origin === canonicalOrigin || parsed.origin === directOrigin) {
    return `${canonicalOrigin}${safeAdminPath(parsed)}`;
  }

  return `${canonicalOrigin}/admin`;
}
