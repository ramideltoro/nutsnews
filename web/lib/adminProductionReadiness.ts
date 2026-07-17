import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import { PAGE_SIZE } from "@/lib/articles";
import { DEFAULT_LANGUAGE_CODE, SUPPORTED_LANGUAGES } from "@/lib/languages";
import { getServerSupabase, getServerSupabaseConfig } from "@/lib/supabase";

const RECENT_ARTICLE_LIMIT = 100;
const TRANSLATION_SAMPLE_LIMIT = 60;
const WORKER_STALE_WARNING_MINUTES = 180;
const WORKER_STALE_FAILURE_MINUTES = 24 * 60;
const IMAGE_GREEN_PERCENT = 85;
const IMAGE_YELLOW_PERCENT = 70;
const TRANSLATION_GREEN_PERCENT = 90;
const TRANSLATION_YELLOW_PERCENT = 75;
const GITHUB_REPO_OWNER = "ramideltoro";
const GITHUB_REPO_NAME = "nutsnews";
const GITHUB_ACTIONS_BRANCH = "main";
const GITHUB_ACTIONS_REVALIDATE_SECONDS = 300;
const GITHUB_ACTIONS_STALE_HOURS = 72;
const BACKUP_RESTORE_STALE_HOURS = 30;
const GITHUB_ACTIONS_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions`;
const GITHUB_ACTIONS_RUNS_API_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/runs?branch=${GITHUB_ACTIONS_BRANCH}&per_page=50`;
const SLO_DOC_URL =
  "https://github.com/ramideltoro/nutsnews-docs/blob/main/SERVICE_LEVEL_OBJECTIVES.md";
const SLO_MONTHLY_AVAILABILITY_TARGET = "99.5%";
const SLO_MONTHLY_ERROR_BUDGET_MINUTES = 216;
const SLO_TARGET_SUMMARY =
  "homepage and /api/articles 99.5% monthly availability, Worker success >=95%, feed freshness <=3h, translation coverage >=90%, and backup verification <=30h";
const SLO_COMPONENT_SIGNAL_IDS = new Set([
  "configuration",
  "public-api-health",
  "graceful-degradation",
  "worker-controller",
  "db-growth",
  "translation-coverage",
  "backup-freshness",
  "ci-status",
]);

type GitHubWorkflowRequirement = {
  label: string;
  names: readonly string[];
  paths: readonly string[];
};

const REQUIRED_GITHUB_WORKFLOWS = [
  {
    label: "Web CI",
    names: ["Web CI"],
    paths: [".github/workflows/web-ci.yml"],
  },
  {
    label: "Public smoke",
    names: ["Public Reader Smoke Tests"],
    paths: [".github/workflows/public-reader-smoke.yml"],
  },
  {
    label: "Preview smoke",
    names: ["Vercel Preview Smoke Test"],
    paths: [".github/workflows/vercel-preview-smoke.yml"],
  },
  {
    label: "Lighthouse",
    names: ["Lighthouse CI"],
    paths: [".github/workflows/lighthouse-ci.yml"],
  },
  {
    label: "Axe accessibility",
    names: ["Accessibility CI"],
    paths: [".github/workflows/accessibility-ci.yml"],
  },
  {
    label: "CodeQL",
    names: ["CodeQL Security Scan"],
    paths: [".github/workflows/codeql.yml"],
  },
  {
    label: "Gitleaks secrets",
    names: ["Gitleaks Secret Scan"],
    paths: [".github/workflows/gitleaks.yml"],
  },
  {
    label: "OSV Scanner",
    names: ["OSV Scanner"],
    paths: [".github/workflows/osv-scanner.yml"],
  },
  {
    label: "Dependency Review",
    names: ["Dependency Review"],
    paths: [".github/workflows/dependency-review.yml"],
  },
  {
    label: "OpenSSF Scorecard",
    names: ["OpenSSF Scorecard"],
    paths: [".github/workflows/openssf-scorecard.yml"],
  },
  {
    label: "Snyk Security Scan",
    names: ["Snyk Security Scan"],
    paths: [".github/workflows/snyk.yml"],
  },
] as const satisfies readonly GitHubWorkflowRequirement[];

const BACKUP_RESTORE_WORKFLOW = {
  label: "Backup restore fire drill",
  names: ["Supabase Backup"],
  paths: [".github/workflows/supabase-backup.yml"],
} as const satisfies GitHubWorkflowRequirement;

export type ProductionReadinessStatus = "green" | "yellow" | "red";

export type ProductionReadinessWorkflow = {
  name: string;
  status: ProductionReadinessStatus;
  statusLabel: string;
  githubStatus: string;
  conclusion: string;
  branch: string;
  commitSha: string;
  updatedAt: string | null;
  href: string;
  linkLabel: string;
  detail: string;
};

export type ProductionReadinessSignal = {
  id: string;
  title: string;
  status: ProductionReadinessStatus;
  statusLabel: string;
  value: string;
  detail: string;
  nextStep: string;
  href: string;
  linkLabel: string;
  workflows?: ProductionReadinessWorkflow[];
};

export type ProductionReadinessDashboardData = {
  isConfigured: boolean;
  errorMessage: string | null;
  generatedAt: string;
  overallStatus: ProductionReadinessStatus;
  overallLabel: string;
  summary: {
    green: number;
    yellow: number;
    red: number;
    total: number;
  };
  signals: ProductionReadinessSignal[];
};

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type RecentArticleRow = {
  id: string;
  original_url: string | null;
  image_url: string | null;
  published_on_site_at: string | null;
  created_at: string | null;
};

type WorkerRunRow = {
  id: number;
  run_started_at: string | null;
  run_completed_at: string | null;
  success: boolean | null;
  error_name: string | null;
  error_message: string | null;
  feed_count: number | null;
  fetched_count: number | null;
  candidate_count: number | null;
  accepted_count: number | null;
  rejected_count: number | null;
  duration_ms: number | null;
};

type SummaryRow = {
  original_url: string;
  language_code: string;
};

type GitHubWorkflowRun = {
  id: number;
  name: string | null;
  path: string | null;
  status: string | null;
  conclusion: string | null;
  head_branch: string | null;
  head_sha: string | null;
  html_url: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type GitHubWorkflowRunsResponse = {
  workflow_runs?: GitHubWorkflowRun[];
};

function getSupabaseConfig(): SupabaseConfig | null {
  try {
    return getServerSupabaseConfig();
  } catch {
    return null;
  }
}

function percent(part: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

function minutesSince(value: string | null, now: Date) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(0, Math.round((now.getTime() - timestamp) / 60000));
}

function sinceIso(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function formatAge(minutes: number | null) {
  if (minutes === null) {
    return "Unknown age";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h ago`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function statusRank(status: ProductionReadinessStatus) {
  if (status === "red") {
    return 2;
  }

  return status === "yellow" ? 1 : 0;
}

function summarize(signals: ProductionReadinessSignal[]) {
  return signals.reduce(
    (summary, signal) => ({
      ...summary,
      [signal.status]: summary[signal.status] + 1,
      total: summary.total + 1,
    }),
    { green: 0, yellow: 0, red: 0, total: 0 },
  );
}

function signal({
  id,
  title,
  status,
  statusLabel,
  value,
  detail,
  nextStep,
  href,
  linkLabel,
  workflows,
}: ProductionReadinessSignal): ProductionReadinessSignal {
  return {
    id,
    title,
    status,
    statusLabel,
    value,
    detail,
    nextStep,
    href,
    linkLabel,
    workflows,
  };
}

async function getExactCount(client: SupabaseClient, table: string) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function loadRecentArticles(client: SupabaseClient) {
  const { data, error } = await client
    .from("articles")
    .select("id,original_url,image_url,published_on_site_at,created_at")
    .eq("status", "published")
    .order("published_on_site_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(RECENT_ARTICLE_LIMIT);

  if (error) {
    throw new Error(`Failed to load recent published articles: ${error.message}`);
  }

  return (data ?? []) as RecentArticleRow[];
}

async function loadWorkerRun(client: SupabaseClient) {
  const { data, error } = await client
    .from("worker_runs")
    .select(
      "id,run_started_at,run_completed_at,success,error_name,error_message,feed_count,fetched_count,candidate_count,accepted_count,rejected_count,duration_ms",
    )
    .order("run_started_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load latest Worker run: ${error.message}`);
  }

  return data as WorkerRunRow | null;
}

async function loadRecentSummaries(client: SupabaseClient, articles: RecentArticleRow[]) {
  const originalUrls = articles
    .slice(0, TRANSLATION_SAMPLE_LIMIT)
    .map((article) => article.original_url)
    .filter((originalUrl): originalUrl is string => Boolean(originalUrl));
  const targetLanguages = SUPPORTED_LANGUAGES.map((language) => language.code).filter(
    (languageCode) => languageCode !== DEFAULT_LANGUAGE_CODE,
  );

  if (originalUrls.length === 0 || targetLanguages.length === 0) {
    return {
      summaries: [] as SummaryRow[],
      expectedCount: originalUrls.length * targetLanguages.length,
      targetLanguages,
    };
  }

  const { data, error } = await client
    .from("article_summaries")
    .select("original_url,language_code")
    .in("original_url", originalUrls)
    .in("language_code", targetLanguages);

  if (error) {
    throw new Error(`Failed to load recent translation summaries: ${error.message}`);
  }

  return {
    summaries: (data ?? []) as SummaryRow[],
    expectedCount: originalUrls.length * targetLanguages.length,
    targetLanguages,
  };
}

async function countArticlesSince(client: SupabaseClient, hours: number) {
  const { count, error } = await client
    .from("articles")
    .select("*", { count: "exact", head: true })
    .eq("status", "published")
    .gte("created_at", sinceIso(hours));

  if (error) {
    throw new Error(`Failed to count recent published articles: ${error.message}`);
  }

  return count ?? 0;
}

function buildPublicApiSignal({
  publicFeedSnapshotCount,
  recentArticles,
}: {
  publicFeedSnapshotCount: number;
  recentArticles: RecentArticleRow[];
}) {
  if (publicFeedSnapshotCount >= PAGE_SIZE) {
    return signal({
      id: "public-api-health",
      title: "Public API health",
      status: "green",
      statusLabel: "Ready",
      value: `${formatCount(publicFeedSnapshotCount)} feed rows`,
      detail: `/api/articles can be backed by public_feed_snapshot with at least one full page of articles.`,
      nextStep: "If readers report empty feeds, open the API route and cache observability dashboard.",
      href: "/api/articles?home=1",
      linkLabel: "Open public API",
    });
  }

  if (recentArticles.length >= PAGE_SIZE) {
    return signal({
      id: "public-api-health",
      title: "Public API health",
      status: "yellow",
      statusLabel: "Fallback only",
      value: `${formatCount(recentArticles.length)} recent articles`,
      detail: "The canonical articles table has enough published rows, but public_feed_snapshot is short or empty.",
      nextStep: "Refresh public_feed_snapshot and review cache/edge snapshot health before shipping.",
      href: "/admin/edge-snapshot",
      linkLabel: "Review edge snapshot",
    });
  }

  return signal({
    id: "public-api-health",
    title: "Public API health",
    status: "red",
    statusLabel: "Not ready",
    value: `${formatCount(publicFeedSnapshotCount)} feed rows`,
    detail: "Neither public_feed_snapshot nor recent published articles have enough rows for a healthy first page.",
    nextStep: "Check Worker shards, article publishing, and public feed snapshot refresh before promoting.",
    href: "/admin/shards",
    linkLabel: "Check Worker shards",
  });
}

function buildGracefulDegradationSignal({
  publicFeedSnapshotCount,
  recentArticles,
  workerRun,
  now,
}: {
  publicFeedSnapshotCount: number;
  recentArticles: RecentArticleRow[];
  workerRun: WorkerRunRow | null;
  now: Date;
}) {
  const lastRunAt = workerRun?.run_started_at || workerRun?.run_completed_at || null;
  const workerAgeMinutes = minutesSince(lastRunAt, now);
  const snapshotReady = publicFeedSnapshotCount >= PAGE_SIZE;
  const sourceFallbackReady = recentArticles.length >= PAGE_SIZE;
  const workerFresh =
    Boolean(workerRun?.success) &&
    workerAgeMinutes !== null &&
    workerAgeMinutes <= WORKER_STALE_WARNING_MINUTES;

  if (snapshotReady && workerFresh) {
    return signal({
      id: "graceful-degradation",
      title: "Graceful degradation mode",
      status: "green",
      statusLabel: "Protected",
      value: "Snapshot ready",
      detail:
        "The reader has a full public_feed_snapshot and the latest Worker run is fresh, so a short Supabase, Worker, or local-AI outage can fall back without showing a broken home feed.",
      nextStep:
        "Keep watching edge snapshot age, Worker shard health, and local AI fallback counts during incidents.",
      href: "/admin/edge-snapshot",
      linkLabel: "Open edge snapshot",
    });
  }

  if (snapshotReady) {
    return signal({
      id: "graceful-degradation",
      title: "Graceful degradation mode",
      status: "yellow",
      statusLabel: "Reader protected",
      value: "Feed frozen",
      detail:
        "The reader can still serve the last-known-good public feed, but Worker or local-AI health needs review before relying on fresh ingestion.",
      nextStep:
        "Open Worker shard health and local AI dashboards, then confirm failed AI reviews are falling back or being skipped without blocking all article saves.",
      href: "/admin/shards",
      linkLabel: "Open Worker health",
    });
  }

  if (sourceFallbackReady) {
    return signal({
      id: "graceful-degradation",
      title: "Graceful degradation mode",
      status: "yellow",
      statusLabel: "DB fallback",
      value: "No snapshot",
      detail:
        "public_feed_snapshot is not ready, but the canonical articles table can still provide a first page. A Supabase read outage would leave only the edge snapshot or maintenance state.",
      nextStep:
        "Refresh public_feed_snapshot and verify Cloudflare edge snapshot status before the next incident.",
      href: "/admin/edge-snapshot",
      linkLabel: "Open edge snapshot",
    });
  }

  return signal({
    id: "graceful-degradation",
    title: "Graceful degradation mode",
    status: "red",
    statusLabel: "Blocked",
    value: "No fallback",
    detail:
      "No full public snapshot or source-table first page is available. A Supabase, Worker, or local-AI outage would put the reader into maintenance mode.",
    nextStep:
      "Restore Worker ingestion, refresh public_feed_snapshot, and confirm local AI failures do not prevent article saves.",
    href: "/admin/shards",
    linkLabel: "Open Worker health",
  });
}

function buildWorkerSignal(workerRun: WorkerRunRow | null, now: Date) {
  if (!workerRun) {
    return signal({
      id: "worker-controller",
      title: "Latest Worker/controller success",
      status: "yellow",
      statusLabel: "Unknown",
      value: "No saved runs",
      detail: "No worker_runs row exists for the readiness dashboard to measure.",
      nextStep: "Run or inspect the Worker controller, then verify worker_runs telemetry is saving.",
      href: "/admin/shards",
      linkLabel: "Open Worker health",
    });
  }

  const lastRunAt = workerRun.run_started_at || workerRun.run_completed_at;
  const ageMinutes = minutesSince(lastRunAt, now);

  if (!workerRun.success) {
    return signal({
      id: "worker-controller",
      title: "Latest Worker/controller success",
      status: "red",
      statusLabel: "Failed",
      value: formatAge(ageMinutes),
      detail: workerRun.error_message || workerRun.error_name || "The latest Worker run failed.",
      nextStep: "Open Worker shard health, inspect the failed run, and rerun the controller after fixing the error.",
      href: "/admin/shards",
      linkLabel: "Open Worker health",
    });
  }

  if (ageMinutes !== null && ageMinutes > WORKER_STALE_FAILURE_MINUTES) {
    return signal({
      id: "worker-controller",
      title: "Latest Worker/controller success",
      status: "red",
      statusLabel: "Stale",
      value: formatAge(ageMinutes),
      detail: "The latest successful Worker run is older than 24 hours.",
      nextStep: "Check Cloudflare Worker schedules, controller logs, and shard telemetry.",
      href: "/admin/shards",
      linkLabel: "Open Worker health",
    });
  }

  if (ageMinutes !== null && ageMinutes > WORKER_STALE_WARNING_MINUTES) {
    return signal({
      id: "worker-controller",
      title: "Latest Worker/controller success",
      status: "yellow",
      statusLabel: "Aging",
      value: formatAge(ageMinutes),
      detail: "The latest successful Worker run is older than the normal freshness window.",
      nextStep: "Confirm scheduled Worker runs are still firing before promoting.",
      href: "/admin/shards",
      linkLabel: "Open Worker health",
    });
  }

  return signal({
    id: "worker-controller",
    title: "Latest Worker/controller success",
    status: "green",
    statusLabel: "Fresh",
    value: formatAge(ageMinutes),
    detail: `${formatCount(workerRun.accepted_count ?? 0)} accepted, ${formatCount(workerRun.fetched_count ?? 0)} fetched in the latest run.`,
    nextStep: "If article volume looks wrong, review shard details and feed health.",
    href: "/admin/shards",
    linkLabel: "Open Worker health",
  });
}

function buildDbGrowthSignal({
  articleCount,
  articlesLast24Hours,
  articlesLast7Days,
}: {
  articleCount: number;
  articlesLast24Hours: number;
  articlesLast7Days: number;
}) {
  if (articlesLast24Hours > 0) {
    return signal({
      id: "db-growth",
      title: "DB growth signal",
      status: "green",
      statusLabel: "Growing",
      value: `${formatCount(articlesLast24Hours)} in 24h`,
      detail: `${formatCount(articleCount)} total articles; new published rows arrived in the last day.`,
      nextStep: "Watch free-tier guardrails if growth spikes above expected volume.",
      href: "/admin/guardrails",
      linkLabel: "Open guardrails",
    });
  }

  if (articlesLast7Days > 0) {
    return signal({
      id: "db-growth",
      title: "DB growth signal",
      status: "yellow",
      statusLabel: "Slow",
      value: `${formatCount(articlesLast7Days)} in 7d`,
      detail: `${formatCount(articleCount)} total articles, but no published rows were created in the last 24 hours.`,
      nextStep: "Check Worker health and feed health before promoting fresh content.",
      href: "/admin/feed-health",
      linkLabel: "Open feed health",
    });
  }

  return signal({
    id: "db-growth",
    title: "DB growth signal",
    status: "red",
    statusLabel: "Stopped",
    value: "0 in 7d",
    detail: `${formatCount(articleCount)} total articles, with no recent published growth detected.`,
    nextStep: "Investigate Worker schedules, source failures, AI review limits, and Supabase writes.",
    href: "/admin/shards",
    linkLabel: "Open Worker health",
  });
}

function buildTranslationSignal({
  expectedCount,
  availableCount,
}: {
  expectedCount: number;
  availableCount: number;
}) {
  if (expectedCount === 0) {
    return signal({
      id: "translation-coverage",
      title: "Translation coverage",
      status: "yellow",
      statusLabel: "Unknown",
      value: "No sample",
      detail: "No recent articles with original URLs were available for translation coverage sampling.",
      nextStep: "Open translation quality and run the translation audit after articles are available.",
      href: "/admin/translations",
      linkLabel: "Open translations",
    });
  }

  const coverage = percent(availableCount, expectedCount);

  if (coverage >= TRANSLATION_GREEN_PERCENT) {
    return signal({
      id: "translation-coverage",
      title: "Translation coverage",
      status: "green",
      statusLabel: "Ready",
      value: `${coverage}%`,
      detail: `${formatCount(availableCount)} of ${formatCount(expectedCount)} recent translation rows exist.`,
      nextStep: "Review translation quality if readers report fallback text.",
      href: "/admin/translations",
      linkLabel: "Open translations",
    });
  }

  if (coverage >= TRANSLATION_YELLOW_PERCENT) {
    return signal({
      id: "translation-coverage",
      title: "Translation coverage",
      status: "yellow",
      statusLabel: "Partial",
      value: `${coverage}%`,
      detail: `${formatCount(expectedCount - availableCount)} recent translation rows are missing.`,
      nextStep: "Run the translation audit/backfill before promoting multilingual content.",
      href: "/admin/translations",
      linkLabel: "Open translations",
    });
  }

  return signal({
    id: "translation-coverage",
    title: "Translation coverage",
    status: "red",
    statusLabel: "Low",
    value: `${coverage}%`,
    detail: `${formatCount(expectedCount - availableCount)} recent translation rows are missing.`,
    nextStep: "Pause promotion, run translation diagnostics, and backfill missing summaries.",
    href: "/admin/translations",
    linkLabel: "Open translations",
  });
}

function buildImageSignal(recentArticles: RecentArticleRow[]) {
  if (recentArticles.length === 0) {
    return signal({
      id: "image-coverage",
      title: "Image coverage",
      status: "yellow",
      statusLabel: "Unknown",
      value: "No sample",
      detail: "No recent published articles were available for image coverage sampling.",
      nextStep: "Check Worker runs and feed health to restore article ingestion.",
      href: "/admin/feed-health",
      linkLabel: "Open feed health",
    });
  }

  const withImages = recentArticles.filter((article) => article.image_url?.trim()).length;
  const coverage = percent(withImages, recentArticles.length);

  if (coverage >= IMAGE_GREEN_PERCENT) {
    return signal({
      id: "image-coverage",
      title: "Image coverage",
      status: "green",
      statusLabel: "Ready",
      value: `${coverage}%`,
      detail: `${formatCount(withImages)} of ${formatCount(recentArticles.length)} recent articles include thumbnails.`,
      nextStep: "If a source looks visually weak, review feed health image rates.",
      href: "/admin/feed-health",
      linkLabel: "Open feed health",
    });
  }

  if (coverage >= IMAGE_YELLOW_PERCENT) {
    return signal({
      id: "image-coverage",
      title: "Image coverage",
      status: "yellow",
      statusLabel: "Thin",
      value: `${coverage}%`,
      detail: "Recent article thumbnail coverage is below the preferred launch threshold.",
      nextStep: "Review image hydration and weak feeds before promoting.",
      href: "/admin/feed-health",
      linkLabel: "Open feed health",
    });
  }

  return signal({
    id: "image-coverage",
    title: "Image coverage",
    status: "red",
    statusLabel: "Low",
    value: `${coverage}%`,
    detail: "Recent article thumbnail coverage is too low for a polished reader experience.",
    nextStep: "Investigate no-thumbnail rejections, image hydration, and RSS source quality.",
    href: "/admin/feed-health",
    linkLabel: "Open feed health",
  });
}

function summarizeSignalTitles(signals: ProductionReadinessSignal[]) {
  const names = signals.slice(0, 3).map((signal) => signal.title);
  const remaining = signals.length - names.length;

  if (remaining > 0) {
    names.push(`${remaining} more`);
  }

  return names.join(", ");
}

function buildSloErrorBudgetSignal(componentSignals: ProductionReadinessSignal[]) {
  const sloSignals = componentSignals.filter((signal) =>
    SLO_COMPONENT_SIGNAL_IDS.has(signal.id),
  );
  const redSignals = sloSignals.filter((signal) => signal.status === "red");
  const yellowSignals = sloSignals.filter((signal) => signal.status === "yellow");

  if (redSignals.length > 0) {
    return signal({
      id: "slo-error-budgets",
      title: "SLO and error budgets",
      status: "red",
      statusLabel: "Critical",
      value: `${redSignals.length} critical`,
      detail: `Critical SLO signals are burning error budget: ${summarizeSignalTitles(redSignals)}. Targets cover ${SLO_TARGET_SUMMARY}.`,
      nextStep:
        "Declare a critical or high incident based on reader, data, and recovery impact, then follow the SLO runbook before promotion.",
      href: SLO_DOC_URL,
      linkLabel: "Open SLO runbook",
    });
  }

  if (yellowSignals.length > 0) {
    return signal({
      id: "slo-error-budgets",
      title: "SLO and error budgets",
      status: "yellow",
      statusLabel: "High/medium watch",
      value: `${yellowSignals.length} watch`,
      detail: `Watch SLO signals before they burn the monthly ${SLO_MONTHLY_ERROR_BUDGET_MINUTES} minute error budget: ${summarizeSignalTitles(yellowSignals)}.`,
      nextStep:
        "Verify the linked dashboards, classify the condition as high or medium, and open follow-up work if the warning repeats.",
      href: SLO_DOC_URL,
      linkLabel: "Open SLO runbook",
    });
  }

  return signal({
    id: "slo-error-budgets",
    title: "SLO and error budgets",
    status: "green",
    statusLabel: "Within budget",
    value: `${SLO_MONTHLY_AVAILABILITY_TARGET} target`,
    detail: `Core reader, API, Worker, translation, and backup indicators are inside the defined SLO budget. Monthly availability budget is ${SLO_MONTHLY_ERROR_BUDGET_MINUTES} minutes.`,
    nextStep:
      "Keep reviewing external uptime, Lighthouse, worker, translation, and backup reports against the SLO runbook.",
    href: SLO_DOC_URL,
    linkLabel: "Open SLO runbook",
  });
}

function buildBackupFallbackSignal(detail: string) {
  return signal({
    id: "backup-freshness",
    title: "Backup freshness",
    status: "yellow",
    statusLabel: "Verify",
    value: "External",
    detail,
    nextStep: "Open the Supabase Backup workflow, confirm the latest run completed the restore fire drill, and review the uploaded restore report artifact.",
    href: "https://github.com/ramideltoro/nutsnews/actions/workflows/supabase-backup.yml",
    linkLabel: "Open backup workflow",
  });
}

function mapBackupWorkflowRunStatus(run: GitHubWorkflowRun | undefined) {
  if (!run) {
    return {
      name: BACKUP_RESTORE_WORKFLOW.label,
      status: "yellow" as const,
      statusLabel: "Missing",
      githubStatus: "missing",
      conclusion: "missing",
      branch: GITHUB_ACTIONS_BRANCH,
      commitSha: "unknown",
      updatedAt: null,
      href: getRequiredWorkflowHref(BACKUP_RESTORE_WORKFLOW),
      linkLabel: "Open workflow",
      detail: "No Supabase Backup workflow run was returned for the main branch.",
    };
  }

  const status = normalizeWorkflowValue(run.status);
  const conclusion = normalizeWorkflowValue(run.conclusion);
  const href = run.html_url ?? getRequiredWorkflowHref(BACKUP_RESTORE_WORKFLOW);
  const stale = status === "completed" && isWorkflowRunOlderThan(run.updated_at, BACKUP_RESTORE_STALE_HOURS);
  const name = run.name ?? BACKUP_RESTORE_WORKFLOW.label;

  if (status !== "completed") {
    return {
      name,
      status: "yellow" as const,
      statusLabel: status || "Pending",
      githubStatus: status || "unknown",
      conclusion: conclusion || "pending",
      branch: run.head_branch ?? GITHUB_ACTIONS_BRANCH,
      commitSha: run.head_sha ?? "unknown",
      updatedAt: run.updated_at,
      href,
      linkLabel: "Open run",
      detail: "The backup and restore fire drill is queued, in progress, or otherwise not complete.",
    };
  }

  if (conclusion === "success" && !stale) {
    return {
      name,
      status: "green" as const,
      statusLabel: "Verified",
      githubStatus: status,
      conclusion,
      branch: run.head_branch ?? GITHUB_ACTIONS_BRANCH,
      commitSha: run.head_sha ?? "unknown",
      updatedAt: run.updated_at,
      href,
      linkLabel: "Open run",
      detail: "The latest backup workflow exported artifacts, restored them to disposable Supabase, and ran restore validation SQL.",
    };
  }

  if (["failure", "cancelled", "timed_out", "action_required"].includes(conclusion)) {
    return {
      name,
      status: "red" as const,
      statusLabel: "Failed",
      githubStatus: status,
      conclusion,
      branch: run.head_branch ?? GITHUB_ACTIONS_BRANCH,
      commitSha: run.head_sha ?? "unknown",
      updatedAt: run.updated_at,
      href,
      linkLabel: "Open run",
      detail: "The latest backup or disposable restore fire drill failed and must be investigated before trusting the backup.",
    };
  }

  return {
    name,
    status: stale ? ("red" as const) : ("yellow" as const),
    statusLabel: stale ? "Stale" : conclusion || "Verify",
    githubStatus: status,
    conclusion: stale ? `${conclusion || "success"}; stale` : conclusion || "unknown",
    branch: run.head_branch ?? GITHUB_ACTIONS_BRANCH,
    commitSha: run.head_sha ?? "unknown",
    updatedAt: run.updated_at,
    href,
    linkLabel: "Open run",
    detail: stale
      ? `The latest completed backup restore fire drill is older than ${BACKUP_RESTORE_STALE_HOURS} hours.`
      : "The latest backup run was skipped, neutral, startup-failed, or otherwise not a clear success.",
  };
}

async function buildBackupSignal() {
  const token = getGitHubActionsToken();

  if (!token) {
    return buildBackupFallbackSignal(
      "Backup restore status is visible in GitHub Actions, but the admin app cannot query it because ACTIONS_READ_TOKEN is not configured.",
    );
  }

  try {
    const response = await fetch(GITHUB_ACTIONS_RUNS_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: GITHUB_ACTIONS_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      const rateLimited =
        response.status === 403 &&
        response.headers.get("x-ratelimit-remaining") === "0";
      return buildBackupFallbackSignal(
        rateLimited
          ? "Live backup restore status is rate-limited. The admin app preserved the external GitHub Actions fallback."
          : `Live backup restore status is unavailable because GitHub returned HTTP ${response.status}.`,
      );
    }

    const data = (await response.json()) as GitHubWorkflowRunsResponse;
    const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
    const workflow = mapBackupWorkflowRunStatus(
      findLatestWorkflowRun(runs, BACKUP_RESTORE_WORKFLOW),
    );

    return signal({
      id: "backup-freshness",
      title: "Backup freshness",
      status: workflow.status,
      statusLabel: workflow.statusLabel,
      value: workflow.updatedAt ? formatAge(minutesSince(workflow.updatedAt, new Date())) : "Missing",
      detail: workflow.detail,
      nextStep:
        workflow.status === "green"
          ? "Use the linked workflow run and restore report artifact as the latest successful restore-check record."
          : "Open the linked workflow run, inspect the restore fire drill report artifact, and rerun Supabase Backup after fixing the failure.",
      href: workflow.href,
      linkLabel: workflow.linkLabel,
      workflows: [workflow],
    });
  } catch {
    return buildBackupFallbackSignal(
      "Live backup restore status is unavailable because the GitHub API request failed before a response was returned.",
    );
  }
}

function getGitHubActionsToken() {
  return process.env.ACTIONS_READ_TOKEN?.trim() || null;
}

function normalizeWorkflowValue(value: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function matchesRequiredWorkflow(
  run: GitHubWorkflowRun,
  required: GitHubWorkflowRequirement,
) {
  const runName = normalizeWorkflowValue(run.name);
  const runPath = normalizeWorkflowValue(run.path);

  return (
    required.names.some((name) => runName === normalizeWorkflowValue(name)) ||
    required.paths.some((path) => runPath.endsWith(normalizeWorkflowValue(path)))
  );
}

function getRequiredWorkflowHref(required: GitHubWorkflowRequirement) {
  const workflowParts = required.paths[0]?.split("/") ?? [];
  const workflowFile = workflowParts[workflowParts.length - 1];

  if (!workflowFile) {
    return GITHUB_ACTIONS_URL;
  }

  return `${GITHUB_ACTIONS_URL}/workflows/${workflowFile}`;
}

function workflowRunTimestamp(run: GitHubWorkflowRun) {
  return new Date(run.updated_at ?? run.created_at ?? 0).getTime();
}

function findLatestWorkflowRun(
  runs: GitHubWorkflowRun[],
  required: GitHubWorkflowRequirement,
) {
  return runs
    .filter((run) => matchesRequiredWorkflow(run, required))
    .sort((a, b) => workflowRunTimestamp(b) - workflowRunTimestamp(a))[0];
}

function isWorkflowRunOlderThan(updatedAt: string | null, hours: number) {
  if (!updatedAt) {
    return true;
  }

  const updatedTime = new Date(updatedAt).getTime();

  if (Number.isNaN(updatedTime)) {
    return true;
  }

  return Date.now() - updatedTime > hours * 60 * 60 * 1000;
}

function isWorkflowRunStale(updatedAt: string | null) {
  return isWorkflowRunOlderThan(updatedAt, GITHUB_ACTIONS_STALE_HOURS);
}

function mapWorkflowRunStatus(
  required: GitHubWorkflowRequirement,
  run: GitHubWorkflowRun | undefined,
): ProductionReadinessWorkflow {
  if (!run) {
    return {
      name: required.label,
      status: "yellow",
      statusLabel: "Missing",
      githubStatus: "missing",
      conclusion: "missing",
      branch: GITHUB_ACTIONS_BRANCH,
      commitSha: "unknown",
      updatedAt: null,
      href: getRequiredWorkflowHref(required),
      linkLabel: "Open workflow",
      detail: "No matching workflow run was returned for the main branch.",
    };
  }

  const status = normalizeWorkflowValue(run.status);
  const conclusion = normalizeWorkflowValue(run.conclusion);
  const isCompleted = status === "completed";
  const stale = isCompleted && isWorkflowRunStale(run.updated_at);
  const href = run.html_url ?? getRequiredWorkflowHref(required);
  const name = run.name ?? required.label;

  if (!isCompleted) {
    return {
      name,
      status: "yellow",
      statusLabel: status || "Pending",
      githubStatus: status || "unknown",
      conclusion: conclusion || "pending",
      branch: run.head_branch ?? GITHUB_ACTIONS_BRANCH,
      commitSha: run.head_sha ?? "unknown",
      updatedAt: run.updated_at,
      href,
      linkLabel: "Open run",
      detail: "The latest workflow run is queued, in progress, or otherwise not complete.",
    };
  }

  if (conclusion === "success" && !stale) {
    return {
      name,
      status: "green",
      statusLabel: "Passing",
      githubStatus: status,
      conclusion,
      branch: run.head_branch ?? GITHUB_ACTIONS_BRANCH,
      commitSha: run.head_sha ?? "unknown",
      updatedAt: run.updated_at,
      href,
      linkLabel: "Open run",
      detail: "The latest completed run on main passed.",
    };
  }

  if (
    ["failure", "cancelled", "timed_out", "action_required"].includes(
      conclusion,
    )
  ) {
    return {
      name,
      status: "red",
      statusLabel: "Failed",
      githubStatus: status,
      conclusion,
      branch: run.head_branch ?? GITHUB_ACTIONS_BRANCH,
      commitSha: run.head_sha ?? "unknown",
      updatedAt: run.updated_at,
      href,
      linkLabel: "Open run",
      detail: "The latest completed required workflow run needs attention.",
    };
  }

  return {
    name,
    status: "yellow",
    statusLabel: stale ? "Stale" : conclusion || "Verify",
    githubStatus: status,
    conclusion: stale ? `${conclusion || "success"}; stale` : conclusion || "unknown",
    branch: run.head_branch ?? GITHUB_ACTIONS_BRANCH,
    commitSha: run.head_sha ?? "unknown",
    updatedAt: run.updated_at,
    href,
    linkLabel: "Open run",
    detail: stale
      ? `The latest completed run is older than ${GITHUB_ACTIONS_STALE_HOURS} hours.`
      : "The latest completed run was skipped, neutral, startup-failed, or otherwise not a clear success.",
  };
}

function aggregateWorkflowStatus(workflows: ProductionReadinessWorkflow[]) {
  const red = workflows.filter((workflow) => workflow.status === "red").length;
  const yellow = workflows.filter((workflow) => workflow.status === "yellow").length;

  if (red > 0) {
    return {
      status: "red" as const,
      statusLabel: "Failing",
      value: `${red} red`,
      detail: `${red} required GitHub Actions workflow${red === 1 ? "" : "s"} failed, was cancelled, timed out, or requires action.`,
      nextStep: "Open the failing workflow run and inspect failed job logs.",
      href:
        workflows.find((workflow) => workflow.status === "red")?.href ??
        GITHUB_ACTIONS_URL,
    };
  }

  if (yellow > 0) {
    return {
      status: "yellow" as const,
      statusLabel: "Verify",
      value: `${yellow} verify`,
      detail: `${yellow} required GitHub Actions workflow${yellow === 1 ? "" : "s"} is missing, pending, stale, skipped, neutral, rate-limited, or unavailable.`,
      nextStep: "Open GitHub Actions and confirm pending or stale workflows before promotion.",
      href:
        workflows.find((workflow) => workflow.status === "yellow")?.href ??
        GITHUB_ACTIONS_URL,
    };
  }

  return {
    status: "green" as const,
    statusLabel: "Passing",
    value: `${workflows.length}/${workflows.length} green`,
    detail: `All ${workflows.length} required GitHub Actions workflows have latest completed successful runs on main.`,
    nextStep: "If promotion is blocked elsewhere, review GitHub Actions for non-required workflows.",
    href: GITHUB_ACTIONS_URL,
  };
}

function buildCiFallbackSignal(detail: string) {
  return signal({
    id: "ci-status",
    title: "CI status",
    status: "yellow",
    statusLabel: "Verify",
    value: "External",
    detail,
    nextStep: "Open GitHub Actions and confirm Web CI, public smoke, preview smoke, Lighthouse, axe, CodeQL, and security scans are green.",
    href: GITHUB_ACTIONS_URL,
    linkLabel: "Open GitHub Actions",
  });
}

async function buildCiSignal() {
  const token = getGitHubActionsToken();

  if (!token) {
    return buildCiFallbackSignal(
      "GitHub Actions status is not queried from the admin app because ACTIONS_READ_TOKEN is not configured.",
    );
  }

  try {
    const response = await fetch(GITHUB_ACTIONS_RUNS_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: GITHUB_ACTIONS_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      const rateLimited =
        response.status === 403 &&
        response.headers.get("x-ratelimit-remaining") === "0";
      return buildCiFallbackSignal(
        rateLimited
          ? "Live GitHub Actions status is rate-limited. The admin app preserved the external verification fallback."
          : `Live GitHub Actions status is unavailable because GitHub returned HTTP ${response.status}.`,
      );
    }

    const data = (await response.json()) as GitHubWorkflowRunsResponse;
    const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
    const workflows = REQUIRED_GITHUB_WORKFLOWS.map((required) =>
      mapWorkflowRunStatus(required, findLatestWorkflowRun(runs, required)),
    );
    const aggregate = aggregateWorkflowStatus(workflows);

    return signal({
      id: "ci-status",
      title: "CI status",
      status: aggregate.status,
      statusLabel: aggregate.statusLabel,
      value: aggregate.value,
      detail: aggregate.detail,
      nextStep: aggregate.nextStep,
      href: aggregate.href,
      linkLabel: "Open GitHub Actions",
      workflows,
    });
  } catch {
    return buildCiFallbackSignal(
      "Live GitHub Actions status is unavailable because the GitHub API request failed before a response was returned.",
    );
  }
}

async function emptyDashboard(
  errorMessage: string | null,
): Promise<ProductionReadinessDashboardData> {
  const componentSignals = [
    signal({
      id: "configuration",
      title: "Readiness data source",
      status: "yellow",
      statusLabel: "Unconfigured",
      value: "Missing env",
      detail: errorMessage ?? "Production readiness data cannot be loaded.",
      nextStep: "Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for server-side admin readiness checks.",
      href: "/admin/guardrails",
      linkLabel: "Open guardrails",
    }),
    await buildBackupSignal(),
    await buildCiSignal(),
  ];
  const signals = [
    buildSloErrorBudgetSignal(componentSignals),
    ...componentSignals,
  ];
  const summary = summarize(signals);

  return {
    isConfigured: false,
    errorMessage,
    generatedAt: new Date().toISOString(),
    overallStatus: "yellow",
    overallLabel: "Needs verification",
    summary,
    signals,
  };
}

export async function getAdminProductionReadinessDashboardData(): Promise<ProductionReadinessDashboardData> {
  const config = getSupabaseConfig();

  if (!config) {
    return emptyDashboard(
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const client = getServerSupabase();
  const now = new Date();

  try {
    const [
      articleCount,
      publicFeedSnapshotCount,
      recentArticles,
      workerRun,
      articlesLast24Hours,
      articlesLast7Days,
    ] = await Promise.all([
      getExactCount(client, "articles"),
      getExactCount(client, "public_feed_snapshot"),
      loadRecentArticles(client),
      loadWorkerRun(client),
      countArticlesSince(client, 24),
      countArticlesSince(client, 24 * 7),
    ]);
    const { summaries, expectedCount } = await loadRecentSummaries(client, recentArticles);
    const backupSignal = await buildBackupSignal();
    const ciSignal = await buildCiSignal();
    const componentSignals = [
      buildPublicApiSignal({ publicFeedSnapshotCount, recentArticles }),
      buildGracefulDegradationSignal({
        publicFeedSnapshotCount,
        recentArticles,
        workerRun,
        now,
      }),
      buildWorkerSignal(workerRun, now),
      buildDbGrowthSignal({
        articleCount,
        articlesLast24Hours,
        articlesLast7Days,
      }),
      buildTranslationSignal({
        expectedCount,
        availableCount: summaries.length,
      }),
      buildImageSignal(recentArticles),
      backupSignal,
      ciSignal,
    ];
    const signals = [
      buildSloErrorBudgetSignal(componentSignals),
      ...componentSignals,
    ].sort((a, b) => statusRank(b.status) - statusRank(a.status));
    const summary = summarize(signals);
    const overallStatus: ProductionReadinessStatus =
      summary.red > 0 ? "red" : summary.yellow > 0 ? "yellow" : "green";
    const overallLabel =
      overallStatus === "green"
        ? "Ready to ship"
        : overallStatus === "yellow"
          ? "Needs verification"
          : "Do not promote";

    return {
      isConfigured: true,
      errorMessage: null,
      generatedAt: now.toISOString(),
      overallStatus,
      overallLabel,
      summary,
      signals,
    };
  } catch (error) {
    return emptyDashboard(
      error instanceof Error ? error.message : "Unknown readiness load failure.",
    );
  }
}
