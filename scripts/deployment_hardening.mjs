const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const GITHUB_PENDING_RUN_STATUSES = new Set(["queued", "in_progress", "waiting", "requested", "pending"]);
const GITHUB_TERMINAL_DEPLOYMENT_FAILURES = new Set(["failure", "error", "inactive"]);
const VERCEL_READY_STATES = new Set(["READY"]);
const VERCEL_TERMINAL_FAILURES = new Set(["ERROR", "CANCELED"]);
const VERCEL_PENDING_STATES = new Set(["QUEUED", "BUILDING", "INITIALIZING"]);

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

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new DeploymentValidationError(`${label} must be a positive integer.`);
}

function encodeRepository(repository) {
  const value = clean(repository);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new DeploymentValidationError("GitHub repository must be owner/name.");
  }
  return value.split("/").map(encodeURIComponent).join("/");
}

function bearer(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function responseStatus(response) {
  return Number(response?.status ?? 0);
}

function safeMessage(error) {
  return String(error?.message ?? error ?? "unknown error")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/(token=)[^&\s]+/gi, "$1[REDACTED]")
    .slice(0, 500);
}

function safeSummaryValue(key, value) {
  const text = clean(value);
  if (/_url$/i.test(key)) {
    try {
      const url = new URL(text);
      url.username = "";
      url.password = "";
      for (const name of [...url.searchParams.keys()]) {
        if (/(?:token|secret|key|auth|cookie|password)/i.test(name)) {
          url.searchParams.set(name, "[REDACTED]");
        }
      }
      return url.toString().slice(0, 300);
    } catch {
      return safeMessage(text).slice(0, 300);
    }
  }
  return safeMessage(text).slice(0, 300);
}

async function defaultSleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class DeploymentValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DeploymentValidationError";
    this.transient = false;
  }
}

export class DeploymentTransientError extends Error {
  constructor(message) {
    super(message);
    this.name = "DeploymentTransientError";
    this.transient = true;
  }
}

export function isTransientHttpStatus(status) {
  return TRANSIENT_HTTP_STATUSES.has(Number(status));
}

export function isValidationFailure(error) {
  return error instanceof DeploymentValidationError || error?.transient === false;
}

export async function withBoundedExponentialBackoff(operation, options = {}) {
  const label = clean(options.label) || "deployment operation";
  const timeoutMs = Number(options.timeoutMs ?? 300_000);
  const initialDelayMs = Number(options.initialDelayMs ?? 1_000);
  const maxDelayMs = Number(options.maxDelayMs ?? 30_000);
  const multiplier = Number(options.multiplier ?? 2);
  const maxAttempts = Number(options.maxAttempts ?? Number.MAX_SAFE_INTEGER);
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? (() => Date.now());

  assertPositiveInteger(timeoutMs, "timeoutMs");
  assertPositiveInteger(initialDelayMs, "initialDelayMs");
  assertPositiveInteger(maxDelayMs, "maxDelayMs");
  assertPositiveInteger(maxAttempts, "maxAttempts");
  if (!Number.isFinite(multiplier) || multiplier < 1) throw new DeploymentValidationError("multiplier must be >= 1.");

  const started = now();
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts && now() - started <= timeoutMs) {
    attempt += 1;
    try {
      return await operation({ attempt, elapsedMs: now() - started });
    } catch (error) {
      if (isValidationFailure(error)) throw error;
      lastError = error;
      const delayMs = Math.min(maxDelayMs, Math.round(initialDelayMs * multiplier ** (attempt - 1)));
      if (attempt >= maxAttempts || now() - started + delayMs > timeoutMs) break;
      await sleep(delayMs);
    }
  }

  throw new DeploymentTransientError(
    `${label} did not reach success within ${timeoutMs}ms after ${attempt} attempt(s). Last transient failure: ${safeMessage(lastError)}.`,
  );
}

export async function fetchJsonWithRetry(fetchImpl, url, init = {}, options = {}) {
  const label = clean(options.label) || `GET ${url}`;
  const requestTimeoutMs = Number(options.requestTimeoutMs ?? 30_000);
  const retryOptions = {
    label,
    timeoutMs: Number(options.timeoutMs ?? 120_000),
    initialDelayMs: Number(options.initialDelayMs ?? 1_000),
    maxDelayMs: Number(options.maxDelayMs ?? 15_000),
    maxAttempts: Number(options.maxAttempts ?? 5),
    sleep: options.sleep,
    now: options.now,
  };

  return withBoundedExponentialBackoff(async () => {
    let response;
    try {
      const timeoutSignal = AbortSignal.timeout(requestTimeoutMs);
      const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
      response = await fetchImpl(url, { ...init, signal });
    } catch (error) {
      throw new DeploymentTransientError(`${label} transient request failure: ${safeMessage(error)}`);
    }

    const status = responseStatus(response);
    if (!response.ok) {
      const message = `${label} returned HTTP ${status}`;
      if (isTransientHttpStatus(status)) throw new DeploymentTransientError(message);
      throw new DeploymentValidationError(message);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new DeploymentValidationError(`${label} did not return valid JSON: ${safeMessage(error)}`);
    }
  }, retryOptions);
}

export async function pollDeploymentStatus({ label, timeoutMs, poll, isSuccess, isTerminalFailure, describe, ...backoffOptions }) {
  return withBoundedExponentialBackoff(async (attempt) => {
    const snapshot = await poll(attempt);
    const description = describe ? describe(snapshot) : JSON.stringify(snapshot);
    if (isSuccess(snapshot)) return snapshot;
    if (isTerminalFailure(snapshot)) {
      throw new DeploymentValidationError(`${label} reached terminal failure: ${description}`);
    }
    throw new DeploymentTransientError(`${label} pending: ${description}`);
  }, { label, timeoutMs, ...backoffOptions });
}

export async function pollGitHubWorkflowRun({
  fetchImpl = fetch,
  repository,
  runId,
  token = "",
  expectedHeadSha = "",
  successConclusions = ["success"],
  timeoutMs = 300_000,
  ...backoffOptions
}) {
  const repoPath = encodeRepository(repository);
  const numericRunId = clean(runId);
  if (!/^[1-9][0-9]{0,19}$/.test(numericRunId)) throw new DeploymentValidationError("GitHub workflow run ID must be numeric.");
  if (expectedHeadSha && !/^[0-9a-f]{40}$/.test(expectedHeadSha)) throw new DeploymentValidationError("Expected GitHub head SHA must be a full lowercase SHA.");

  return pollDeploymentStatus({
    label: `GitHub workflow run ${repository}#${numericRunId}`,
    timeoutMs,
    poll: async () => fetchJsonWithRetry(
      fetchImpl,
      `https://api.github.com/repos/${repoPath}/actions/runs/${numericRunId}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          ...bearer(token),
        },
      },
      { label: `GitHub workflow run ${numericRunId} lookup`, maxAttempts: 2, ...backoffOptions },
    ).then((run) => {
      const status = clean(run.status);
      const headSha = clean(run.head_sha);
      if (expectedHeadSha && headSha !== expectedHeadSha) {
        throw new DeploymentValidationError(`GitHub workflow run head SHA mismatch: expected ${expectedHeadSha}, received ${headSha || "missing"}.`);
      }
      if (status !== "completed" && !GITHUB_PENDING_RUN_STATUSES.has(status)) {
        throw new DeploymentValidationError(`GitHub workflow run returned unknown status ${status || "missing"}.`);
      }
      return run;
    }),
    isSuccess: (run) => clean(run.status) === "completed" && successConclusions.includes(clean(run.conclusion)),
    isTerminalFailure: (run) => clean(run.status) === "completed" && !successConclusions.includes(clean(run.conclusion)),
    describe: (run) => `status=${clean(run.status) || "missing"} conclusion=${clean(run.conclusion) || "missing"} head_sha=${clean(run.head_sha) || "missing"}`,
    ...backoffOptions,
  });
}

export async function pollInfraGitHubDeployment({
  fetchImpl = fetch,
  repository,
  environment,
  deploymentId,
  token = "",
  expectedSourceCommit = "",
  expectedBuildId = "",
  expectedImageDigest = "",
  expectedConfigGeneration = "",
  timeoutMs = 300_000,
  ...backoffOptions
}) {
  const repoPath = encodeRepository(repository);
  const targetEnvironment = clean(environment);
  const targetDeploymentId = clean(deploymentId);
  if (!targetEnvironment) throw new DeploymentValidationError("Infra deployment environment is required.");
  if (!targetDeploymentId) throw new DeploymentValidationError("Infra deployment ID is required.");

  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...bearer(token),
  };

  return pollDeploymentStatus({
    label: `GitHub infra deployment ${repository}/${targetEnvironment}/${targetDeploymentId}`,
    timeoutMs,
    poll: async () => {
      const query = new URLSearchParams({ environment: targetEnvironment, per_page: "100" });
      const deployments = await fetchJsonWithRetry(
        fetchImpl,
        `https://api.github.com/repos/${repoPath}/deployments?${query}`,
        { headers },
        { label: `GitHub ${targetEnvironment} deployment lookup`, maxAttempts: 2, ...backoffOptions },
      );
      const deployment = deployments.find((item) => clean(item?.payload?.deployment_id) === targetDeploymentId);
      if (!deployment) return { state: "pending", reason: "deployment-not-found" };

      const expected = {
        source_commit: expectedSourceCommit,
        build_id: expectedBuildId,
        requested_digest: expectedImageDigest,
        config_generation: expectedConfigGeneration,
      };
      for (const [key, expectedValue] of Object.entries(expected)) {
        if (expectedValue && clean(deployment.payload?.[key]) !== expectedValue) {
          throw new DeploymentValidationError(`GitHub infra deployment ${key} mismatch: expected ${expectedValue}, received ${clean(deployment.payload?.[key]) || "missing"}.`);
        }
      }

      const statuses = await fetchJsonWithRetry(
        fetchImpl,
        deployment.statuses_url,
        { headers },
        { label: `GitHub ${targetDeploymentId} status lookup`, maxAttempts: 2, ...backoffOptions },
      );
      const status = statuses[0] ?? { state: "pending", description: "no deployment status yet" };
      return { state: clean(status.state) || "pending", deployment, status };
    },
    isSuccess: (snapshot) => snapshot.state === "success",
    isTerminalFailure: (snapshot) => GITHUB_TERMINAL_DEPLOYMENT_FAILURES.has(snapshot.state),
    describe: (snapshot) => `state=${snapshot.state} deployment_id=${targetDeploymentId} description=${clean(snapshot.status?.description) || clean(snapshot.reason) || "pending"}`,
    ...backoffOptions,
  });
}

export async function pollVercelDeployment({
  fetchImpl = fetch,
  deploymentIdOrHost,
  teamId = "",
  token,
  expectedSourceCommit = "",
  timeoutMs = 600_000,
  ...backoffOptions
}) {
  const deployment = clean(deploymentIdOrHost);
  if (!deployment) throw new DeploymentValidationError("Vercel deployment ID or host is required.");
  if (!token) throw new DeploymentValidationError("Vercel token is required.");
  if (expectedSourceCommit && !/^[0-9a-f]{40}$/.test(expectedSourceCommit)) throw new DeploymentValidationError("Expected Vercel source commit must be a full lowercase SHA.");

  return pollDeploymentStatus({
    label: `Vercel deployment ${deployment}`,
    timeoutMs,
    poll: async () => {
      const query = new URLSearchParams();
      if (teamId) query.set("teamId", teamId);
      const payload = await fetchJsonWithRetry(
        fetchImpl,
        `https://api.vercel.com/v13/deployments/${encodeURIComponent(deployment)}${query.size ? `?${query}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
        { label: `Vercel deployment ${deployment} lookup`, maxAttempts: 2, ...backoffOptions },
      );
      const sourceSha = clean(payload.meta?.githubCommitSha ?? payload.gitSource?.sha ?? "");
      if (expectedSourceCommit && sourceSha && sourceSha !== expectedSourceCommit) {
        throw new DeploymentValidationError(`Vercel deployment source SHA mismatch: expected ${expectedSourceCommit}, received ${sourceSha}.`);
      }
      const normalizedReadyState = clean(payload.readyState ?? payload.state ?? "UNKNOWN").toUpperCase();
      if (
        !VERCEL_READY_STATES.has(normalizedReadyState) &&
        !VERCEL_TERMINAL_FAILURES.has(normalizedReadyState) &&
        !VERCEL_PENDING_STATES.has(normalizedReadyState)
      ) {
        throw new DeploymentValidationError(`Vercel deployment returned unknown readyState ${normalizedReadyState}.`);
      }
      return {
        ...payload,
        normalizedReadyState,
        sourceSha,
      };
    },
    isSuccess: (payload) => VERCEL_READY_STATES.has(payload.normalizedReadyState),
    isTerminalFailure: (payload) => VERCEL_TERMINAL_FAILURES.has(payload.normalizedReadyState),
    describe: (payload) => `id=${clean(payload.id ?? payload.uid) || deployment} readyState=${payload.normalizedReadyState} source=${payload.sourceSha || "missing"}`,
    ...backoffOptions,
  });
}

export function preMergeDeploymentConcurrencyGroup({ prNumber }) {
  const value = clean(prNumber);
  if (!/^[1-9][0-9]{0,9}$/.test(value)) throw new DeploymentValidationError("PR number is required for pre-merge deployment concurrency.");
  return `nutsnews-premerge-deploy-pr-${value}`;
}

export function deploymentStageIdempotencyKey({ prNumber, sourceCommit, targetType }) {
  const pr = clean(prNumber);
  const commit = clean(sourceCommit);
  const target = slug(targetType);
  if (!/^[1-9][0-9]{0,9}$/.test(pr)) throw new DeploymentValidationError("PR number is required for deployment idempotency.");
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new DeploymentValidationError("Source commit is required for deployment idempotency.");
  if (!target) throw new DeploymentValidationError("Target type is required for deployment idempotency.");
  return `pr-${pr}-${commit}-${target}`;
}

export function safeDeploymentDebugSummary(details) {
  const allowed = [
    "pr_number",
    "target_type",
    "target_url",
    "source_commit",
    "build_id",
    "deployment_id",
    "workflow_run_id",
    "workflow_run_attempt",
    "vercel_deployment_id",
    "github_deployment_id",
    "infra_run_id",
    "result",
  ];
  return Object.fromEntries(
    allowed
      .filter((key) => details[key] !== undefined && details[key] !== null && clean(details[key]) !== "")
      .map((key) => [key, safeSummaryValue(key, details[key])]),
  );
}
