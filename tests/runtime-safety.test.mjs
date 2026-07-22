import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeSafetyError,
  assertDataMutation,
  assertDataRead,
  assertExternalSideEffect,
  assertIsolatedDataMutation,
  assertOAuthCallback,
  assertProductionOperation,
  assertSyntheticFixtureMutation,
  getRuntimeSafetyPolicy,
  getSafeReadiness,
  isTelemetryDeliveryAllowed,
} from "../web/runtimeSafety.mjs";

function stagingEnvironment(overrides = {}) {
  return {
    NUTSNEWS_RUNTIME_ENV: "staging",
    NUTSNEWS_SIDE_EFFECTS_MODE: "disabled",
    NUTSNEWS_DATA_ENVIRONMENT: "staging",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "staging",
    NUTSNEWS_SUPABASE_PROJECT_REF: "stage-project",
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "https://stage-project.supabase.co",
    NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    ...overrides,
  };
}

function productionEnvironment(overrides = {}) {
  return {
    NUTSNEWS_RUNTIME_ENV: "production",
    NUTSNEWS_SIDE_EFFECTS_MODE: "live",
    NUTSNEWS_DATA_ENVIRONMENT: "production",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "production",
    NUTSNEWS_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co",
    NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    NUTSNEWS_DEPLOYMENT_TARGET: "production-vps",
    AUTH_URL: "https://www.nutsnews.com",
    NEXTAUTH_URL: "https://www.nutsnews.com",
    AUTH_TRUST_HOST: "true",
    NUTSNEWS_ADMIN_CANONICAL_ORIGIN: "https://www.nutsnews.com",
    NUTSNEWS_ADMIN_DIRECT_ORIGIN: "https://vps.nutsnews.com",
    ...overrides,
  };
}

function stagingOAuthEnvironment(overrides = {}) {
  return stagingEnvironment({
    NUTSNEWS_OAUTH_CREDENTIALS_ENV: "staging",
    AUTH_URL: "https://staging.nutsnews.com",
    AUTH_GOOGLE_ID: "staging-google-client-id",
    AUTH_GOOGLE_SECRET: "staging-google-client-secret",
    ...overrides,
  });
}

test("valid staging keeps read-only access available while side effects are disabled", () => {
  const environment = stagingEnvironment();
  assert.equal(getRuntimeSafetyPolicy(environment).ready, true);
  assert.equal(assertDataRead("public-reader", environment).runtimeEnv, "staging");
  assert.throws(
    () => assertExternalSideEffect("contact", "http://localhost:4000/emails", environment),
    (error) => error instanceof RuntimeSafetyError && error.code === "external_side_effect_blocked",
  );
  assert.throws(
    () => assertDataMutation("admin-feed", environment),
    (error) => error instanceof RuntimeSafetyError && error.code === "production_operation_required",
  );
});

test("missing, contradictory, and unrecognized policy inputs fail closed", () => {
  assert.equal(getRuntimeSafetyPolicy({}).ready, false);
  assert.equal(
    getRuntimeSafetyPolicy(
      stagingEnvironment({ NUTSNEWS_PUBLIC_APP_ENV: "production" }),
    ).code,
    "runtime_environment_conflict",
  );
  assert.equal(
    getRuntimeSafetyPolicy(stagingEnvironment({ NUTSNEWS_SIDE_EFFECTS_MODE: "unknown" })).ready,
    false,
  );
  assert.equal(
    getRuntimeSafetyPolicy(stagingEnvironment({ NUTSNEWS_DATA_ENVIRONMENT: "production" })).ready,
    false,
  );
});

test("a staging runtime with a production Supabase identity is refused without identifiers or secrets", () => {
  const sentinelIdentity = "production-identity-sentinel";
  const sentinelSecret = "service-role-secret-sentinel";
  const environment = stagingEnvironment({
    NUTSNEWS_SUPABASE_PROJECT_REF: sentinelIdentity,
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: sentinelIdentity,
    NUTSNEWS_PUBLIC_SUPABASE_URL: `https://${sentinelIdentity}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: sentinelSecret,
  });
  const readiness = getSafeReadiness(environment);
  const output = JSON.stringify(readiness);

  assert.equal(readiness.ready, false);
  assert.equal(readiness.code, "staging_production_project_rejected");
  assert.doesNotMatch(output, new RegExp(sentinelIdentity));
  assert.doesNotMatch(output, new RegExp(sentinelSecret));
});

test("declared staging identity cannot mask a production Supabase endpoint", () => {
  const policy = getRuntimeSafetyPolicy(
    stagingEnvironment({
      NUTSNEWS_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co",
    }),
  );
  assert.equal(policy.ready, false);
  assert.equal(policy.code, "supabase_endpoint_identity_mismatch");
});

test("sandbox permits only isolated endpoints and isolated staging writes", () => {
  const environment = stagingEnvironment({
    NUTSNEWS_SIDE_EFFECTS_MODE: "sandbox",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  });
  assert.doesNotThrow(() => assertExternalSideEffect("contact", "http://127.0.0.1:8787/emails", environment));
  assert.throws(
    () => assertExternalSideEffect("contact", "https://api.resend.com/emails", environment),
    RuntimeSafetyError,
  );
  assert.doesNotThrow(() => assertIsolatedDataMutation("quota-event", environment));
  assert.doesNotThrow(() => assertSyntheticFixtureMutation("nutsnews-test-sandbox-fixture", environment));
});

test("staging recognizes Docker's isolated fixture hostname without allowing production access", () => {
  const environment = stagingEnvironment({
    NUTSNEWS_PUBLIC_SUPABASE_URL: "http://host.docker.internal:54321",
  });

  assert.equal(getRuntimeSafetyPolicy(environment).ready, true);
  assert.doesNotThrow(() => assertDataRead("container-fixture-reader", environment));
});

test("only live production can perform production mutations", () => {
  const policy = getRuntimeSafetyPolicy(productionEnvironment());

  assert.equal(policy.productionWritesPaused, false);
  assert.doesNotThrow(() => assertDataMutation("admin-feed", productionEnvironment()));
  assert.throws(
    () => assertSyntheticFixtureMutation("nutsnews-test-production-fixture", productionEnvironment()),
    RuntimeSafetyError,
  );
});

test("production writer pause blocks app writes and external effects while preserving reads", () => {
  const environment = productionEnvironment({ NUTSNEWS_PRODUCTION_WRITES_PAUSED: "true" });
  const policy = getRuntimeSafetyPolicy(environment);
  const readiness = getSafeReadiness(environment);

  assert.equal(policy.ready, true);
  assert.equal(policy.productionWritesPaused, true);
  assert.equal(readiness.ready, true);
  assert.equal(readiness.productionWritesPaused, true);
  assert.doesNotThrow(() => assertDataRead("public-reader", environment));
  assert.throws(
    () => assertProductionOperation("admin-operation", environment),
    (error) => error instanceof RuntimeSafetyError && error.code === "production_writes_paused",
  );
  assert.throws(
    () => assertDataMutation("admin-feed", environment),
    (error) => error instanceof RuntimeSafetyError && error.code === "production_writes_paused",
  );
  assert.throws(
    () => assertIsolatedDataMutation("quota-usage-event", environment),
    (error) => error instanceof RuntimeSafetyError && error.code === "production_writes_paused",
  );
  assert.throws(
    () => assertExternalSideEffect("contact-form-delivery", "https://api.resend.com/emails", environment),
    (error) => error instanceof RuntimeSafetyError && error.code === "production_writes_paused",
  );
  assert.equal(isTelemetryDeliveryAllowed(environment), false);
});

test("OAuth callbacks require canonical production admin host identity", () => {
  assert.doesNotThrow(() =>
    assertOAuthCallback(
      "oauth-callback",
      "https://www.nutsnews.com/api/auth/callback/google",
      productionEnvironment(),
    ),
  );
  assert.doesNotThrow(() =>
    assertOAuthCallback(
      "oauth-callback",
      {
        url: "http://0.0.0.0:3000/api/auth/callback/google",
        host: "www.nutsnews.com",
        forwardedProto: "https",
      },
      productionEnvironment(),
    ),
  );
  assert.doesNotThrow(() =>
    assertOAuthCallback(
      "oauth-callback",
      {
        url: "http://0.0.0.0:3000/api/auth/callback/google",
        host: "www.nutsnews.com:443",
        forwardedProto: "https",
      },
      productionEnvironment(),
    ),
  );
  assert.doesNotThrow(() =>
    assertOAuthCallback(
      "oauth-callback",
      {
        url: "http://0.0.0.0:3000/api/auth/callback/google",
        host: "vps.nutsnews.com",
        forwardedProto: "https",
      },
      productionEnvironment(),
    ),
  );
  assert.throws(
    () =>
      assertOAuthCallback(
        "oauth-callback",
        {
          url: "http://0.0.0.0:3000/api/auth/callback/google",
          host: "unexpected.example.test",
          forwardedProto: "https",
        },
        productionEnvironment(),
      ),
    (error) =>
      error instanceof RuntimeSafetyError &&
      error.code === "oauth_request_origin_mismatch",
  );

  for (const [environment, code] of [
    [
      productionEnvironment({
        AUTH_URL: "https://vps.nutsnews.com",
        NEXTAUTH_URL: "https://vps.nutsnews.com",
      }),
      "oauth_canonical_origin_mismatch",
    ],
    [
      productionEnvironment({ NEXTAUTH_URL: "https://vps.nutsnews.com" }),
      "oauth_auth_url_conflict",
    ],
    [
      productionEnvironment({ AUTH_TRUST_HOST: "false" }),
      "oauth_trust_host_disabled",
    ],
    [
      productionEnvironment({ NUTSNEWS_ADMIN_CANONICAL_ORIGIN: "http://www.nutsnews.com" }),
      "oauth_admin_origin_invalid",
    ],
  ]) {
    assert.throws(
      () =>
        assertOAuthCallback(
          "oauth-callback",
          "https://www.nutsnews.com/api/auth/callback/google",
          environment,
        ),
      (error) => error instanceof RuntimeSafetyError && error.code === code,
    );
  }
});

test("Vercel production auth session smoke is not blocked by the VPS canonical host guard", () => {
  assert.doesNotThrow(() =>
    assertOAuthCallback(
      "auth-session",
      {
        url: "https://nutsnews-fixture.vercel.app/api/auth/session",
        host: "nutsnews-fixture.vercel.app",
        forwardedProto: "https",
      },
      productionEnvironment({
        NUTSNEWS_DEPLOYMENT_TARGET: "vercel-production",
        AUTH_URL: "https://nutsnews.vercel.app",
        NEXTAUTH_URL: "https://nutsnews.vercel.app",
        AUTH_TRUST_HOST: "false",
      }),
    ),
  );
});

test("OAuth callbacks allow only the isolated staging identity", () => {
  assert.doesNotThrow(() =>
    assertOAuthCallback(
      "oauth-callback",
      "https://staging.nutsnews.com/api/auth/callback/google",
      stagingOAuthEnvironment(),
    ),
  );
  assert.doesNotThrow(() =>
    assertOAuthCallback(
      "oauth-callback",
      {
        url: "https://0.0.0.0:3000/api/auth/callback/google",
        host: "staging.nutsnews.com",
        forwardedProto: "https",
      },
      stagingOAuthEnvironment(),
    ),
  );
  assert.doesNotThrow(() =>
    assertOAuthCallback(
      "oauth-callback",
      {
        url: "https://0.0.0.0:3000/api/auth/callback/google",
        host: "staging.nutsnews.com:443",
        forwardedProto: "https",
      },
      stagingOAuthEnvironment(),
    ),
  );
});

test("staging OAuth callbacks fail closed for missing, mixed, or ambiguous identities", () => {
  const refusedEnvironments = [
    stagingOAuthEnvironment({ NUTSNEWS_OAUTH_CREDENTIALS_ENV: "" }),
    stagingOAuthEnvironment({ NUTSNEWS_OAUTH_CREDENTIALS_ENV: "production" }),
    stagingOAuthEnvironment({ AUTH_GOOGLE_ID: "" }),
    stagingOAuthEnvironment({ AUTH_GOOGLE_SECRET: "" }),
    stagingOAuthEnvironment({ AUTH_URL: "https://www.nutsnews.com" }),
    stagingOAuthEnvironment({ AUTH_URL: "http://staging.nutsnews.com" }),
    stagingOAuthEnvironment({ AUTH_URL: "https://staging.nutsnews.com/unexpected" }),
    stagingOAuthEnvironment({ NEXTAUTH_URL: "https://different.example.test" }),
    stagingOAuthEnvironment({ NUTSNEWS_SIDE_EFFECTS_MODE: "sandbox" }),
  ];

  for (const environment of refusedEnvironments) {
    assert.throws(
      () =>
        assertOAuthCallback(
          "oauth-callback",
          "https://staging.nutsnews.com/api/auth/callback/google",
          environment,
        ),
      (error) =>
        error instanceof RuntimeSafetyError &&
        error.code === "oauth_callback_identity_required",
    );
  }

  assert.throws(
    () =>
      assertOAuthCallback(
        "oauth-callback",
        "https://origin.example.test/api/auth/callback/google",
        stagingOAuthEnvironment(),
      ),
    (error) =>
      error instanceof RuntimeSafetyError &&
      error.code === "oauth_callback_identity_required",
  );

  for (const requestIdentity of [
    {
      url: "https://0.0.0.0:3000/api/auth/callback/google",
      host: "www.nutsnews.com",
      forwardedProto: "https",
    },
    {
      url: "https://0.0.0.0:3000/api/auth/callback/google",
      host: "staging.nutsnews.com",
      forwardedProto: "http",
    },
  ]) {
    assert.throws(
      () =>
        assertOAuthCallback(
          "oauth-callback",
          requestIdentity,
          stagingOAuthEnvironment(),
        ),
      (error) =>
        error instanceof RuntimeSafetyError &&
        error.code === "oauth_callback_identity_required",
    );
  }
});
