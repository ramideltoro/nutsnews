import { getRuntimeSafetyPolicy } from "./runtimeSafety.mjs";
import { getRuntimeIdentity } from "./runtimeReadiness.mjs";

const MAX_PUBLIC_VALUE_LENGTH = 2048;

function value(env, ...names) {
  for (const name of names) {
    const candidate = String(env[name] ?? "").trim();

    if (candidate) {
      return candidate.slice(0, MAX_PUBLIC_VALUE_LENGTH);
    }
  }

  return "";
}

function publicUrl(env, ...names) {
  const candidate = value(env, ...names);

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * Return the browser-safe, runtime-owned configuration allowlist.
 *
 * This module deliberately does not read or serialize credentials such as
 * service-role keys, provider tokens, OAuth secrets, or connection strings.
 * Legacy NEXT_PUBLIC_* names remain server-side compatibility inputs only;
 * callers must fetch this object at runtime instead of importing env values.
 */
export function getRuntimePublicConfig(env = process.env) {
  const policy = getRuntimeSafetyPolicy(env);
  const identity = getRuntimeIdentity(env);
  const runtimeReady = policy.ready;
  const resolvedRuntimeEnv = runtimeReady ? policy.runtimeEnv : "unknown";
  const resolvedSideEffectsMode = runtimeReady ? policy.sideEffectsMode : "disabled";
  const sandboxContactEnabled =
    resolvedRuntimeEnv === "staging" &&
    resolvedSideEffectsMode === "sandbox" &&
    value(env, "NUTSNEWS_SANDBOX_CONTACT") === "true";
  const contactDeliveryEnabled =
    (resolvedRuntimeEnv === "production" && resolvedSideEffectsMode === "live") ||
    sandboxContactEnabled;
  return {
    runtimeEnv: resolvedRuntimeEnv,
    sideEffectsMode: resolvedSideEffectsMode,
    databaseProviderMode: runtimeReady ? policy.databaseProviderMode : "invalid",
    productionWritesPaused: runtimeReady ? policy.productionWritesPaused : false,
    supabaseUrl: runtimeReady
      ? publicUrl(env, "NUTSNEWS_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
      : null,
    supabaseAnonKey: runtimeReady
      ? value(env, "NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY") || null
      : null,
    turnstileSiteKey:
      runtimeReady && contactDeliveryEnabled
        ? value(env, "NUTSNEWS_PUBLIC_TURNSTILE_SITE_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY") || null
        : null,
    sentryDsn:
      runtimeReady && resolvedRuntimeEnv === "production" && resolvedSideEffectsMode === "live"
        ? publicUrl(env, "NUTSNEWS_PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN")
        : null,
    gaId:
      runtimeReady && resolvedRuntimeEnv === "production" && resolvedSideEffectsMode === "live"
        ? value(env, "NUTSNEWS_PUBLIC_GA_ID", "NEXT_PUBLIC_GA_ID") || null
        : null,
    iosAppStoreUrl: publicUrl(
      env,
      "NUTSNEWS_PUBLIC_IOS_APP_STORE_URL",
      "NEXT_PUBLIC_NUTSNEWS_IOS_APP_STORE_URL",
    ),
    sourceCommit: identity.sourceCommit,
    buildId: identity.buildId,
    deploymentTarget: identity.deploymentTarget,
    expectedImageDigest: identity.expectedImageDigest,
    configGeneration: identity.configGeneration,
    telemetryEnabled:
      runtimeReady && resolvedRuntimeEnv === "production" && resolvedSideEffectsMode === "live",
  };
}
