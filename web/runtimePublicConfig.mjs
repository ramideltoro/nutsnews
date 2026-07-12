import { getRuntimeSafetyPolicy } from "./runtimeSafety.mjs";

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

function identityValue(env, fallback, ...names) {
  const candidate = value(env, ...names);

  if (candidate && /^[A-Za-z0-9._:@/-]+$/.test(candidate)) {
    return candidate.slice(0, 128);
  }

  return fallback;
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
  const sourceCommit = identityValue(
    env,
    "unknown",
    "NUTSNEWS_SOURCE_COMMIT",
    "VERCEL_GIT_COMMIT_SHA",
  );
  const buildId = identityValue(env, sourceCommit, "NUTSNEWS_BUILD_ID", "VERCEL_DEPLOYMENT_ID");
  const deploymentTarget = identityValue(
    env,
    env.VERCEL === "1" ? "vercel" : "unknown",
    "NUTSNEWS_DEPLOYMENT_TARGET",
    "VERCEL_ENV",
  );
  const expectedImageDigest = identityValue(
    env,
    "unknown",
    "NUTSNEWS_EXPECTED_IMAGE_DIGEST",
  );

  return {
    runtimeEnv: resolvedRuntimeEnv,
    sideEffectsMode: resolvedSideEffectsMode,
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
    sourceCommit,
    buildId,
    deploymentTarget,
    expectedImageDigest,
    telemetryEnabled:
      runtimeReady && resolvedRuntimeEnv === "production" && resolvedSideEffectsMode === "live",
  };
}
