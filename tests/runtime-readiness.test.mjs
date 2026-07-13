import assert from "node:assert/strict";
import test from "node:test";

import { evaluateRuntimeReadiness } from "../web/runtimeReadiness.mjs";
import { LEGACY_COMPATIBLE_SCHEMA_VERSION, MIGRATION_HEAD } from "../web/migrationContract.mjs";

const digest = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const schemaVersion = LEGACY_COMPATIBLE_SCHEMA_VERSION;
const schemaFingerprint = "a".repeat(32);

function validSchemaContract(overrides = {}) {
  return {
    legacySchemaVersion: schemaVersion,
    migrationHead: MIGRATION_HEAD,
    expectedSchemaFingerprint: schemaFingerprint,
    actualSchemaFingerprint: schemaFingerprint,
    ...overrides,
  };
}

function stagingEnvironment(overrides = {}) {
  return {
    NUTSNEWS_RUNTIME_ENV: "staging",
    NUTSNEWS_SIDE_EFFECTS_MODE: "disabled",
    NUTSNEWS_DATA_ENVIRONMENT: "staging",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "staging",
    NUTSNEWS_SUPABASE_PROJECT_REF: "staging-project",
    NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "https://staging-project.supabase.co",
    NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY: "synthetic-staging-anon-key",
    NUTSNEWS_SOURCE_COMMIT: "synthetic-source-commit",
    NUTSNEWS_EXPECTED_SOURCE_COMMIT: "synthetic-source-commit",
    NUTSNEWS_BUILD_ID: "synthetic-build-1",
    NUTSNEWS_EXPECTED_BUILD_ID: "synthetic-build-1",
    NUTSNEWS_DEPLOYMENT_TARGET: "vps-staging",
    NUTSNEWS_EXPECTED_IMAGE_DIGEST: digest,
    NUTSNEWS_DEPLOYED_IMAGE_DIGEST: digest,
    NUTSNEWS_CONFIG_GENERATION: "synthetic-staging-config-1",
    NUTSNEWS_EXPECTED_SCHEMA_VERSION: schemaVersion,
    NUTSNEWS_READYZ_TIMEOUT_MS: "25",
    ...overrides,
  };
}

function productionEnvironment(overrides = {}) {
  return stagingEnvironment({
    NUTSNEWS_RUNTIME_ENV: "production",
    NUTSNEWS_SIDE_EFFECTS_MODE: "live",
    NUTSNEWS_DATA_ENVIRONMENT: "production",
    NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "production",
    NUTSNEWS_SUPABASE_PROJECT_REF: "production-project",
    NUTSNEWS_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co",
    NUTSNEWS_DEPLOYMENT_TARGET: "production-vps",
    NUTSNEWS_CONFIG_GENERATION: "synthetic-production-config-1",
    ...overrides,
  });
}

async function evaluate(env, readSchemaContract = async () => validSchemaContract()) {
  return evaluateRuntimeReadiness({ env, readSchemaContract });
}

test("readiness accepts staging and production configurations for the same immutable digest", async () => {
  const staging = await evaluate(stagingEnvironment());
  const production = await evaluate(productionEnvironment());

  assert.equal(staging.ready, true);
  assert.equal(staging.code, "ready");
  assert.equal(staging.runtimeEnv, "staging");
  assert.equal(staging.deploymentTarget, "vps-staging");
  assert.equal(production.ready, true);
  assert.equal(production.code, "ready");
  assert.equal(production.runtimeEnv, "production");
  assert.equal(production.deploymentTarget, "production-vps");
  assert.equal(staging.expectedImageDigest, production.expectedImageDigest);
  assert.notEqual(staging.configGeneration, production.configGeneration);
});

test("Vercel retains the existing runtime-safety readiness contract without OCI-only inputs", async () => {
  let dependencyReads = 0;
  const readiness = await evaluateRuntimeReadiness({
    env: productionEnvironment({
      VERCEL: "1",
      VERCEL_ENV: "production",
      NUTSNEWS_DEPLOYMENT_TARGET: undefined,
      NUTSNEWS_EXPECTED_SOURCE_COMMIT: undefined,
      NUTSNEWS_EXPECTED_BUILD_ID: undefined,
      NUTSNEWS_EXPECTED_IMAGE_DIGEST: undefined,
      NUTSNEWS_DEPLOYED_IMAGE_DIGEST: undefined,
      NUTSNEWS_CONFIG_GENERATION: undefined,
      NUTSNEWS_EXPECTED_SCHEMA_VERSION: undefined,
    }),
    async readSchemaContract() {
      dependencyReads += 1;
      return validSchemaContract();
    },
  });

  assert.equal(readiness.ready, true);
  assert.equal(readiness.code, "ready");
  assert.equal(dependencyReads, 0);
});

test("readiness rejects missing or invalid release configuration", async () => {
  const missingGeneration = await evaluate(
    stagingEnvironment({ NUTSNEWS_CONFIG_GENERATION: "" }),
  );
  const invalidTimeout = await evaluate(
    stagingEnvironment({ NUTSNEWS_READYZ_TIMEOUT_MS: "unbounded" }),
  );
  const invalidTarget = await evaluate(
    stagingEnvironment({ NUTSNEWS_DEPLOYMENT_TARGET: "unsupported-target" }),
  );

  assert.equal(missingGeneration.ready, false);
  assert.equal(missingGeneration.code, "runtime_identity_invalid");
  assert.equal(invalidTimeout.ready, false);
  assert.equal(invalidTimeout.code, "runtime_identity_invalid");
  assert.equal(invalidTarget.ready, false);
  assert.equal(invalidTarget.code, "deployment_target_invalid");
});

test("readiness reuses fail-closed side-effect and data identity policy", async () => {
  const unsafeSideEffects = await evaluate(
    stagingEnvironment({ NUTSNEWS_SIDE_EFFECTS_MODE: "live" }),
  );
  const dataMismatch = await evaluate(
    stagingEnvironment({ NUTSNEWS_DATA_ENVIRONMENT: "production" }),
  );

  assert.equal(unsafeSideEffects.ready, false);
  assert.equal(unsafeSideEffects.code, "staging_live_side_effects_rejected");
  assert.equal(dataMismatch.ready, false);
  assert.equal(dataMismatch.code, "runtime_data_environment_mismatch");
});

test("readiness rejects deployment and release identity mismatches", async () => {
  const targetMismatch = await evaluate(
    stagingEnvironment({ NUTSNEWS_DEPLOYMENT_TARGET: "production-vps" }),
  );
  const releaseMismatch = await evaluate(
    stagingEnvironment({ NUTSNEWS_EXPECTED_SOURCE_COMMIT: "different-source-commit" }),
  );

  assert.equal(targetMismatch.ready, false);
  assert.equal(targetMismatch.code, "deployment_target_environment_mismatch");
  assert.equal(releaseMismatch.ready, false);
  assert.equal(releaseMismatch.code, "release_identity_mismatch");
});

test("readiness rejects legacy schema mismatch, dependency failure, and a bounded dependency timeout", async () => {
  const schemaMismatch = await evaluate(
    stagingEnvironment(),
    async () => validSchemaContract({ legacySchemaVersion: "20260712160000" }),
  );
  const dependencyFailure = await evaluate(stagingEnvironment(), async () => {
    throw new Error("synthetic dependency details must not be exposed");
  });
  const timeout = await evaluate(stagingEnvironment(), () => new Promise(() => {}));

  assert.equal(schemaMismatch.ready, false);
  assert.equal(schemaMismatch.code, "schema_version_mismatch");
  assert.equal(dependencyFailure.ready, false);
  assert.equal(dependencyFailure.code, "supabase_dependency_failed");
  assert.equal(timeout.ready, false);
  assert.equal(timeout.code, "supabase_dependency_timeout");
});

test("readiness fails closed when staging is not at migration head or catalog drift is detected", async () => {
  const staleHead = await evaluate(
    stagingEnvironment(),
    async () => validSchemaContract({ migrationHead: "20260712170000" }),
  );
  const schemaDrift = await evaluate(
    stagingEnvironment(),
    async () => validSchemaContract({ actualSchemaFingerprint: "b".repeat(32) }),
  );

  assert.equal(staleHead.ready, false);
  assert.equal(staleHead.code, "migration_head_mismatch");
  assert.equal(schemaDrift.ready, false);
  assert.equal(schemaDrift.code, "schema_drift_detected");
});

test("a staging production-data sentinel is refused without leaking its identity or secret", async () => {
  const productionDataIdentity = "production-data-sentinel";
  const serverSecret = "server-secret-sentinel";
  const readiness = await evaluate(
    stagingEnvironment({
      NUTSNEWS_SUPABASE_PROJECT_REF: productionDataIdentity,
      NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: productionDataIdentity,
      NUTSNEWS_PUBLIC_SUPABASE_URL: `https://${productionDataIdentity}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: serverSecret,
    }),
  );
  const serialized = JSON.stringify(readiness);

  assert.equal(readiness.ready, false);
  assert.equal(readiness.code, "staging_production_project_rejected");
  assert.doesNotMatch(serialized, new RegExp(productionDataIdentity));
  assert.doesNotMatch(serialized, new RegExp(serverSecret));
});

test("each evaluation reads its current fixture identity instead of retaining a prior readiness result", async () => {
  const first = await evaluate(
    stagingEnvironment({ NUTSNEWS_CONFIG_GENERATION: "synthetic-generation-one" }),
  );
  const second = await evaluate(
    stagingEnvironment({ NUTSNEWS_CONFIG_GENERATION: "synthetic-generation-two" }),
  );

  assert.equal(first.ready, true);
  assert.equal(second.ready, true);
  assert.equal(first.configGeneration, "synthetic-generation-one");
  assert.equal(second.configGeneration, "synthetic-generation-two");
});
