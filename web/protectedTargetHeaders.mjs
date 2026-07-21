/**
 * @typedef {{
 *   extraHTTPHeaders?: Record<string, string>,
 *   hasProtectedTargetHeaders: boolean,
 * }} ProtectedTargetHeaders
 */

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @param {{ requireCloudflareAccess?: boolean, defaultVercelSetBypassCookie?: boolean }} options
 * @returns {ProtectedTargetHeaders}
 */
export function buildProtectedTargetHeaders(env = process.env, options = {}) {
  const clientId = String(env.CF_ACCESS_CLIENT_ID ?? "").trim();
  const clientSecret = String(env.CF_ACCESS_CLIENT_SECRET ?? "").trim();
  const requireCloudflareAccess = options.requireCloudflareAccess === true;
  const defaultVercelSetBypassCookie = options.defaultVercelSetBypassCookie === true;

  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error("Cloudflare Access service-token inputs must be provided together");
  }
  if (requireCloudflareAccess && (!clientId || !clientSecret)) {
    throw new Error("Cloudflare Access service-token inputs are required");
  }

  /** @type {Record<string, string>} */
  const headers = {};
  if (clientId) {
    headers["CF-Access-Client-Id"] = clientId;
    headers["CF-Access-Client-Secret"] = clientSecret;
  }

  const vercelBypassSecret = String(
    env.VERCEL_AUTOMATION_BYPASS_SECRET ?? env.VERCEL_PROTECTION_BYPASS_SECRET ?? "",
  ).trim();
  if (vercelBypassSecret) {
    headers["x-vercel-protection-bypass"] = vercelBypassSecret;
    const bypassCookie = String(
      env.VERCEL_SET_BYPASS_COOKIE ?? (defaultVercelSetBypassCookie ? "true" : ""),
    )
      .trim()
      .toLowerCase();

    if (bypassCookie && !["true", "samesitenone"].includes(bypassCookie)) {
      throw new Error('VERCEL_SET_BYPASS_COOKIE must be "true", "samesitenone", or unset');
    }
    if (bypassCookie) {
      headers["x-vercel-set-bypass-cookie"] = bypassCookie;
    }
  }

  return {
    extraHTTPHeaders: Object.keys(headers).length > 0 ? headers : undefined,
    hasProtectedTargetHeaders: Object.keys(headers).length > 0,
  };
}
