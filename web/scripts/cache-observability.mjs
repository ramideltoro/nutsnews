#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const configPath = path.join(webRoot, "cache-observability.config.json");
const defaultReportDir = path.join(webRoot, "reports", "cache-observability");

function parseArgs(argv) {
  const args = {
    mode: "live",
    url: process.env.NUTSNEWS_CACHE_OBSERVABILITY_URL || "",
    articlePath: process.env.NUTSNEWS_CACHE_ARTICLE_PATH || "",
    outputDir: process.env.NUTSNEWS_CACHE_OBSERVABILITY_REPORT_DIR || defaultReportDir,
    warnOnly: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--mode") {
      args.mode = argv[++index] || args.mode;
    } else if (arg.startsWith("--mode=")) {
      args.mode = arg.slice("--mode=".length);
    } else if (arg === "--url") {
      args.url = argv[++index] || args.url;
    } else if (arg.startsWith("--url=")) {
      args.url = arg.slice("--url=".length);
    } else if (arg === "--article-path") {
      args.articlePath = argv[++index] || args.articlePath;
    } else if (arg.startsWith("--article-path=")) {
      args.articlePath = arg.slice("--article-path=".length);
    } else if (arg === "--output-dir") {
      args.outputDir = argv[++index] || args.outputDir;
    } else if (arg.startsWith("--output-dir=")) {
      args.outputDir = arg.slice("--output-dir=".length);
    } else if (arg === "--warn-only") {
      args.warnOnly = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`NutsNews cache observability\n\nUsage:\n  npm run audit:cache -- --url https://www.nutsnews.com\n  npm run audit:cache:config\n\nOptions:\n  --mode live|config       Run live header checks or config validation only.\n  --url <url>              Base URL to inspect. Defaults to NUTSNEWS_CACHE_OBSERVABILITY_URL or config default.\n  --article-path <path>    Optional known article path, for example /articles/<id>.\n  --output-dir <dir>       Report output directory.\n  --warn-only              Do not exit non-zero when live regressions are found.\n  --json                   Print the JSON report to stdout.\n`);
}

async function readConfig() {
  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw);
}

function normalizeBaseUrl(value) {
  const base = String(value || "").trim().replace(/\/+$/, "");

  if (!base) {
    throw new Error("A base URL is required. Use --url or NUTSNEWS_CACHE_OBSERVABILITY_URL.");
  }

  const parsed = new URL(base);

  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  return parsed.toString().replace(/\/+$/, "");
}

function toUrl(baseUrl, routePath) {
  if (/^https?:\/\//i.test(routePath)) {
    return routePath;
  }

  const pathValue = routePath.startsWith("/") ? routePath : `/${routePath}`;
  return `${baseUrl}${pathValue}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function headerObject(headers) {
  const values = {};

  for (const [key, value] of headers.entries()) {
    values[key.toLowerCase()] = value;
  }

  return values;
}

function includesToken(value, token) {
  return String(value || "").toLowerCase().includes(String(token).toLowerCase());
}

function getHeader(headers, name) {
  return headers[String(name).toLowerCase()] || "";
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getArticlesFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.articles)) {
    return payload.articles;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

async function discoverArticlePath({ baseUrl, config, articlePath }) {
  if (articlePath) {
    return articlePath.startsWith("/") ? articlePath : `/${articlePath}`;
  }

  const url = toUrl(baseUrl, "/api/articles?limit=1");
  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        "user-agent": config.defaults.userAgent,
        accept: "application/json",
      },
      cache: "no-store",
    },
    config.defaults.timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`Article discovery failed: ${response.status} ${response.statusText}`);
  }

  const payload = await readResponseBody(response);
  const article = getArticlesFromPayload(payload)[0];

  if (!article?.id) {
    throw new Error("Article discovery failed: /api/articles returned no article id.");
  }

  return `/articles/${encodeURIComponent(String(article.id))}`;
}

function validateConfig(config) {
  const failures = [];
  const warnings = [];

  if (!config.version) {
    failures.push("Missing config version.");
  }

  if (!Array.isArray(config.routes) || config.routes.length === 0) {
    failures.push("Config must include at least one route.");
  }

  const keys = new Set();

  for (const route of config.routes || []) {
    if (!route.key) {
      failures.push("Every route must have a key.");
    } else if (keys.has(route.key)) {
      failures.push(`Duplicate route key: ${route.key}`);
    } else {
      keys.add(route.key);
    }

    if (!route.label) {
      failures.push(`Route ${route.key || "<unknown>"} is missing a label.`);
    }

    if (!route.path) {
      failures.push(`Route ${route.key || "<unknown>"} is missing a path.`);
    }

    if (!route.expectedPolicy) {
      failures.push(`Route ${route.key || "<unknown>"} is missing expectedPolicy.`);
    }

    if (!Array.isArray(route.expectedStatuses) || route.expectedStatuses.length === 0) {
      failures.push(`Route ${route.key || "<unknown>"} must include expectedStatuses.`);
    }

    if (route.key === "articles-api" && route.expectedPolicy !== "public-api-cache-300s") {
      failures.push("The articles API must keep expectedPolicy=public-api-cache-300s.");
    }

    if (route.discoverArticleFromApi && route.key !== "article-page") {
      warnings.push(`Route ${route.key} discovers articles from the API; verify this is intentional.`);
    }
  }

  return { failures, warnings };
}

function evaluateRoute({ route, samples, resolvedPath, requiredHeaders, forbiddenTokens }) {
  const failures = [];
  const warnings = [];
  const lastSample = samples[samples.length - 1];
  const headers = lastSample?.headers || {};
  const cacheControl = getHeader(headers, "cache-control");
  const cdnCacheControl = getHeader(headers, "cdn-cache-control");
  const cloudflareCdnCacheControl = getHeader(headers, "cloudflare-cdn-cache-control");
  const vercelCdnCacheControl = getHeader(headers, "vercel-cdn-cache-control");
  const policy = getHeader(headers, "x-nutsnews-cache-policy");

  if (!lastSample) {
    failures.push("No response samples were collected.");
  }

  for (const sample of samples) {
    if (!route.expectedStatuses.includes(sample.status)) {
      failures.push(`Unexpected HTTP status ${sample.status} on sample ${sample.sample}.`);
    }
  }

  const routeRequiredHeaders = route.requiredHeaders || requiredHeaders;

  for (const header of routeRequiredHeaders) {
    if (!getHeader(headers, header)) {
      failures.push(`Missing required header: ${header}.`);
    }
  }

  if (policy && policy !== route.expectedPolicy) {
    failures.push(`Expected x-nutsnews-cache-policy=${route.expectedPolicy}, got ${policy}.`);
  }

  for (const token of forbiddenTokens) {
    if (includesToken(cacheControl, token)) {
      failures.push(`cache-control includes forbidden token: ${token}.`);
    }
  }

  for (const token of route.expectedCacheIncludes || []) {
    if (!includesToken(cacheControl, token)) {
      failures.push(`cache-control does not include ${token}.`);
    }
  }

  for (const token of route.expectedCdnIncludes || []) {
    if (!includesToken(cdnCacheControl, token)) {
      failures.push(`cdn-cache-control does not include ${token}.`);
    }

    if (!includesToken(cloudflareCdnCacheControl, token)) {
      failures.push(`cloudflare-cdn-cache-control does not include ${token}.`);
    }

    if (!includesToken(vercelCdnCacheControl, token)) {
      failures.push(`vercel-cdn-cache-control does not include ${token}.`);
    }
  }

  const cfStatuses = samples
    .map((sample) => getHeader(sample.headers, "cf-cache-status"))
    .filter(Boolean)
    .map((status) => status.toUpperCase());
  const hitCount = cfStatuses.filter((status) => status === "HIT").length;
  const cloudflareHitRate = cfStatuses.length > 0 ? hitCount / cfStatuses.length : null;

  if (cfStatuses.length === 0) {
    warnings.push("cf-cache-status was not observed. This is normal on local/Vercel preview checks before Cloudflare.");
  } else if (route.key === "articles-api" && cfStatuses.every((status) => status === "BYPASS" || status === "DYNAMIC")) {
    failures.push(`/api/articles returned only non-cache statuses: ${cfStatuses.join(", ")}.`);
  } else if (cloudflareHitRate !== null && cloudflareHitRate === 0) {
    warnings.push(`Cloudflare was observed but no HIT samples were seen: ${cfStatuses.join(", ")}.`);
  }

  const result = failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass";

  return {
    key: route.key,
    label: route.label,
    description: route.description || "",
    urlPath: resolvedPath,
    expectedPolicy: route.expectedPolicy,
    result,
    failures,
    warnings,
    status: lastSample?.status ?? 0,
    headers: {
      "cache-control": cacheControl,
      "cdn-cache-control": cdnCacheControl,
      "cloudflare-cdn-cache-control": cloudflareCdnCacheControl,
      "vercel-cdn-cache-control": vercelCdnCacheControl,
      "x-nutsnews-cache-policy": policy,
      "x-nutsnews-article-data-source": getHeader(headers, "x-nutsnews-article-data-source"),
      "x-nutsnews-feed-snapshot": getHeader(headers, "x-nutsnews-feed-snapshot"),
      "cf-cache-status": getHeader(headers, "cf-cache-status"),
      age: getHeader(headers, "age"),
    },
    samples: samples.map((sample) => ({
      sample: sample.sample,
      status: sample.status,
      headers: {
        "cf-cache-status": getHeader(sample.headers, "cf-cache-status"),
        age: getHeader(sample.headers, "age"),
        "x-vercel-cache": getHeader(sample.headers, "x-vercel-cache"),
      },
    })),
    cloudflare: {
      statuses: cfStatuses,
      hitCount,
      sampleCount: cfStatuses.length,
      hitRate: cloudflareHitRate,
    },
  };
}

async function collectRouteSamples({ baseUrl, route, resolvedPath, config }) {
  const samples = [];
  const url = toUrl(baseUrl, resolvedPath);
  const method = route.method || "HEAD";

  for (let sample = 1; sample <= config.defaults.sampleCount; sample += 1) {
    const response = await fetchWithTimeout(
      url,
      {
        method,
        redirect: "manual",
        headers: {
          "user-agent": config.defaults.userAgent,
          accept: "*/*",
          "cache-control": "",
          pragma: "",
        },
        cache: "no-store",
      },
      config.defaults.timeoutMs,
    );

    samples.push({
      sample,
      status: response.status,
      statusText: response.statusText,
      headers: headerObject(response.headers),
    });

    if (sample < config.defaults.sampleCount) {
      await delay(config.defaults.sampleDelayMs);
    }
  }

  return samples;
}

async function runLiveAudit({ config, baseUrl, articlePath }) {
  const routeResults = [];
  let discoveredArticlePath = "";

  for (const route of config.routes) {
    let resolvedPath = route.path;

    if (route.discoverArticleFromApi) {
      try {
        discoveredArticlePath = await discoverArticlePath({
          baseUrl,
          config,
          articlePath,
        });
        resolvedPath = discoveredArticlePath;
      } catch (error) {
        routeResults.push({
          key: route.key,
          label: route.label,
          description: route.description || "",
          urlPath: route.path,
          expectedPolicy: route.expectedPolicy,
          result: "fail",
          failures: [error instanceof Error ? error.message : String(error)],
          warnings: [],
          status: 0,
          headers: {},
          samples: [],
          cloudflare: {
            statuses: [],
            hitCount: 0,
            sampleCount: 0,
            hitRate: null,
          },
        });
        continue;
      }
    }

    try {
      const samples = await collectRouteSamples({
        baseUrl,
        route,
        resolvedPath,
        config,
      });

      routeResults.push(
        evaluateRoute({
          route,
          samples,
          resolvedPath,
          requiredHeaders: config.defaults.requiredHeaders,
          forbiddenTokens: config.defaults.forbiddenCacheControlTokens,
        }),
      );
    } catch (error) {
      routeResults.push({
        key: route.key,
        label: route.label,
        description: route.description || "",
        urlPath: resolvedPath,
        expectedPolicy: route.expectedPolicy,
        result: "fail",
        failures: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        status: 0,
        headers: {},
        samples: [],
        cloudflare: {
          statuses: [],
          hitCount: 0,
          sampleCount: 0,
          hitRate: null,
        },
      });
    }
  }

  const failedCount = routeResults.filter((result) => result.result === "fail").length;
  const warningCount = routeResults.filter((result) => result.result === "warn").length;
  const passedCount = routeResults.filter((result) => result.result === "pass").length;
  const cfStatuses = routeResults.flatMap((result) => result.cloudflare.statuses);
  const cfHitCount = cfStatuses.filter((status) => status === "HIT").length;

  return {
    generatedAt: new Date().toISOString(),
    mode: "live",
    baseUrl,
    discoveredArticlePath,
    summary: {
      status: failedCount > 0 ? "fail" : warningCount > 0 ? "warn" : "pass",
      routeCount: routeResults.length,
      passedCount,
      warningCount,
      failedCount,
      cloudflareSampleCount: cfStatuses.length,
      cloudflareHitCount: cfHitCount,
      cloudflareHitRate: cfStatuses.length > 0 ? cfHitCount / cfStatuses.length : null,
      cloudflareStatuses: cfStatuses,
    },
    routes: routeResults,
  };
}

function formatPercent(value) {
  if (value === null || typeof value !== "number") {
    return "n/a";
  }

  return `${Math.round(value * 100)}%`;
}

function mdCell(value) {
  return String(value || "")
    .replace(/\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim() || "—";
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Cloudflare Cache Observability Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Base URL: ${report.baseUrl || "config only"}`);
  lines.push(`Overall status: **${report.summary.status.toUpperCase()}**`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | ---: |");
  lines.push(`| Routes checked | ${report.summary.routeCount} |`);
  lines.push(`| Passed | ${report.summary.passedCount} |`);
  lines.push(`| Warnings | ${report.summary.warningCount} |`);
  lines.push(`| Failed | ${report.summary.failedCount} |`);
  lines.push(`| Cloudflare samples | ${report.summary.cloudflareSampleCount ?? 0} |`);
  lines.push(`| Cloudflare HIT samples | ${report.summary.cloudflareHitCount ?? 0} |`);
  lines.push(`| Cloudflare HIT rate | ${formatPercent(report.summary.cloudflareHitRate ?? null)} |`);
  lines.push("");

  if (report.discoveredArticlePath) {
    lines.push(`Discovered article path: \`${report.discoveredArticlePath}\``);
    lines.push("");
  }

  lines.push("## Route cache policy matrix");
  lines.push("");
  lines.push("| Result | Route | Path | HTTP | Expected policy | Actual policy | Cache-Control | CDN Cache | CF status samples |");
  lines.push("| --- | --- | --- | ---: | --- | --- | --- | --- | --- |");

  for (const route of report.routes) {
    lines.push(
      `| ${mdCell(route.result)} | ${mdCell(route.label)} | \`${mdCell(route.urlPath)}\` | ${route.status || "—"} | \`${mdCell(route.expectedPolicy)}\` | \`${mdCell(route.headers?.["x-nutsnews-cache-policy"])}\` | \`${mdCell(route.headers?.["cache-control"])}\` | \`${mdCell(route.headers?.["cdn-cache-control"])}\` | ${mdCell(route.cloudflare?.statuses?.join(", "))} |`,
    );
  }

  lines.push("");
  lines.push("## Findings");
  lines.push("");

  for (const route of report.routes) {
    lines.push(`### ${route.label}`);
    lines.push("");
    lines.push(`Path: \`${route.urlPath}\``);
    lines.push(`Expected policy: \`${route.expectedPolicy}\``);
    lines.push(`Actual policy: \`${route.headers?.["x-nutsnews-cache-policy"] || "missing"}\``);
    lines.push("");

    if (route.failures.length === 0 && route.warnings.length === 0) {
      lines.push("No findings.");
    } else {
      for (const failure of route.failures) {
        lines.push(`- ❌ ${failure}`);
      }

      for (const warning of route.warnings) {
        lines.push(`- ⚠️ ${warning}`);
      }
    }

    lines.push("");
  }

  lines.push("## Headers captured");
  lines.push("");

  for (const route of report.routes) {
    lines.push(`### ${route.label}`);
    lines.push("");
    lines.push("```text");
    for (const [key, value] of Object.entries(route.headers || {})) {
      if (value) {
        lines.push(`${key}: ${value}`);
      }
    }
    lines.push("```");
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function writeAnnotations(report) {
  for (const route of report.routes || []) {
    for (const failure of route.failures || []) {
      console.log(`::error title=Cache observability ${route.label}::${failure}`);
    }

    for (const warning of route.warnings || []) {
      console.log(`::warning title=Cache observability ${route.label}::${warning}`);
    }
  }
}

async function writeReports(report, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "cache-observability.json");
  const mdPath = path.join(outputDir, "cache-observability.md");

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, renderMarkdown(report));

  return { jsonPath, mdPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await readConfig();
  const validation = validateConfig(config);

  if (args.mode === "config") {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: "config",
      baseUrl: "",
      discoveredArticlePath: "",
      summary: {
        status: validation.failures.length > 0 ? "fail" : validation.warnings.length > 0 ? "warn" : "pass",
        routeCount: config.routes.length,
        passedCount: validation.failures.length === 0 ? config.routes.length : 0,
        warningCount: validation.warnings.length,
        failedCount: validation.failures.length,
        cloudflareSampleCount: 0,
        cloudflareHitCount: 0,
        cloudflareHitRate: null,
        cloudflareStatuses: [],
      },
      routes: config.routes.map((route) => ({
        key: route.key,
        label: route.label,
        description: route.description || "",
        urlPath: route.path,
        expectedPolicy: route.expectedPolicy,
        result: validation.failures.length > 0 ? "fail" : "pass",
        failures: validation.failures.filter((failure) => failure.includes(route.key)),
        warnings: validation.warnings.filter((warning) => warning.includes(route.key)),
        status: 0,
        headers: {},
        samples: [],
        cloudflare: {
          statuses: [],
          hitCount: 0,
          sampleCount: 0,
          hitRate: null,
        },
      })),
    };

    const paths = await writeReports(report, args.outputDir);
    writeAnnotations(report);

    console.log("NutsNews cache observability config check");
    console.log(`Routes configured: ${config.routes.length}`);
    console.log(`Report written to ${paths.mdPath}`);

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    }

    if (validation.failures.length > 0 && !args.warnOnly) {
      process.exit(1);
    }

    return;
  }

  if (args.mode !== "live") {
    throw new Error(`Unsupported mode: ${args.mode}`);
  }

  if (validation.failures.length > 0) {
    for (const failure of validation.failures) {
      console.error(`Config error: ${failure}`);
    }
    process.exit(1);
  }

  const baseUrl = normalizeBaseUrl(args.url || config.defaultBaseUrl);
  const report = await runLiveAudit({
    config,
    baseUrl,
    articlePath: args.articlePath,
  });
  const paths = await writeReports(report, args.outputDir);

  console.log("NutsNews Cloudflare cache observability");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Status: ${report.summary.status}`);
  console.log(`Passed: ${report.summary.passedCount}`);
  console.log(`Warnings: ${report.summary.warningCount}`);
  console.log(`Failed: ${report.summary.failedCount}`);
  console.log(`Cloudflare HIT rate: ${formatPercent(report.summary.cloudflareHitRate)}`);
  console.log(`Report written to ${paths.mdPath}`);

  for (const route of report.routes) {
    const statusLabel = route.result.toUpperCase().padEnd(4, " ");
    const cfStatus = route.cloudflare.statuses.join(",") || "no-cf-status";
    console.log(`- ${statusLabel} ${route.label}: ${route.status || "n/a"} ${route.headers["x-nutsnews-cache-policy"] || "missing-policy"} (${cfStatus})`);
  }

  writeAnnotations(report);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  }

  if (report.summary.failedCount > 0 && !args.warnOnly) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
