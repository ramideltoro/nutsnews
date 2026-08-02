#!/usr/bin/env node

const REPOSITORY = "ramideltoro/nutsnews";
const WORKFLOW_FILE = "staging-supabase-migration.yml";
const CONFIRMATION = "apply-staging-supabase-migrations";
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_POLL_MS = 5_000;

function requiredEnvironment(env, name) {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(`Protected staging migration dispatch requires ${name}.`);
  return value;
}

export function getStagingMigrationDispatchRequest(env = process.env) {
  const token = requiredEnvironment(env, "GITHUB_TOKEN");
  const repository = requiredEnvironment(env, "GITHUB_REPOSITORY");
  const apiUrl = requiredEnvironment(env, "GITHUB_API_URL");
  const sourceCommit = requiredEnvironment(env, "NUTSNEWS_STAGING_MIGRATION_SOURCE_COMMIT");
  const migrationHead = requiredEnvironment(env, "NUTSNEWS_STAGING_MIGRATION_HEAD");

  if (repository !== REPOSITORY || apiUrl !== "https://api.github.com") {
    throw new Error("Protected staging migration dispatch must target the trusted NutsNews GitHub API repository.");
  }
  if (!/^[0-9a-f]{40}$/.test(sourceCommit) || !/^[0-9]{14}$/.test(migrationHead)) {
    throw new Error("Protected staging migration dispatch requires an immutable source and migration head.");
  }

  return Object.freeze({ token, repository, apiUrl, sourceCommit, migrationHead });
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function responseJson(response, label) {
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

export async function dispatchAndWaitForStagingMigration({
  request,
  fetchImpl = fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now = Date.now,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollMs = DEFAULT_POLL_MS,
}) {
  const headers = githubHeaders(request.token);
  const workflowUrl = `${request.apiUrl}/repos/${request.repository}/actions/workflows/${WORKFLOW_FILE}`;
  const startedAt = now();
  const expectedTitle = `Staging Supabase migration for ${request.sourceCommit}`;
  const dispatchResponse = await fetchImpl(`${workflowUrl}/dispatches`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ref: "main",
      inputs: {
        source_commit: request.sourceCommit,
        migration_head: request.migrationHead,
        confirmation: CONFIRMATION,
      },
    }),
  });
  if (dispatchResponse.status !== 204) {
    throw new Error(`Protected staging migration dispatch returned HTTP ${dispatchResponse.status}.`);
  }

  const deadline = startedAt + timeoutMs;
  let runId = null;
  while (now() <= deadline) {
    let run;
    if (runId === null) {
      const runs = await responseJson(
        await fetchImpl(`${workflowUrl}/runs?event=workflow_dispatch&branch=main&per_page=20`, { headers }),
        "Protected staging migration run lookup",
      );
      const matches = Array.isArray(runs.workflow_runs)
        ? runs.workflow_runs.filter((candidate) => {
            const createdAt = Date.parse(candidate?.created_at ?? "");
            return (
              candidate?.event === "workflow_dispatch" &&
              candidate?.display_title === expectedTitle &&
              Number.isFinite(createdAt) &&
              createdAt >= startedAt - 5_000
            );
          })
        : [];
      if (matches.length > 1) {
        throw new Error("Protected staging migration dispatch matched multiple new workflow runs.");
      }
      run = matches[0];
      if (run) runId = run.id;
    } else {
      run = await responseJson(
        await fetchImpl(`${request.apiUrl}/repos/${request.repository}/actions/runs/${runId}`, { headers }),
        "Protected staging migration run status",
      );
    }

    if (run?.status === "completed") {
      if (run.conclusion !== "success") {
        throw new Error(`Protected staging migration run ${run.id} completed with ${run.conclusion || "no conclusion"}.`);
      }
      console.log(`Protected staging migration run ${run.id} verified at head ${request.migrationHead}.`);
      return Object.freeze({ runId: String(run.id), url: String(run.html_url ?? "") });
    }
    await sleep(pollMs);
  }

  throw new Error("Timed out waiting for the protected staging migration workflow.");
}

const invokedDirectly = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (invokedDirectly) {
  dispatchAndWaitForStagingMigration({ request: getStagingMigrationDispatchRequest() }).catch((error) => {
    console.error(error instanceof Error ? error.message : "Protected staging migration dispatch failed.");
    process.exitCode = 1;
  });
}
