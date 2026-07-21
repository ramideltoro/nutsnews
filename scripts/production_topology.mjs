import { DeploymentValidationError } from "./deployment_hardening.mjs";

export const canonicalProductionUrls = Object.freeze(["https://www.nutsnews.com/", "https://nutsnews.com/"]);
export const canonicalProductionHosts = Object.freeze(new Set(["www.nutsnews.com", "nutsnews.com"]));

export const productionTopologyEnv = Object.freeze({
  primaryProductionUrl: "NUTSNEWS_PRIMARY_PRODUCTION_URL",
  vpsProductionUrl: "NUTSNEWS_VPS_PRODUCTION_URL",
  vpsDirectProductionUrl: "NUTSNEWS_VPS_PRODUCTION_DIRECT_URL",
  vercelSecondaryProductionUrls: "NUTSNEWS_VERCEL_SECONDARY_PRODUCTION_URLS",
  vercelSecondaryProductionUrl: "NUTSNEWS_VERCEL_SECONDARY_PRODUCTION_URL",
  verifyVercelFailoverAliases: "NUTSNEWS_VERIFY_VERCEL_FAILOVER_ALIASES",
  vercelFailoverProductionAliases: "NUTSNEWS_VERCEL_FAILOVER_PRODUCTION_ALIASES",
  legacyVercelProductionAliases: "NUTSNEWS_VERCEL_PRODUCTION_ALIASES",
});

export const failoverControllerEnv = Object.freeze({
  healthCheckIntervalSeconds: "NUTSNEWS_FAILOVER_HEALTH_CHECK_INTERVAL_SECONDS",
  consecutiveVpsFailuresBeforeDnsFailover: "NUTSNEWS_FAILOVER_CONSECUTIVE_VPS_FAILURES",
  failbackDnsStateGate: "NUTSNEWS_FAILBACK_DNS_STATE_GATE",
});

export const defaultFailoverControllerConfig = Object.freeze({
  healthCheckIntervalSeconds: 15,
  consecutiveVpsFailuresBeforeDnsFailover: 3,
  failbackDnsStateGate: "current_dns_state_is_vercel_fallback_and_vps_ready",
});

export const defaultVpsPrimaryProductionUrl = canonicalProductionUrls[0];
export const defaultVpsDirectProductionUrl = "https://vps.nutsnews.com/";
export const defaultVercelFailoverProductionAliases = canonicalProductionUrls;

function clean(value) {
  return String(value ?? "").trim();
}

export function requireHttpsUrl(value, label) {
  try {
    const url = new URL(clean(value));
    if (url.protocol !== "https:") throw new Error("not https");
    return url;
  } catch {
    throw new DeploymentValidationError(`${label} must be an https URL.`);
  }
}

export function normalizeHttpsUrl(value, label) {
  return requireHttpsUrl(value, label).toString();
}

export function parseHttpsUrlList(value, label) {
  const rawValues = clean(value).split(",").map(clean).filter(Boolean);
  if (rawValues.length === 0) return [];
  return rawValues.map((rawValue) => normalizeHttpsUrl(rawValue, label));
}

function uniqueUrls(urls) {
  return [...new Set(urls.map((url) => normalizeHttpsUrl(url, "Production URL")))];
}

export function isCanonicalProductionUrl(value) {
  try {
    const url = requireHttpsUrl(value, "Production URL");
    return canonicalProductionHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function assertNoCanonicalProductionUrls(urls, label) {
  const canonicalUrls = urls.filter(isCanonicalProductionUrl);
  if (canonicalUrls.length > 0) {
    throw new DeploymentValidationError(
      `${label} must not include canonical production domains (${canonicalUrls.join(", ")}). ` +
        `${canonicalProductionUrls.join(", ")} are VPS-primary; set ${productionTopologyEnv.verifyVercelFailoverAliases}=true and ` +
        `${productionTopologyEnv.vercelFailoverProductionAliases} only during a controlled DNS failover test.`,
    );
  }
}

export function readBooleanFlag(value, label) {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return false;
  if (["1", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  throw new DeploymentValidationError(`${label} must be true or false.`);
}

export function configuredVpsPrimaryProductionTarget(env = process.env) {
  return normalizeHttpsUrl(
    clean(env[productionTopologyEnv.vpsProductionUrl]) ||
      clean(env[productionTopologyEnv.primaryProductionUrl]) ||
      defaultVpsPrimaryProductionUrl,
    "VPS primary production URL",
  );
}

export function configuredVpsDirectProductionTarget(env = process.env) {
  return normalizeHttpsUrl(
    clean(env[productionTopologyEnv.vpsDirectProductionUrl]) || defaultVpsDirectProductionUrl,
    "VPS direct production URL",
  );
}

export function configuredVercelProductionRuntimeTargets(env = process.env, { deploymentUrl } = {}) {
  const normalizedDeploymentUrl = normalizeHttpsUrl(deploymentUrl, "Vercel production deployment URL");
  const rawSecondaryUrls =
    clean(env[productionTopologyEnv.vercelSecondaryProductionUrls]) ||
    clean(env[productionTopologyEnv.vercelSecondaryProductionUrl]);
  const secondaryTargets = rawSecondaryUrls
    ? uniqueUrls(parseHttpsUrlList(rawSecondaryUrls, "Vercel secondary production URL"))
    : [normalizedDeploymentUrl];
  assertNoCanonicalProductionUrls(secondaryTargets, "Vercel secondary production URLs");

  const verifyFailoverAliases = readBooleanFlag(
    env[productionTopologyEnv.verifyVercelFailoverAliases],
    productionTopologyEnv.verifyVercelFailoverAliases,
  );
  const rawFailoverAliases =
    clean(env[productionTopologyEnv.vercelFailoverProductionAliases]) ||
    clean(env[productionTopologyEnv.legacyVercelProductionAliases]);
  const failoverAliases = verifyFailoverAliases
    ? uniqueUrls(rawFailoverAliases ? parseHttpsUrlList(rawFailoverAliases, "Vercel failover production alias") : defaultVercelFailoverProductionAliases)
    : [];

  return {
    secondaryTargets,
    failoverAliases,
    targets: uniqueUrls([...secondaryTargets, ...failoverAliases]),
    verifyFailoverAliases,
  };
}

function readPositiveInteger(value, defaultValue, label) {
  const raw = clean(value);
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new DeploymentValidationError(`${label} must be a positive integer.`);
  }
  return parsed;
}

export function readFailoverControllerConfig(env = process.env) {
  return {
    healthCheckIntervalSeconds: readPositiveInteger(
      env[failoverControllerEnv.healthCheckIntervalSeconds],
      defaultFailoverControllerConfig.healthCheckIntervalSeconds,
      failoverControllerEnv.healthCheckIntervalSeconds,
    ),
    consecutiveVpsFailuresBeforeDnsFailover: readPositiveInteger(
      env[failoverControllerEnv.consecutiveVpsFailuresBeforeDnsFailover],
      defaultFailoverControllerConfig.consecutiveVpsFailuresBeforeDnsFailover,
      failoverControllerEnv.consecutiveVpsFailuresBeforeDnsFailover,
    ),
    failbackDnsStateGate:
      clean(env[failoverControllerEnv.failbackDnsStateGate]) ||
      defaultFailoverControllerConfig.failbackDnsStateGate,
  };
}
