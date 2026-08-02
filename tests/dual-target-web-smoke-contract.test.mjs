import assert from "node:assert/strict";
import test from "node:test";

import { assertQualifiedReadinessBody } from "../scripts/dual_target_web_smoke_contract.mjs";

const expected = Object.freeze({
  sourceCommit: "a".repeat(40),
  buildId: "123-1",
  deploymentTarget: "vercel-production",
  configGeneration: "vercel-generation-1",
  databaseProviderMode: "backend_postgres_primary",
});

const qualified = Object.freeze({
  ok: true,
  ready: true,
  service: "nutsnews-web",
  code: "ready",
  ...expected,
});

test("the deployment smoke accepts the complete readiness identity", () => {
  assert.doesNotThrow(() => assertQualifiedReadinessBody(qualified, expected));
});

test("the deployment smoke rejects an unready body even when the legacy ok field is true", () => {
  assert.throws(
    () => assertQualifiedReadinessBody({ ...qualified, ready: false }, expected),
    /did not return a qualified runtime response/,
  );
});

for (const [field, value, label] of [
  ["sourceCommit", "b".repeat(40), "source commit"],
  ["buildId", "124-1", "build ID"],
  ["deploymentTarget", "production-vps", "deployment target"],
  ["configGeneration", "different-generation", "config generation"],
  ["databaseProviderMode", "supabase_primary", "database provider mode"],
]) {
  test(`the deployment smoke rejects a readiness ${label} mismatch`, () => {
    assert.throws(
      () => assertQualifiedReadinessBody({ ...qualified, [field]: value }, expected),
      new RegExp(`Readiness ${label} mismatch`, "i"),
    );
  });
}
