import assert from "node:assert/strict";
import test from "node:test";

import {
  RuntimeSafetyError,
  assertDataMutation,
  assertDataRead,
  assertExternalSideEffect,
  assertIsolatedDataMutation,
  assertSyntheticFixtureMutation,
  getRuntimeSafetyPolicy,
  getSafeReadiness,
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
    ...overrides,
  };
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
  assert.doesNotThrow(() => assertDataMutation("admin-feed", productionEnvironment()));
  assert.throws(
    () => assertSyntheticFixtureMutation("nutsnews-test-production-fixture", productionEnvironment()),
    RuntimeSafetyError,
  );
});
