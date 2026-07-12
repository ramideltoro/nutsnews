const RUNTIME_ENVS = new Set(["staging", "production"]);
const SIDE_EFFECTS_MODES = new Set(["disabled", "sandbox", "live"]);
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

function runtimeEnv(env) {
  const candidate = value(
    env,
    "NUTSNEWS_RUNTIME_ENV",
    "NUTSNEWS_PUBLIC_APP_ENV",
    "NEXT_PUBLIC_APP_ENV",
  );

  return RUNTIME_ENVS.has(candidate) ? candidate : "unknown";
}

function sideEffectsMode(env) {
  const candidate = value(
    env,
    "NUTSNEWS_SIDE_EFFECTS_MODE",
    "NUTSNEWS_PUBLIC_SIDE_EFFECTS_MODE",
  );

  return SIDE_EFFECTS_MODES.has(candidate) ? candidate : "disabled";
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
  const resolvedRuntimeEnv = runtimeEnv(env);
  const resolvedSideEffectsMode = sideEffectsMode(env);
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
    supabaseUrl: publicUrl(env, "NUTSNEWS_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: value(
      env,
      "NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ) || null,
    turnstileSiteKey: value(
      env,
      "NUTSNEWS_PUBLIC_TURNSTILE_SITE_KEY",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    ) || null,
    sentryDsn: publicUrl(env, "NUTSNEWS_PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"),
    gaId: value(env, "NUTSNEWS_PUBLIC_GA_ID", "NEXT_PUBLIC_GA_ID") || null,
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
      resolvedRuntimeEnv === "production" && resolvedSideEffectsMode === "live",
  };
}
