#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webDir = resolve(repoRoot, "web");
const artifactPaths = {
  junit: "web/test-results/deployed-ui-smoke/results.junit.xml",
  html_report: "web/playwright-report",
  trace_on_failure: "web/test-results/deployed-ui-smoke",
  test_results: "web/test-results/deployed-ui-smoke",
  evidence_json: "web/test-results/deployed-ui-smoke/evidence.json",
};
const textExtensions = new Set([".css", ".html", ".js", ".json", ".log", ".md", ".txt", ".xml"]);
const protectedHeaderNames = [
  "CF-Access-Client-Id",
  "CF-Access-Client-Secret",
  "x-vercel-protection-bypass",
  "x-vercel-set-bypass-cookie",
];

function clean(value) {
  return String(value ?? "").trim();
}

function slug(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function protectedArtifactNeedles(env) {
  return [
    ...protectedHeaderNames,
    env.CF_ACCESS_CLIENT_ID,
    env.CF_ACCESS_CLIENT_SECRET,
    env.VERCEL_AUTOMATION_BYPASS_SECRET,
    env.VERCEL_PROTECTION_BYPASS_SECRET,
  ]
    .map(clean)
    .filter((value, index, values) => value && values.indexOf(value) === index);
}

function listArtifactFiles(paths) {
  const files = [];
  for (const artifactPath of paths) {
    const absolutePath = resolve(repoRoot, artifactPath);
    if (!existsSync(absolutePath)) continue;
    const stat = statSync(absolutePath);
    if (stat.isFile()) {
      files.push(absolutePath);
      continue;
    }
    if (!stat.isDirectory()) continue;

    const stack = [absolutePath];
    while (stack.length > 0) {
      const current = stack.pop();
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const child = resolve(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(child);
        } else if (entry.isFile()) {
          files.push(child);
        }
      }
    }
  }
  return files;
}

function relativeToRepo(path) {
  return path.replace(`${repoRoot}/`, "");
}

function sanitizeFile(filePath, needles) {
  const content = readFileSync(filePath);
  const matches = needles.filter((needle) => content.includes(Buffer.from(needle, "utf8")));
  if (matches.length === 0) return null;

  if (!textExtensions.has(extname(filePath).toLowerCase())) {
    rmSync(filePath, { force: true });
    return { path: relativeToRepo(filePath), action: "removed", matches: matches.length };
  }

  let safeText = content.toString("utf8");
  for (const needle of matches) {
    safeText = safeText.split(needle).join("[redacted-protected-target-auth]");
  }
  writeFileSync(filePath, safeText, "utf8");
  return { path: relativeToRepo(filePath), action: "redacted", matches: matches.length };
}

export function sanitizeUploadedArtifacts(env) {
  const needles = protectedArtifactNeedles(env);
  if (needles.length === 0) return [];

  return listArtifactFiles([artifactPaths.html_report, artifactPaths.test_results])
    .map((filePath) => sanitizeFile(filePath, needles))
    .filter(Boolean);
}

export function buildUiSmokeEvidence(env, result) {
  const targetUrl = clean(env.NUTSNEWS_UI_SMOKE_TARGET_URL) || clean(env.PLAYWRIGHT_BASE_URL);
  const targetType = clean(env.NUTSNEWS_UI_SMOKE_TARGET_TYPE);
  const sourceCommit = clean(env.NUTSNEWS_UI_SMOKE_SOURCE_COMMIT) || clean(env.GITHUB_SHA);
  const workflowRunId = clean(env.GITHUB_RUN_ID);
  const workflowRunAttempt = clean(env.GITHUB_RUN_ATTEMPT) || "1";
  const buildId = clean(env.NUTSNEWS_UI_SMOKE_BUILD_ID) || [workflowRunId, workflowRunAttempt].filter(Boolean).join("-");
  const deploymentId = clean(env.NUTSNEWS_UI_SMOKE_DEPLOYMENT_ID) || workflowRunId;
  const prNumber = clean(env.NUTSNEWS_UI_SMOKE_PR_NUMBER);

  if (!targetUrl) throw new Error("NUTSNEWS_UI_SMOKE_TARGET_URL or PLAYWRIGHT_BASE_URL is required.");
  if (!targetType) throw new Error("NUTSNEWS_UI_SMOKE_TARGET_TYPE is required.");
  if (!sourceCommit) throw new Error("NUTSNEWS_UI_SMOKE_SOURCE_COMMIT or GITHUB_SHA is required.");
  if (!buildId) throw new Error("NUTSNEWS_UI_SMOKE_BUILD_ID or GITHUB_RUN_ID/GITHUB_RUN_ATTEMPT is required.");
  if (!deploymentId) throw new Error("NUTSNEWS_UI_SMOKE_DEPLOYMENT_ID or GITHUB_RUN_ID is required.");
  if (!workflowRunId) throw new Error("GITHUB_RUN_ID is required.");

  const artifactName = `nutsnews-ui-smoke-${slug(targetType)}-${prNumber ? `pr-${prNumber}` : `run-${workflowRunId}`}-attempt-${workflowRunAttempt}`;
  return {
    schema_version: 1,
    target_url: targetUrl,
    target_type: targetType,
    source_commit: sourceCommit,
    build_id: buildId,
    deployment_id: deploymentId,
    result,
    workflow_run_id: workflowRunId,
    workflow_run_attempt: workflowRunAttempt,
    pr_number: prNumber || null,
    artifact_name: artifactName,
    artifact_paths: artifactPaths,
  };
}

export function writeUiSmokeEvidence(env, result) {
  const evidence = buildUiSmokeEvidence(env, result);
  const evidencePath = resolve(repoRoot, evidence.artifact_paths.evidence_json);
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  if (env.GITHUB_OUTPUT) {
    appendFileSync(
      env.GITHUB_OUTPUT,
      [
        `artifact_name=${evidence.artifact_name}`,
        `evidence_path=${evidence.artifact_paths.evidence_json}`,
        `result=${result}`,
        "",
      ].join("\n"),
      "utf8",
    );
  }

  return evidence;
}

async function main() {
  const child = spawnSync("npm", ["run", "test:e2e:deployed"], {
    cwd: webDir,
    env: process.env,
    stdio: "inherit",
  });
  const result = child.status === 0 ? "pass" : "fail";
  const sanitization = sanitizeUploadedArtifacts(process.env);
  const evidence = writeUiSmokeEvidence(process.env, result);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        "## Deployed UI smoke evidence",
        "",
        `- Target: \`${evidence.target_type}\``,
        `- Target URL: ${evidence.target_url}`,
        `- Source commit: \`${evidence.source_commit}\``,
        `- Build ID: \`${evidence.build_id}\``,
        `- Deployment ID: \`${evidence.deployment_id}\``,
        `- Result: \`${evidence.result}\``,
        `- Evidence: \`${evidence.artifact_paths.evidence_json}\``,
        `- Artifact auth sanitization: \`${sanitization.length} file(s)\``,
        "",
      ].join("\n"),
      "utf8",
    );
  }

  if (child.error) {
    throw child.error;
  }
  process.exit(child.status ?? 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
