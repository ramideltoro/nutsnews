import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { buildUiSmokeEvidence, sanitizeUploadedArtifacts } from "../scripts/run_deployed_ui_smoke_with_evidence.mjs";

const baseEnv = {
  PLAYWRIGHT_BASE_URL: "https://staging.nutsnews.com",
  NUTSNEWS_UI_SMOKE_TARGET_TYPE: "vps-staging",
  NUTSNEWS_UI_SMOKE_SOURCE_COMMIT: "a".repeat(40),
  NUTSNEWS_UI_SMOKE_BUILD_ID: "123-1",
  NUTSNEWS_UI_SMOKE_DEPLOYMENT_ID: "stg-abc123",
  NUTSNEWS_UI_SMOKE_PR_NUMBER: "42",
  GITHUB_RUN_ID: "123",
  GITHUB_RUN_ATTEMPT: "1",
};

test("deployed UI smoke evidence has the final-gate shape", () => {
  const evidence = buildUiSmokeEvidence(baseEnv, "pass");
  assert.equal(evidence.schema_version, 1);
  assert.equal(evidence.target_url, "https://staging.nutsnews.com");
  assert.equal(evidence.target_type, "vps-staging");
  assert.equal(evidence.source_commit, "a".repeat(40));
  assert.equal(evidence.build_id, "123-1");
  assert.equal(evidence.deployment_id, "stg-abc123");
  assert.equal(evidence.result, "pass");
  assert.equal(evidence.artifact_name, "nutsnews-ui-smoke-vps-staging-pr-42-attempt-1");
  assert.deepEqual(evidence.artifact_paths, {
    junit: "web/test-results/deployed-ui-smoke/results.junit.xml",
    html_report: "web/playwright-report",
    trace_on_failure: "web/test-results/deployed-ui-smoke",
    test_results: "web/test-results/deployed-ui-smoke",
    evidence_json: "web/test-results/deployed-ui-smoke/evidence.json",
  });
  assert.equal(JSON.stringify(evidence).includes("CF-Access-Client-Secret"), false);
  assert.equal(JSON.stringify(evidence).includes("x-vercel-protection-bypass"), false);
});

test("deployed UI smoke evidence can fall back to run ID when no PR is present", () => {
  const evidence = buildUiSmokeEvidence(
    {
      ...baseEnv,
      NUTSNEWS_UI_SMOKE_PR_NUMBER: "",
    },
    "fail",
  );
  assert.equal(evidence.artifact_name, "nutsnews-ui-smoke-vps-staging-run-123-attempt-1");
  assert.equal(evidence.pr_number, null);
  assert.equal(evidence.result, "fail");
});

test("deployed UI smoke evidence fails closed when required fields are missing", () => {
  assert.throws(
    () => buildUiSmokeEvidence({ ...baseEnv, NUTSNEWS_UI_SMOKE_TARGET_TYPE: "" }, "pass"),
    /NUTSNEWS_UI_SMOKE_TARGET_TYPE/,
  );
});

test("uploaded UI smoke artifacts are sanitized before retention", async () => {
  const reportPath = path.join(process.cwd(), "web/playwright-report/auth.html");
  const resultPath = path.join(process.cwd(), "web/test-results/deployed-ui-smoke/auth.xml");
  const binaryPath = path.join(process.cwd(), "web/test-results/deployed-ui-smoke/auth.bin");

  await rm(path.join(process.cwd(), "web/playwright-report"), { recursive: true, force: true });
  await rm(path.join(process.cwd(), "web/test-results/deployed-ui-smoke"), { recursive: true, force: true });
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(resultPath), { recursive: true });

  try {
    await writeFile(reportPath, "CF-Access-Client-Secret secret-value", { encoding: "utf8", flag: "w" });
    await writeFile(resultPath, "<xml>x-vercel-protection-bypass vercel-secret</xml>", {
      encoding: "utf8",
      flag: "w",
    });
    await writeFile(binaryPath, Buffer.from("vercel-secret"));

    const sanitization = sanitizeUploadedArtifacts({
      CF_ACCESS_CLIENT_SECRET: "secret-value",
      VERCEL_AUTOMATION_BYPASS_SECRET: "vercel-secret",
    });

    assert.equal(sanitization.length, 3);
    assert.match(await readFile(reportPath, "utf8"), /\[redacted-protected-target-auth\]/);
    assert.match(await readFile(resultPath, "utf8"), /\[redacted-protected-target-auth\]/);
    await assert.rejects(() => readFile(binaryPath), /ENOENT/);
  } finally {
    await rm(path.join(process.cwd(), "web/playwright-report"), { recursive: true, force: true });
    await rm(path.join(process.cwd(), "web/test-results/deployed-ui-smoke"), { recursive: true, force: true });
  }
});
