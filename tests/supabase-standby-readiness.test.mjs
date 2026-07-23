import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REQUIRED_STANDBY_VALUES,
  SupabaseStandbyReadinessError,
  standbyReadinessSummary,
  validateSupabaseStandbyReadinessEnv,
} from "../scripts/supabase_standby_readiness.mjs";

const validEnv = Object.freeze({
  NUTSNEWS_STANDBY_PROJECT_POLICY: "existing-production-supabase",
  NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  NUTSNEWS_STANDBY_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NUTSNEWS_STANDBY_SUPABASE_DB_URL:
    "postgresql://postgres:standby-password@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?sslmode=require",
  NUTSNEWS_STANDBY_SUPABASE_SERVICE_ROLE_KEY: "sb_secret_standby_service_role_key",
  NUTSNEWS_STANDBY_SUPABASE_ANON_KEY: "sb_publishable_standby_anon_key",
  NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
});

test("valid standby protected inventory returns only safe metadata", () => {
  const metadata = validateSupabaseStandbyReadinessEnv(validEnv);

  assert.equal(metadata.policy, "existing-production-supabase");
  assert.equal(metadata.requiredValueCount, REQUIRED_STANDBY_VALUES.length);
  assert.equal(metadata.standbyUrlShape, "https-project-url");
  assert.equal(metadata.databaseUrlShape, "direct-postgres-ssl");
  assert.equal(metadata.standbyTarget, "existing-production-supabase");
  assert.equal(metadata.targetAlignment, "standby-ref-matches-production-ref");
  assert.equal(metadata.primaryDatabase, "backend-postgres-primary-read-write");
  assert.equal(metadata.writeIsolation, "withheld-from-app-worker-until-approved-failover");
  assert.equal(metadata.failoverReadinessGate, "requires-lag-parity-schema-sequence-checks");

  const summary = standbyReadinessSummary(metadata);
  for (const secret of [
    validEnv.NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF,
    validEnv.NUTSNEWS_STANDBY_SUPABASE_URL,
    validEnv.NUTSNEWS_STANDBY_SUPABASE_DB_URL,
    validEnv.NUTSNEWS_STANDBY_SUPABASE_SERVICE_ROLE_KEY,
    validEnv.NUTSNEWS_STANDBY_SUPABASE_ANON_KEY,
  ]) {
    assert.doesNotMatch(summary, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("standby project must be the existing production Supabase project", () => {
  assert.throws(
    () =>
      validateSupabaseStandbyReadinessEnv({
        ...validEnv,
        NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF: "uvwxyzabcdefghijklmn",
        NUTSNEWS_STANDBY_SUPABASE_URL: "https://uvwxyzabcdefghijklmn.supabase.co",
        NUTSNEWS_STANDBY_SUPABASE_DB_URL: "postgresql://postgres:password@db.uvwxyzabcdefghijklmn.supabase.co:5432/postgres?sslmode=require",
      }),
    /must match the production Supabase project ref/,
  );

  assert.throws(
    () => validateSupabaseStandbyReadinessEnv({ ...validEnv, NUTSNEWS_STANDBY_PROJECT_POLICY: "fresh-project" }),
    /existing-production-supabase policy/,
  );

  assert.throws(
    () => validateSupabaseStandbyReadinessEnv({ ...validEnv, NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "" }),
    /NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF/,
  );
});

test("standby URL and direct DB URL must belong to the same project ref", () => {
  assert.throws(
    () => validateSupabaseStandbyReadinessEnv({ ...validEnv, NUTSNEWS_STANDBY_SUPABASE_URL: "https://wrongrefwrongref0000.supabase.co" }),
    /HTTPS URL for the standby project ref/,
  );

  assert.throws(
    () =>
      validateSupabaseStandbyReadinessEnv({
        ...validEnv,
        NUTSNEWS_STANDBY_SUPABASE_DB_URL:
          "postgresql://postgres:standby-password@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require",
      }),
    /direct standby Supabase database host/,
  );
});

test("standby DB URL requires TLS and credentials", () => {
  assert.throws(
    () =>
      validateSupabaseStandbyReadinessEnv({
        ...validEnv,
        NUTSNEWS_STANDBY_SUPABASE_DB_URL: "postgresql://postgres:password@db.abcdefghijklmnopqrst.supabase.co:5432/postgres",
      }),
    /sslmode=require/,
  );

  assert.throws(
    () =>
      validateSupabaseStandbyReadinessEnv({
        ...validEnv,
        NUTSNEWS_STANDBY_SUPABASE_DB_URL: "postgresql://db.abcdefghijklmnopqrst.supabase.co:5432/postgres?sslmode=require",
      }),
    /protected database credentials/,
  );
});

test("missing protected values fail closed", () => {
  for (const requiredName of REQUIRED_STANDBY_VALUES) {
    const env = { ...validEnv };
    delete env[requiredName];
    assert.throws(() => validateSupabaseStandbyReadinessEnv(env), SupabaseStandbyReadinessError);
  }
});
