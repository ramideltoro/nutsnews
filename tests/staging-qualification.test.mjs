import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { execFileSync } from "node:child_process";

import { assertFixtureTargetMatchesRuntime, assertRequiredPlaywrightReport, deploymentSmokeEnvironment, qualificationPasses, redact, runQualification, sanitizePlaywrightArtifacts } from "../scripts/staging_qualification.mjs";

const commit = "a".repeat(40);
const digest = `sha256:${"b".repeat(64)}`;
const deploymentId = `stg-${"c".repeat(24)}`;
const configGeneration = `staging-${deploymentId}-dddddddddddd`;

function input(artifactDir) {
  return {
    baseUrl: "https://staging.nutsnews.com/",
    expectedSourceCommit: commit,
    expectedBuildId: "123456789-1",
    expectedImageDigest: digest,
    expectedRuntimeEnv: "staging",
    expectedDeploymentTarget: "vps-staging",
    expectedConfigGeneration: configGeneration,
    stagingDeploymentId: deploymentId,
    suiteRevision: "e".repeat(40),
    artifactDir,
    timeoutMs: 5_000,
  };
}

function headers(values = {}) {
  return new Headers({ "content-type": "application/json", ...values });
}

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload), { status: init.status ?? 200, headers: headers(init.headers) });
}

function mockFetch() {
  return async (value, init = {}) => {
    const url = new URL(value);
    if (url.hostname === "api.github.com" && url.pathname.endsWith("/deployments")) {
      return json([{ id: 99, sha: "f".repeat(40), environment: "staging", production_environment: false, transient_environment: true, task: "nutsnews-staging-deploy", statuses_url: "https://api.github.com/statuses/99", payload: { deployment_id: deploymentId, source_commit: commit, build_id: "123456789-1", requested_digest: digest, config_generation: configGeneration } }]);
    }
    if (url.hostname === "api.github.com" && url.pathname === "/statuses/99") return json([{ state: "success", description: `candidate actual=${digest}` }]);
    const protectedRequest = new Headers(init.headers).has("cf-access-client-secret");
    if (!protectedRequest && url.pathname === "/") return new Response("", { status: 302, headers: { location: "https://example.cloudflareaccess.com/cdn-cgi/access/login" } });
    const security = { "content-security-policy": "default-src 'self'", "referrer-policy": "same-origin", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "x-robots-tag": "noindex, nofollow" };
    if (url.pathname === "/healthz") return json({ ok: true }, { headers: { ...security, "x-nutsnews-source-commit": commit, "x-nutsnews-build-id": "123456789-1", "x-nutsnews-deployment-target": "vps-staging" } });
    if (url.pathname === "/readyz") return json({ ok: true, code: "ready" }, { headers: { ...security, "cache-control": "no-store", "x-nutsnews-source-commit": commit, "x-nutsnews-build-id": "123456789-1", "x-nutsnews-deployment-target": "vps-staging", "x-nutsnews-runtime-environment": "staging", "x-nutsnews-config-generation": configGeneration, "x-nutsnews-expected-image-digest": digest } });
    if (url.pathname === "/api/runtime-config") return json({ sourceCommit: commit, buildId: "123456789-1", expectedImageDigest: digest, runtimeEnv: "staging", deploymentTarget: "vps-staging", configGeneration, sideEffectsMode: "disabled", telemetryEnabled: false, supabaseUrl: "https://staging-fixture.supabase.co" }, { headers: { "cache-control": "no-store" } });
    if (url.pathname === "/") return new Response('<html><body>NutsNews<footer><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a></footer><script src="/_next/static/test.js"></script></body></html>', { status: 200, headers: { "content-type": "text/html", ...security } });
    if (url.pathname === "/_next/static/test.js") return new Response("ok", { status: 200 });
    if (url.pathname === "/api/articles") return json({ articles: [{ id: "synthetic-article", source: "nutsnews-test-deterministic-177" }], nextPage: null }, { headers: { "cache-control": "public, s-maxage=60" } });
    if (url.pathname === "/search") return new Response("not found", { status: 404, headers: security });
    if (url.pathname === "/admin") return new Response("", { status: 307, headers: { location: "/admin/login" } });
    if (url.pathname === "/api/contact" && init.method === "POST") return json({ error: "disabled" }, { status: 503, headers: { "cache-control": "no-store" } });
    if (url.pathname === "/api/auth/session") return json(null, { headers: { "cache-control": "no-store" } });
    if (["/api/home-feed", "/api/search", "/api/auth/providers", "/api/auth/csrf"].includes(url.pathname)) return json({ ok: true }, { headers: { "cache-control": url.pathname.includes("auth/") ? "no-store" : "public, s-maxage=60" } });
    return new Response("ok", { status: 200, headers: security });
  };
}

async function fixtureRun(overrides = {}) {
  const artifactDir = await mkdtemp(path.join(os.tmpdir(), "nutsnews-qualification-"));
  const events = [];
  const report = await runQualification(input(artifactDir), {
    env: { CF_ACCESS_CLIENT_ID: "client-id-secret", CF_ACCESS_CLIENT_SECRET: "client-secret-value" },
    fetchImpl: mockFetch(),
    runDeploymentSmoke: async () => ({ reused: true }),
    seedFixture: async (namespace) => { events.push(`seed:${namespace}`); return { synthetic: true }; },
    cleanupFixture: async (namespace) => { events.push(`cleanup:${namespace}`); },
    runBrowser: async () => ({ artifacts: "retained" }),
    fixtureNamespace: "nutsnews-test-deterministic-177",
    ...overrides,
  });
  return { artifactDir, events, report };
}

test("deterministic local fixture qualification passes and retains JSON/JUnit", async () => {
  const run = await fixtureRun();
  try {
    assert.equal(run.report.result, "pass");
    assert.deepEqual(run.events, ["seed:nutsnews-test-deterministic-177", "cleanup:nutsnews-test-deterministic-177"]);
    assert.match(await readFile(path.join(run.artifactDir, "staging-qualification.json"), "utf8"), /"suiteRevision"/);
    assert.match(await readFile(path.join(run.artifactDir, "staging-qualification.junit.xml"), "utf8"), /testsuite/);
  } finally { await rm(run.artifactDir, { recursive: true, force: true }); }
});

test("production-looking target is rejected before request or mutation", async () => {
  let touched = false;
  await assert.rejects(
    runQualification({ ...input("unused"), baseUrl: "https://www.nutsnews.com/" }, {
      fetchImpl: async () => { touched = true; throw new Error("must not fetch"); },
      seedFixture: async () => { touched = true; },
    }),
    /before outbound request or mutation/,
  );
  assert.equal(touched, false);
});

test("fixture database target must exactly match the verified staging runtime", () => {
  assert.equal(
    assertFixtureTargetMatchesRuntime("https://staging-fixture.supabase.co/", "https://staging-fixture.supabase.co"),
    "https://staging-fixture.supabase.co",
  );
  for (const candidate of [
    "https://production-fixture.supabase.co",
    "http://staging-fixture.supabase.co",
    "https://user:password@staging-fixture.supabase.co",
    "not-a-url",
  ]) {
    assert.throws(() => assertFixtureTargetMatchesRuntime(candidate, "https://staging-fixture.supabase.co"), /SAFETY/);
  }
});

test("deployment smoke qualifies health and readiness on the staging runtime target", () => {
  const smokeEnv = deploymentSmokeEnvironment(input("unused"), { EXISTING_VALUE: "preserved" });

  assert.equal(smokeEnv.EXISTING_VALUE, "preserved");
  assert.equal(smokeEnv.NUTSNEWS_EXPECTED_DEPLOYMENT_TARGET, "vps-staging");
  assert.equal(smokeEnv.NUTSNEWS_EXPECTED_HEALTH_DEPLOYMENT_TARGET, "vps-staging");
});

test("anonymous auth session must be null", async () => {
  const base = mockFetch();
  const run = await fixtureRun({
    fetchImpl: async (url, init) => {
      if (new URL(url).pathname === "/api/auth/session") {
        return json({ user: { id: "unexpected-session" } }, { headers: { "cache-control": "no-store" } });
      }
      return base(url, init);
    },
  });
  try {
    assert.equal(run.report.result, "fail");
    assert.equal(run.report.originalFailure, "anonymous auth session must be null");
  } finally {
    await rm(run.artifactDir, { recursive: true, force: true });
  }
});

test("deployed source, build, digest, runtime, config, and deployment mismatches stop before mutation", async () => {
  const cases = [
    ["source", async (url, init, base) => {
      const response = await base(url, init);
      if (new URL(url).pathname !== "/healthz") return response;
      const changed = new Headers(response.headers); changed.set("x-nutsnews-source-commit", "f".repeat(40));
      return new Response(await response.text(), { status: response.status, headers: changed });
    }],
    ["build", async (url, init, base) => {
      const response = await base(url, init);
      if (new URL(url).pathname !== "/healthz") return response;
      const changed = new Headers(response.headers); changed.set("x-nutsnews-build-id", "different-build-1");
      return new Response(await response.text(), { status: response.status, headers: changed });
    }],
    ["digest", async (url, init, base) => {
      const response = await base(url, init);
      if (new URL(url).pathname !== "/readyz") return response;
      const changed = new Headers(response.headers); changed.set("x-nutsnews-expected-image-digest", `sha256:${"f".repeat(64)}`);
      return new Response(await response.text(), { status: response.status, headers: changed });
    }],
    ["runtime", async (url, init, base) => {
      const response = await base(url, init);
      if (new URL(url).pathname !== "/readyz") return response;
      const changed = new Headers(response.headers); changed.set("x-nutsnews-runtime-environment", "production");
      return new Response(await response.text(), { status: response.status, headers: changed });
    }],
    ["config", async (url, init, base) => {
      const response = await base(url, init);
      if (new URL(url).pathname !== "/readyz") return response;
      const changed = new Headers(response.headers); changed.set("x-nutsnews-config-generation", "different-generation");
      return new Response(await response.text(), { status: response.status, headers: changed });
    }],
    ["deployment", async (url, init, base) => {
      const response = await base(url, init);
      if (!new URL(url).pathname.endsWith("/deployments")) return response;
      const payload = await response.json(); payload[0].payload.deployment_id = `stg-${"f".repeat(24)}`;
      return json(payload);
    }],
  ];

  for (const [name, mutate] of cases) {
    const base = mockFetch();
    const run = await fixtureRun({ fetchImpl: (url, init) => mutate(url, init, base) });
    try {
      assert.equal(run.report.result, "fail", `${name} mismatch must fail`);
      assert.equal(run.events.length, 0, `${name} mismatch must stop before fixture mutation`);
    } finally { await rm(run.artifactDir, { recursive: true, force: true }); }
  }
});

test("controlled Playwright failure retains evidence, artifact pointer, and original failure", async () => {
  let failureArtifact;
  const run = await fixtureRun({ runBrowser: async (qualificationInput) => {
    failureArtifact = path.join(qualificationInput.artifactDir, "playwright", "trace.zip");
    await mkdir(path.dirname(failureArtifact), { recursive: true });
    await writeFile(failureArtifact, "synthetic retained failure trace");
    throw new Error("Playwright failed; failure artifacts retained at trace.zip");
  } });
  try {
    assert.equal(run.report.result, "fail");
    assert.match(run.report.originalFailure, /Playwright failed/);
    assert.equal(run.report.cleanupFailure, null);
    assert.match(await readFile(path.join(run.artifactDir, "staging-qualification.json"), "utf8"), /trace\.zip/);
    assert.match(await readFile(path.join(run.artifactDir, "staging-qualification.junit.xml"), "utf8"), /failure/);
    assert.equal(await readFile(failureArtifact, "utf8"), "synthetic retained failure trace");
  } finally { await rm(run.artifactDir, { recursive: true, force: true }); }
});

test("cleanup failure is separate, preserves original failure, and is non-passing", async () => {
  const run = await fixtureRun({ runBrowser: async () => { throw new Error("original browser failure"); }, cleanupFixture: async () => { throw new Error("synthetic cleanup failure"); } });
  try {
    assert.equal(run.report.result, "fail");
    assert.equal(run.report.originalFailure, "original browser failure");
    assert.equal(run.report.cleanupFailure, "synthetic cleanup failure");
  } finally { await rm(run.artifactDir, { recursive: true, force: true }); }
});

test("required skip, timeout, and cancellation are non-passing", async () => {
  for (const status of ["skip", "timeout", "cancelled"]) assert.equal(qualificationPasses([{ required: true, status }]), false);
  assert.equal(qualificationPasses([{ required: true, status: "pass" }]), true);
  assert.equal(qualificationPasses([{ required: false, status: "pass" }]), false);

  for (const [expectedStatus, error] of [
    ["skip", Object.assign(new Error("required browser skip"), { code: "REQUIRED_SKIP" })],
    ["timeout", Object.assign(new Error("required browser timeout"), { name: "TimeoutError" })],
    ["cancelled", Object.assign(new Error("required browser cancellation"), { name: "AbortError" })],
  ]) {
    const run = await fixtureRun({ runBrowser: async () => { throw error; } });
    try {
      assert.equal(run.report.result, "fail");
      assert.equal(run.report.results.find((result) => result.name === "bounded-chromium-accessibility")?.status, expectedStatus);
      assert.equal(run.report.results.at(-1)?.name, "unconditional-fixture-cleanup");
      assert.equal(run.report.results.at(-1)?.status, "pass");
    } finally { await rm(run.artifactDir, { recursive: true, force: true }); }
  }
});

test("redaction removes headers, tokens, credentials, and supplied secret values", () => {
  const serialized = JSON.stringify(redact({ Authorization: "Bearer oauth-value", cookie: "session=value", message: "CF-Access-Client-Secret: access-secret csrfToken=csrf-value service_role_key=db-secret custom exact-value", responseBody: "sensitive" }, ["exact-value"]));
  for (const secret of ["oauth-value", "session=value", "access-secret", "csrf-value", "db-secret", "exact-value", "sensitive"]) assert.doesNotMatch(serialized, new RegExp(secret));
  assert.match(serialized, /REDACTED/);
});

test("Playwright reports and retained trace archives are redacted in place", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nutsnews-playwright-redaction-"));
  const traceSource = path.join(directory, "trace-source");
  const traceArchive = path.join(directory, "trace.zip");
  const clientSecret = "cloudflare-client-secret-value";
  try {
    await mkdir(traceSource);
    await writeFile(path.join(directory, "results.junit.xml"), `<system-out>CF-Access-Client-Secret: ${clientSecret}</system-out>`);
    await writeFile(path.join(traceSource, "trace.network"), `${JSON.stringify({ name: "cookie", value: "sensitive-session-cookie" })}\n${JSON.stringify({ name: "cf-access-client-secret", value: clientSecret })}\n${JSON.stringify({ csrfToken: "sensitive-csrf-value" })}\n`);
    execFileSync("zip", ["-q", "-r", traceArchive, "."], { cwd: traceSource });
    await rm(traceSource, { recursive: true, force: true });

    await sanitizePlaywrightArtifacts(directory, [clientSecret]);

    const report = await readFile(path.join(directory, "results.junit.xml"), "utf8");
    const trace = execFileSync("unzip", ["-p", traceArchive, "trace.network"], { encoding: "utf8" });
    for (const secret of [clientSecret, "sensitive-session-cookie", "sensitive-csrf-value"]) {
      assert.doesNotMatch(`${report}\n${trace}`, new RegExp(secret));
    }
    assert.match(`${report}\n${trace}`, /REDACTED/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("fresh Playwright JUnit evidence rejects missing, empty, skipped, and failed required tests", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nutsnews-playwright-junit-"));
  try {
    const report = path.join(directory, "results.junit.xml");
    await assert.rejects(assertRequiredPlaywrightReport(report), /missing/);
    for (const [xml, pattern] of [
      ['<testsuite tests="0" failures="0" skipped="0"></testsuite>', /tests=0/],
      ['<testsuite tests="1" failures="0" skipped="1"><testcase><skipped/></testcase></testsuite>', /skipped=1/],
      ['<testsuite tests="1" failures="1" skipped="0"><testcase><failure/></testcase></testsuite>', /failures=1/],
    ]) {
      await writeFile(report, xml);
      await assert.rejects(assertRequiredPlaywrightReport(report), pattern);
    }
    await writeFile(report, '<testsuite tests="1" failures="0" skipped="0"><testcase name="bounded"/></testsuite>');
    assert.deepEqual(await assertRequiredPlaywrightReport(report), { tests: 1, failures: 0, skipped: 0 });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
