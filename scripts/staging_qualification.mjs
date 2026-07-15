#!/usr/bin/env node

import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createFixtureNamespace,
  getFixtureExpiry,
  resetStagingFixture,
  seedStagingFixture,
} from "./staging_fixtures.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(repoRoot, "web");
const DEFAULT_TIMEOUT_MS = 30_000;
const IDENTITY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{2,127}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const DEPLOYMENT_ID_PATTERN = /^stg-[a-f0-9]{20,64}$/;
const PRODUCTION_HOSTS = new Set(["nutsnews.com", "www.nutsnews.com"]);
const SENSITIVE_KEY_PATTERN = /(?:authorization|cookie|csrf|token|secret|password|credential|service.?role|api.?key|response.?body)/i;
const SENSITIVE_TEXT_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /(?:CF-Access-Client-(?:Id|Secret)|Authorization|Cookie|Set-Cookie|X-CSRF-Token)\s*[:=]\s*[^\s,;]+/gi,
  /(?:access_token|refresh_token|csrfToken|oauth_token|client_secret|service_role_key)\s*[=:]\s*["']?[^\s,"'}]+/gi,
  /("name"\s*:\s*"(?:cookie|set-cookie|authorization|cf-access-client-id|cf-access-client-secret|x-csrf-token)"\s*,\s*"value"\s*:\s*")[^"]*/gi,
  /("(?:csrfToken|access_token|refresh_token|oauth_token|client_secret|service_role_key|password)"\s*:\s*")[^"]*/gi,
];

function option(argv, name, env, envName) {
  const index = argv.indexOf(name);
  if (index >= 0) {
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
    return value.trim();
  }
  return String(env[envName] ?? "").trim();
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required`);
  return value;
}

function safeRevision() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function parseQualificationInput(argv = process.argv.slice(2), env = process.env) {
  return {
    baseUrl: required(option(argv, "--base-url", env, "NUTSNEWS_QUALIFICATION_BASE_URL"), "base URL"),
    expectedSourceCommit: required(option(argv, "--expected-source-commit", env, "NUTSNEWS_EXPECTED_SOURCE_COMMIT"), "expected source commit"),
    expectedBuildId: required(option(argv, "--expected-build-id", env, "NUTSNEWS_EXPECTED_BUILD_ID"), "expected build ID"),
    expectedImageDigest: required(option(argv, "--expected-image-digest", env, "NUTSNEWS_EXPECTED_IMAGE_DIGEST"), "expected image digest"),
    expectedRuntimeEnv: required(option(argv, "--expected-runtime-env", env, "NUTSNEWS_EXPECTED_RUNTIME_ENV"), "expected runtime environment"),
    expectedDeploymentTarget: required(option(argv, "--expected-deployment-target", env, "NUTSNEWS_EXPECTED_DEPLOYMENT_TARGET"), "expected deployment target"),
    expectedConfigGeneration: required(option(argv, "--expected-config-generation", env, "NUTSNEWS_EXPECTED_CONFIG_GENERATION"), "expected config generation"),
    stagingDeploymentId: required(option(argv, "--staging-deployment-id", env, "NUTSNEWS_STAGING_DEPLOYMENT_ID"), "staging deployment ID"),
    suiteRevision: option(argv, "--suite-revision", env, "NUTSNEWS_QUALIFICATION_SUITE_REVISION") || safeRevision(),
    artifactDir: option(argv, "--artifact-dir", env, "NUTSNEWS_QUALIFICATION_ARTIFACT_DIR") || path.join(webDir, "test-results", "staging-qualification"),
    timeoutMs: Number(option(argv, "--timeout-ms", env, "NUTSNEWS_QUALIFICATION_TIMEOUT_MS") || DEFAULT_TIMEOUT_MS),
  };
}

export function validateQualificationInput(input) {
  let url;
  try {
    url = new URL(input.baseUrl);
  } catch {
    throw new Error("SAFETY: base URL is malformed");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (PRODUCTION_HOSTS.has(hostname) || hostname.endsWith(".nutsnews.com") && hostname !== "staging.nutsnews.com") {
    throw new Error("SAFETY: production-looking hostname rejected before outbound request or mutation");
  }
  if (url.protocol !== "https:" || hostname !== "staging.nutsnews.com" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SAFETY: target must be the unambiguous https://staging.nutsnews.com/ origin");
  }
  if (!COMMIT_PATTERN.test(input.expectedSourceCommit) || !COMMIT_PATTERN.test(input.suiteRevision)) {
    throw new Error("SAFETY: source and suite revisions must be full lowercase Git commits");
  }
  if (!IDENTITY_PATTERN.test(input.expectedBuildId) || !IDENTITY_PATTERN.test(input.expectedConfigGeneration)) {
    throw new Error("SAFETY: build ID and config generation must be complete safe identities");
  }
  if (!DIGEST_PATTERN.test(input.expectedImageDigest)) throw new Error("SAFETY: image digest must be immutable sha256:<64 lowercase hex>");
  if (input.expectedRuntimeEnv !== "staging" || input.expectedDeploymentTarget !== "vps-staging") {
    throw new Error("SAFETY: runtime identity must be exactly staging/vps-staging");
  }
  if (!DEPLOYMENT_ID_PATTERN.test(input.stagingDeploymentId)) throw new Error("SAFETY: staging deployment ID is malformed");
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1_000 || input.timeoutMs > 120_000) {
    throw new Error("SAFETY: timeout must be an integer from 1000 through 120000 milliseconds");
  }
  return { ...input, baseUrl: url.toString() };
}

export function redact(value, secrets = []) {
  const secretValues = secrets.filter((item) => typeof item === "string" && item.length >= 4);
  const visit = (item, key = "") => {
    if (SENSITIVE_KEY_PATTERN.test(key)) return "[REDACTED]";
    if (typeof item === "string") {
      let output = item;
      for (const secret of secretValues) output = output.split(secret).join("[REDACTED]");
      for (const pattern of SENSITIVE_TEXT_PATTERNS) {
        output = output.replace(pattern, (_match, prefix) => prefix ? `${prefix}[REDACTED]` : "[REDACTED]");
      }
      return output.slice(0, 2_000);
    }
    if (Array.isArray(item)) return item.map((entry) => visit(entry));
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([name, entry]) => [name, visit(entry, name)]));
    return item;
  };
  return visit(value);
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(location) : [location];
  }));
  return nested.flat();
}

async function redactTextFiles(directory, secrets) {
  for (const location of await filesUnder(directory)) {
    if (location.endsWith(".zip")) continue;
    const buffer = await readFile(location);
    if (buffer.includes(0)) continue;
    const text = buffer.toString("utf8");
    const safe = redact(text, secrets);
    if (safe !== text) await writeFile(location, safe);
  }
}

export async function sanitizePlaywrightArtifacts(directory, secrets = []) {
  await mkdir(directory, { recursive: true });
  const traceArchives = (await filesUnder(directory)).filter((location) => location.endsWith(".zip"));
  for (const archive of traceArchives) {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "nutsnews-trace-redaction-"));
    try {
      execFileSync("unzip", ["-q", archive, "-d", temporary], { stdio: "ignore" });
      await redactTextFiles(temporary, secrets);
      await rm(archive, { force: true });
      execFileSync("zip", ["-q", "-r", archive, "."], { cwd: temporary, stdio: "ignore" });
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
  await redactTextFiles(directory, secrets);
}

export async function assertRequiredPlaywrightReport(reportFile) {
  let report;
  try {
    report = await readFile(reportFile, "utf8");
  } catch {
    throw new Error("Required Playwright JUnit evidence is missing");
  }
  const root = report.match(/<(?:testsuite|testsuites)\b[^>]*>/)?.[0] ?? "";
  const count = (name) => Number(root.match(new RegExp(`\\b${name}="(\\d+)"`))?.[1] ?? "0");
  const tests = count("tests");
  const failures = count("failures") + count("errors");
  const skipped = count("skipped");
  if (tests < 1 || failures > 0 || skipped > 0 || /<(?:failure|error|skipped)\b/.test(report)) {
    throw new Error(`Required Playwright report is non-passing: tests=${tests} failures=${failures} skipped=${skipped}`);
  }
  return { tests, failures, skipped };
}

function accessHeaders(env) {
  const clientId = String(env.CF_ACCESS_CLIENT_ID ?? "").trim();
  const clientSecret = String(env.CF_ACCESS_CLIENT_SECRET ?? "").trim();
  if (!clientId || !clientSecret) throw new Error("Cloudflare Access service-token ID and secret are both required");
  return { "CF-Access-Client-Id": clientId, "CF-Access-Client-Secret": clientSecret };
}

async function boundedFetch(fetchImpl, url, init, timeoutMs, signal) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return fetchImpl(url, { ...init, signal: signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal });
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} mismatch: expected ${expected}, received ${actual ?? "missing"}`);
}

async function responseJson(response, label) {
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error(`${label} did not return JSON`);
  return response.json();
}

export async function verifyAccessAndIdentity({ input, fetchImpl = fetch, env = process.env, signal }) {
  const anonymous = await boundedFetch(fetchImpl, input.baseUrl, { redirect: "manual" }, input.timeoutMs, signal);
  const anonymousLocation = anonymous.headers.get("location") ?? "";
  if (![301, 302, 303, 307, 308, 401, 403].includes(anonymous.status) || (anonymous.status < 400 && !/cloudflareaccess\.com/i.test(anonymousLocation))) {
    throw new Error("Cloudflare Access boundary did not deny or redirect an anonymous request");
  }

  const headers = { Accept: "application/json", ...accessHeaders(env) };
  const [healthResponse, readyResponse, configResponse] = await Promise.all([
    boundedFetch(fetchImpl, new URL("healthz", input.baseUrl), { headers }, input.timeoutMs, signal),
    boundedFetch(fetchImpl, new URL(`readyz?cache-bust=${encodeURIComponent(input.expectedConfigGeneration)}`, input.baseUrl), { headers, cache: "no-store" }, input.timeoutMs, signal),
    boundedFetch(fetchImpl, new URL("api/runtime-config", input.baseUrl), { headers, cache: "no-store" }, input.timeoutMs, signal),
  ]);
  const health = await responseJson(healthResponse, "/healthz");
  const ready = await responseJson(readyResponse, "/readyz");
  const config = await responseJson(configResponse, "/api/runtime-config");
  if (health.ok !== true || ready.ok !== true || ready.code !== "ready") throw new Error("Deployed candidate is not healthy and ready");
  if (!/no-store/.test(readyResponse.headers.get("cache-control") ?? "")) throw new Error("/readyz must be uncached");
  const identity = {
    sourceCommit: healthResponse.headers.get("x-nutsnews-source-commit"),
    buildId: healthResponse.headers.get("x-nutsnews-build-id"),
    imageDigest: readyResponse.headers.get("x-nutsnews-expected-image-digest"),
    runtimeEnv: readyResponse.headers.get("x-nutsnews-runtime-environment"),
    deploymentTarget: readyResponse.headers.get("x-nutsnews-deployment-target"),
    configGeneration: readyResponse.headers.get("x-nutsnews-config-generation"),
  };
  expectEqual(identity.sourceCommit, input.expectedSourceCommit, "source commit");
  expectEqual(identity.buildId, input.expectedBuildId, "build ID");
  expectEqual(identity.imageDigest, input.expectedImageDigest, "image digest");
  expectEqual(identity.runtimeEnv, input.expectedRuntimeEnv, "runtime environment");
  expectEqual(identity.deploymentTarget, input.expectedDeploymentTarget, "deployment target");
  expectEqual(identity.configGeneration, input.expectedConfigGeneration, "config generation");
  expectEqual(config.sourceCommit, input.expectedSourceCommit, "runtime-config source commit");
  expectEqual(config.buildId, input.expectedBuildId, "runtime-config build ID");
  expectEqual(config.expectedImageDigest, input.expectedImageDigest, "runtime-config image digest");
  expectEqual(config.runtimeEnv, "staging", "runtime-config environment");
  expectEqual(config.deploymentTarget, "vps-staging", "runtime-config target");
  expectEqual(config.configGeneration, input.expectedConfigGeneration, "runtime-config generation");
  if (config.sideEffectsMode !== "disabled") throw new Error("This non-destructive qualification profile requires staging side effects to be disabled");
  if (config.telemetryEnabled !== false) throw new Error("Production telemetry must be disabled in staging");
  return { identity, sideEffectsMode: config.sideEffectsMode };
}

export async function verifyGitHubDeployment({ input, fetchImpl = fetch, env = process.env, signal }) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const githubToken = String(env.GITHUB_TOKEN ?? env.GH_TOKEN ?? "").trim();
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  const listUrl = new URL("https://api.github.com/repos/ramideltoro/nutsnews-infra/deployments?environment=staging&per_page=100");
  const response = await boundedFetch(fetchImpl, listUrl, { headers }, input.timeoutMs, signal);
  const deployments = await responseJson(response, "GitHub staging deployments");
  const deployment = deployments.find((item) => item?.payload?.deployment_id === input.stagingDeploymentId);
  if (!deployment) throw new Error("Staging deployment ID was not found in the canonical GitHub deployment history");
  if (deployment.environment !== "staging" || deployment.production_environment !== false || deployment.transient_environment !== true || deployment.task !== "nutsnews-staging-deploy") {
    throw new Error("GitHub deployment is not an isolated non-production staging deployment");
  }
  const expected = {
    source_commit: input.expectedSourceCommit,
    build_id: input.expectedBuildId,
    requested_digest: input.expectedImageDigest,
    config_generation: input.expectedConfigGeneration,
    deployment_id: input.stagingDeploymentId,
  };
  for (const [key, value] of Object.entries(expected)) expectEqual(deployment.payload?.[key], value, `GitHub deployment ${key}`);
  const statusesResponse = await boundedFetch(fetchImpl, deployment.statuses_url, { headers }, input.timeoutMs, signal);
  const statuses = await responseJson(statusesResponse, "GitHub staging deployment statuses");
  const success = statuses.find((status) => status.state === "success");
  if (!success || !String(success.description ?? "").includes(`actual=${input.expectedImageDigest}`)) {
    throw new Error("GitHub deployment does not have a successful exact-digest status");
  }
  return { githubDeploymentDatabaseId: deployment.id, infraCommit: deployment.sha, status: "success" };
}

function assertSecurityHeaders(response, label) {
  for (const header of ["content-security-policy", "referrer-policy", "x-content-type-options", "x-frame-options", "x-robots-tag"]) {
    if (!response.headers.get(header)) throw new Error(`${label} missing ${header}`);
  }
}

export async function runHttpQualification({ input, fixtureNamespace, fetchImpl = fetch, env = process.env, signal }) {
  const headers = { Accept: "application/json, text/html;q=0.9, */*;q=0.8", ...accessHeaders(env) };
  const get = (pathname, init = {}) => boundedFetch(fetchImpl, new URL(pathname, input.baseUrl), { headers: { ...headers, ...init.headers }, redirect: init.redirect ?? "follow", method: init.method }, input.timeoutMs, signal);
  const home = await get("/");
  if (!home.ok) throw new Error(`homepage returned HTTP ${home.status}`);
  assertSecurityHeaders(home, "homepage");
  if (!/noindex/i.test(home.headers.get("x-robots-tag") ?? "")) throw new Error("staging homepage must be noindex");
  const homeText = await home.text();
  if (!homeText.includes("NutsNews")) throw new Error("homepage identity missing");
  for (const footerRoute of ["/about", "/contact", "/privacy"]) {
    if (!homeText.includes(`href=\"${footerRoute}\"`) && !homeText.includes(`href='${footerRoute}'`)) throw new Error(`homepage footer missing ${footerRoute}`);
  }
  const assetPath = homeText.match(/(?:src|href)=["'](\/_next\/static\/[^"']+)/)?.[1];
  if (!assetPath || !(await get(assetPath)).ok) throw new Error("representative static asset did not load");

  const articlesResponse = await get(`/api/articles?page=0&lang=en&qualification=${encodeURIComponent(fixtureNamespace)}`);
  const articles = await responseJson(articlesResponse, "articles API");
  if (!Array.isArray(articles.articles) || articles.articles.length < 1) throw new Error("articles API JSON shape is invalid or empty");
  const syntheticArticle = articles.articles.find((article) => typeof article?.id === "string" && JSON.stringify({ source: article.source, title: article.title, originalUrl: article.original_url }).includes(fixtureNamespace));
  if (!syntheticArticle) throw new Error("isolated staging read did not return the seeded synthetic namespace");
  if (!/public/.test(articlesResponse.headers.get("cache-control") ?? "")) throw new Error("articles API cache contract missing");
  const corsOrigin = articlesResponse.headers.get("access-control-allow-origin");
  if (corsOrigin !== "*" && corsOrigin !== input.baseUrl.replace(/\/$/, "")) throw new Error("articles API CORS contract missing");
  const articleId = encodeURIComponent(syntheticArticle.id);
  for (const route of [`/articles/${articleId}`, `/search?q=${encodeURIComponent(fixtureNamespace)}`, "/about", "/contact", "/privacy", `/api/articles?page=0&lang=fr&qualification=${encodeURIComponent(fixtureNamespace)}`]) {
    const response = await get(route);
    if (!response.ok) throw new Error(`${route} returned HTTP ${response.status}`);
  }
  for (const endpoint of ["/api/home-feed", "/api/search?q=community&lang=en", "/api/auth/providers", "/api/auth/session", "/api/auth/csrf"]) {
    const response = await get(endpoint);
    const payload = await responseJson(response, endpoint);
    if (!payload || typeof payload !== "object") throw new Error(`${endpoint} JSON shape is invalid`);
    if (/auth\//.test(endpoint) && !/no-store|private/.test(response.headers.get("cache-control") ?? "")) throw new Error(`${endpoint} must not be publicly cached`);
  }
  const admin = await get("/admin", { redirect: "manual" });
  if (![302, 303, 307, 308].includes(admin.status) || !/\/admin\/(?:login|access-denied)/.test(admin.headers.get("location") ?? "")) throw new Error("unauthenticated admin request did not redirect safely");
  const contactOptions = await get("/api/contact", { method: "OPTIONS", headers: { Origin: input.baseUrl.replace(/\/$/, ""), "Access-Control-Request-Method": "POST" } });
  if (![200, 204].includes(contactOptions.status)) throw new Error("contact OPTIONS contract failed");
  const contactDisabled = await boundedFetch(fetchImpl, new URL("/api/contact", input.baseUrl), {
    method: "POST",
    headers: { ...headers, Origin: input.baseUrl.replace(/\/$/, ""), "Content-Type": "application/json" },
    body: JSON.stringify({ email: "qualification@fixture.invalid", message: "Synthetic qualification message; delivery must remain disabled.", turnstileToken: "synthetic-disabled-token" }),
  }, input.timeoutMs, signal);
  if (contactDisabled.status !== 503) throw new Error("contact delivery was not fail-closed before Turnstile or email delivery");
  const contactGet = await get("/contact");
  if (!contactGet.ok) throw new Error("contact GET failed");
  return { articleId, routesChecked: 19, contactDelivery: "disabled-before-provider" };
}

function runChild(command, args, { cwd, env, timeoutMs, artifactHint, signal }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    let timedOut = false;
    let cancelled = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); }, timeoutMs);
    const cancel = () => { cancelled = true; child.kill("SIGTERM"); };
    signal?.addEventListener("abort", cancel, { once: true });
    child.on("close", (code, signalName) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      resolve({ code: signalName || timedOut || cancelled ? 1 : code ?? 1, status: cancelled ? "cancelled" : timedOut ? "timeout" : code === 0 ? "pass" : "fail", output: output.slice(-8_000), artifactHint });
    });
  });
}

function junitXml(report) {
  const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const failures = report.results.filter((result) => result.status !== "pass").length;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="staging-qualification" tests="${report.results.length}" failures="${failures}" skipped="0" time="${report.durationSeconds}">\n${report.results.map((result) => `  <testcase name="${escape(result.name)}" time="${result.durationSeconds ?? 0}">${result.status === "pass" ? "" : `<failure type="${escape(result.status)}" message="${escape(result.error ?? result.status)}"/>`}</testcase>`).join("\n")}\n</testsuite>\n`;
}

async function writeEvidence(report, input, env) {
  await mkdir(input.artifactDir, { recursive: true });
  const secrets = [env.CF_ACCESS_CLIENT_ID, env.CF_ACCESS_CLIENT_SECRET, env.GITHUB_TOKEN, env.GH_TOKEN, env.SUPABASE_SERVICE_ROLE_KEY, env.NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY, env.NUTSNEWS_TEST_USER_PASSWORD];
  const safe = redact(report, secrets);
  await writeFile(path.join(input.artifactDir, "staging-qualification.json"), `${JSON.stringify(safe, null, 2)}\n`);
  await writeFile(path.join(input.artifactDir, "staging-qualification.junit.xml"), junitXml(safe));
}

export function qualificationPasses(results) {
  return results.length > 0 && results.every((result) => result.required === true && result.status === "pass");
}

export async function runQualification(inputValue, adapters = {}) {
  const started = Date.now();
  const env = adapters.env ?? process.env;
  const fetchImpl = adapters.fetchImpl ?? fetch;
  const signal = adapters.signal;
  const input = validateQualificationInput(inputValue);
  const results = [];
  let fixtureNamespace = null;
  let originalFailure = null;
  let cleanupFailure = null;
  const record = async (name, operation) => {
    const stepStarted = Date.now();
    try {
      if (signal?.aborted) throw new DOMException("Qualification cancelled", "AbortError");
      const details = await operation();
      results.push({ name, required: true, status: "pass", durationSeconds: (Date.now() - stepStarted) / 1000, details });
      return details;
    } catch (error) {
      const status = error?.name === "TimeoutError" ? "timeout" : error?.name === "AbortError" ? "cancelled" : error?.code === "REQUIRED_SKIP" ? "skip" : "fail";
      const message = error instanceof Error ? error.message : String(error);
      results.push({ name, required: true, status, durationSeconds: (Date.now() - stepStarted) / 1000, error: message });
      if (!originalFailure) originalFailure = message;
      throw error;
    }
  };

  try {
    await record("cloudflare-access-and-runtime-identity", () => verifyAccessAndIdentity({ input, fetchImpl, env, signal }));
    await record("github-staging-deployment-identity", () => verifyGitHubDeployment({ input, fetchImpl, env, signal }));
    await record("existing-deployment-smoke", async () => {
      if (adapters.runDeploymentSmoke) return adapters.runDeploymentSmoke(input);
      const child = await runChild(process.execPath, [path.join(repoRoot, "scripts", "dual_target_web_smoke.mjs")], {
        cwd: webDir,
        timeoutMs: input.timeoutMs,
        env: { ...env, NUTSNEWS_SMOKE_BASE_URL: input.baseUrl, NUTSNEWS_EXPECTED_SOURCE_COMMIT: input.expectedSourceCommit, NUTSNEWS_EXPECTED_BUILD_ID: input.expectedBuildId, NUTSNEWS_EXPECTED_DEPLOYMENT_TARGET: input.expectedDeploymentTarget, NUTSNEWS_EXPECTED_HEALTH_DEPLOYMENT_TARGET: "vps", NUTSNEWS_EXPECTED_RUNTIME_ENV: input.expectedRuntimeEnv, NUTSNEWS_EXPECTED_IMAGE_DIGEST: input.expectedImageDigest, NUTSNEWS_EXPECTED_CONFIG_GENERATION: input.expectedConfigGeneration, NUTSNEWS_EXPECTED_SIDE_EFFECTS_MODE: "disabled" },
        signal,
      });
      if (child.status !== "pass") throw new Error(`existing deployment smoke ${child.status}: ${child.output}`);
      return { reused: "scripts/dual_target_web_smoke.mjs" };
    });
    await record("isolated-staging-synthetic-write", async () => {
      fixtureNamespace = adapters.fixtureNamespace ?? createFixtureNamespace();
      if (adapters.seedFixture) return adapters.seedFixture(fixtureNamespace);
      const url = String(env.NUTSNEWS_SUPABASE_URL ?? env.SUPABASE_URL ?? "").replace(/\/+$/, "");
      const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
      await seedStagingFixture(fixtureNamespace, getFixtureExpiry(), { url, serviceRoleKey });
      return { namespace: fixtureNamespace, synthetic: true, ttlMinutes: 60 };
    });
    await record("bounded-http-auth-contact-security", () => runHttpQualification({ input, fixtureNamespace, fetchImpl, env, signal }));
    await record("bounded-chromium-accessibility", async () => {
      if (adapters.runBrowser) return adapters.runBrowser(input);
      const playwrightArtifactDir = path.join(webDir, "test-results", "staging-qualification-playwright");
      await rm(playwrightArtifactDir, { recursive: true, force: true });
      const child = await runChild("npm", ["exec", "--", "playwright", "test", "--config=playwright.staging-qualification.config.ts"], {
        cwd: webDir,
        timeoutMs: input.timeoutMs * 3,
        artifactHint: playwrightArtifactDir,
        env: { ...env, PLAYWRIGHT_BASE_URL: input.baseUrl, NUTSNEWS_QUALIFICATION_ARTIFACT_DIR: input.artifactDir, NUTSNEWS_QUALIFICATION_FIXTURE_NAMESPACE: fixtureNamespace },
        signal,
      });
      await sanitizePlaywrightArtifacts(playwrightArtifactDir, [env.CF_ACCESS_CLIENT_ID, env.CF_ACCESS_CLIENT_SECRET]);
      if (child.status !== "pass") {
        const error = new Error(`Playwright ${child.status}; failure artifacts retained at ${child.artifactHint}; ${child.output}`);
        if (child.status === "timeout") error.name = "TimeoutError";
        if (child.status === "cancelled") error.name = "AbortError";
        throw error;
      }
      const junit = await assertRequiredPlaywrightReport(path.join(playwrightArtifactDir, "results.junit.xml"));
      return { artifactDir: child.artifactHint, junit };
    });
  } catch {
    // The first required failure stops additional mutation/navigation, but the
    // finally block still performs deterministic cleanup for any seeded run.
  } finally {
    if (fixtureNamespace) {
      const stepStarted = Date.now();
      try {
        if (adapters.cleanupFixture) await adapters.cleanupFixture(fixtureNamespace);
        else {
          const url = String(env.NUTSNEWS_SUPABASE_URL ?? env.SUPABASE_URL ?? "").replace(/\/+$/, "");
          const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
          await resetStagingFixture(fixtureNamespace, { url, serviceRoleKey });
        }
        results.push({ name: "unconditional-fixture-cleanup", required: true, status: "pass", durationSeconds: (Date.now() - stepStarted) / 1000 });
      } catch (error) {
        cleanupFailure = error instanceof Error ? error.message : String(error);
        results.push({ name: "unconditional-fixture-cleanup", required: true, status: "fail", durationSeconds: (Date.now() - stepStarted) / 1000, error: cleanupFailure });
      }
    }
  }
  const report = {
    schemaVersion: 1,
    suiteRevision: input.suiteRevision,
    target: input.baseUrl,
    stagingDeploymentId: input.stagingDeploymentId,
    expectedIdentity: { sourceCommit: input.expectedSourceCommit, buildId: input.expectedBuildId, imageDigest: input.expectedImageDigest, runtimeEnv: input.expectedRuntimeEnv, deploymentTarget: input.expectedDeploymentTarget, configGeneration: input.expectedConfigGeneration },
    result: qualificationPasses(results) ? "pass" : "fail",
    originalFailure,
    cleanupFailure,
    durationSeconds: (Date.now() - started) / 1000,
    results,
  };
  await writeEvidence(report, input, env);
  return report;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  let input;
  try {
    input = validateQualificationInput(parseQualificationInput());
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Staging qualification safety preflight failed");
    process.exitCode = 1;
  }
  if (input) {
    const cancellation = new AbortController();
    const cancel = () => cancellation.abort();
    process.once("SIGINT", cancel);
    process.once("SIGTERM", cancel);
    const report = await runQualification(input, { signal: cancellation.signal });
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
    console.log(`Staging qualification ${report.result}; evidence retained at ${input.artifactDir}`);
    if (report.originalFailure) console.error(`Original failure: ${redact(report.originalFailure)}`);
    if (report.cleanupFailure) console.error(`Cleanup failure: ${redact(report.cleanupFailure)}`);
    process.exitCode = report.result === "pass" ? 0 : 1;
  }
}
