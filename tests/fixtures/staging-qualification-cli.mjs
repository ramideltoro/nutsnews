#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { runQualification } from "../../scripts/staging_qualification.mjs";

const scenario = process.argv[2] ?? "positive";
const artifactDir = process.argv[3];
if (!artifactDir) throw new Error("artifact directory argument is required");

const commit = "a".repeat(40);
const digest = `sha256:${"b".repeat(64)}`;
const deploymentId = `stg-${"c".repeat(24)}`;
const configGeneration = `staging-${deploymentId}-dddddddddddd`;
let mutations = 0;

const security = {
  "content-security-policy": "default-src 'self'",
  "referrer-policy": "same-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex, nofollow",
};

function json(payload, extraHeaders = {}, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

async function fetchFixture(value, init = {}) {
  const url = new URL(value);
  if (url.hostname === "api.github.com" && url.pathname.endsWith("/deployments")) {
    return json([{ id: 99, sha: "f".repeat(40), environment: "staging", production_environment: false, transient_environment: true, task: "nutsnews-staging-deploy", statuses_url: "https://api.github.com/statuses/99", payload: { deployment_id: deploymentId, source_commit: commit, build_id: "123456789-1", requested_digest: digest, config_generation: configGeneration } }]);
  }
  if (url.hostname === "api.github.com") return json([{ state: "success", description: `actual=${digest}` }]);
  if (!new Headers(init.headers).has("cf-access-client-secret") && url.pathname === "/") {
    return new Response("", { status: 302, headers: { location: "https://fixture.cloudflareaccess.com/login" } });
  }
  if (url.pathname === "/healthz") return json({ ok: true }, { ...security, "x-nutsnews-source-commit": commit, "x-nutsnews-build-id": "123456789-1", "x-nutsnews-deployment-target": "vps" });
  if (url.pathname === "/readyz") return json({ ok: true, code: "ready" }, { ...security, "cache-control": "no-store", "x-nutsnews-expected-image-digest": digest, "x-nutsnews-runtime-environment": "staging", "x-nutsnews-deployment-target": "vps-staging", "x-nutsnews-config-generation": configGeneration });
  if (url.pathname === "/api/runtime-config") return json({ sourceCommit: commit, buildId: "123456789-1", expectedImageDigest: digest, runtimeEnv: "staging", deploymentTarget: "vps-staging", configGeneration, sideEffectsMode: "disabled", telemetryEnabled: false, supabaseUrl: "https://staging-fixture.supabase.co" }, { "cache-control": "no-store" });
  if (url.pathname === "/") return new Response('<title>NutsNews</title><footer><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a></footer><script src="/_next/static/test.js"></script>', { status: 200, headers: security });
  if (url.pathname === "/api/articles") return json({ articles: [{ id: "synthetic", source: "nutsnews-test-cli-fixture-177" }] }, { "cache-control": "public" });
  if (url.pathname === "/search") return new Response("not found", { status: 404, headers: security });
  if (url.pathname === "/admin") return new Response("", { status: 307, headers: { location: "/admin/login" } });
  if (url.pathname === "/api/contact" && init.method === "POST") return json({ error: "disabled" }, { "cache-control": "no-store" }, 503);
  if (url.pathname === "/api/auth/session") return json(null, { "cache-control": "no-store" });
  if (["/api/home-feed", "/api/search", "/api/auth/providers", "/api/auth/csrf"].includes(url.pathname)) return json({ ok: true }, { "cache-control": url.pathname.includes("auth/") ? "no-store" : "public" });
  return new Response("ok", { status: 200, headers: security });
}

const input = {
  baseUrl: scenario === "production-host" ? "https://www.nutsnews.com/" : "https://staging.nutsnews.com/",
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

let report;
try {
  report = await runQualification(input, {
    env: { CF_ACCESS_CLIENT_ID: "fixture-client-id", CF_ACCESS_CLIENT_SECRET: "fixture-client-secret" },
    fetchImpl: async (...args) => {
      if (scenario === "production-host") throw new Error("outbound request occurred");
      return fetchFixture(...args);
    },
    runDeploymentSmoke: async () => ({ reused: true }),
    seedFixture: async () => { mutations += 1; },
    cleanupFixture: async () => {
      mutations -= 1;
      if (scenario === "cleanup-failure") throw new Error("controlled cleanup failure");
    },
    fixtureNamespace: "nutsnews-test-cli-fixture-177",
    runBrowser: async () => {
      if (scenario === "browser-failure") {
        const trace = path.join(artifactDir, "playwright", "trace.zip");
        await mkdir(path.dirname(trace), { recursive: true });
        await writeFile(trace, "retained controlled failure trace");
        throw new Error(`controlled browser failure; artifact retained at ${trace}`);
      }
      if (scenario === "skip") throw Object.assign(new Error("controlled required skip"), { code: "REQUIRED_SKIP" });
      if (scenario === "timeout") throw Object.assign(new Error("controlled required timeout"), { name: "TimeoutError" });
      if (scenario === "cancel") throw Object.assign(new Error("controlled required cancellation"), { name: "AbortError" });
      return { chromium: "pass" };
    },
  });
} catch (error) {
  if (scenario !== "production-host" || mutations !== 0) throw error;
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

if (report) {
  console.log(JSON.stringify({ result: report.result, originalFailure: report.originalFailure, cleanupFailure: report.cleanupFailure, mutations, artifactDir }));
  process.exitCode = report.result === "pass" ? 0 : 1;
}
