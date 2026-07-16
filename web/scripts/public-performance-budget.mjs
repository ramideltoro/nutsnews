#!/usr/bin/env node
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);

const DEFAULT_CONFIG = "public-performance-budget.json";
const DEFAULT_OUTPUT_DIR = "reports/performance-budget";

function parseArgs(argv) {
  const args = {
    configPath: process.env.PUBLIC_PERFORMANCE_BUDGET_CONFIG || DEFAULT_CONFIG,
    outputDir: process.env.PUBLIC_PERFORMANCE_BUDGET_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
    warnOnly: process.env.PUBLIC_PERFORMANCE_BUDGET_WARN_ONLY === "1",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--config" && next) {
      args.configPath = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--config=")) {
      args.configPath = arg.slice("--config=".length);
      continue;
    }

    if (arg === "--output-dir" && next) {
      args.outputDir = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--output-dir=")) {
      args.outputDir = arg.slice("--output-dir=".length);
      continue;
    }

    if (arg === "--warn-only") {
      args.warnOnly = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`NutsNews public performance budget

Usage:
  npm run test:performance-budget
  node scripts/public-performance-budget.mjs --warn-only

This check expects a completed Next.js production build in web/.next.
`);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function readJsonIfExists(filePath, fallback) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeManifestKey(key) {
  return String(key || "")
    .replace(/\\/g, "/")
    .replace(/^app\//, "app/")
    .replace(/\/route$/, "/route")
    .replace(/\/page$/, "/page");
}

function addManifestFiles(fileSet, files) {
  for (const file of Array.isArray(files) ? files : []) {
    if (typeof file === "string" && file.trim()) {
      fileSet.add(file.replace(/^\/+/, "").replace(/\\/g, "/"));
    }
  }
}

function resolveBuiltFile(root, nextDir, relativeFile) {
  const candidates = [
    path.join(nextDir, relativeFile),
    path.join(root, relativeFile),
    path.join(nextDir, relativeFile.replace(/^\.next\//, "")),
  ];
  return candidates.find((candidate) => fsSync.existsSync(candidate) && fsSync.statSync(candidate).isFile());
}

async function addFallbackRouteFiles(nextDir, fileSet, route) {
  const staticDir = path.join(nextDir, "static");
  if (!fsSync.existsSync(staticDir)) return;

  const markers = route.manifestKeys
    .map((key) => normalizeManifestKey(key).replace(/^app\//, ""))
    .filter(Boolean);
  const files = await walk(staticDir);

  for (const fullPath of files) {
    const relative = path.relative(nextDir, fullPath).replace(/\\/g, "/");
    const normalized = relative.toLowerCase();
    if (!normalized.endsWith(".js") && !normalized.endsWith(".css")) continue;
    if (markers.some((marker) => normalized.includes(marker.toLowerCase().replace(/^\//, "")))) {
      fileSet.add(relative);
    }
  }
}

async function collectRouteAssets(root, route) {
  const nextDir = path.join(root, ".next");
  const appBuildManifest = await readJsonIfExists(path.join(nextDir, "app-build-manifest.json"), null);
  const appPathsManifest = await readJsonIfExists(path.join(nextDir, "server", "app-paths-manifest.json"), {});
  const buildManifest = await readJson(path.join(nextDir, "build-manifest.json"));
  const routeKeys = new Set(route.manifestKeys.map(normalizeManifestKey));
  const fileSet = new Set();

  addManifestFiles(fileSet, buildManifest.rootMainFiles);

  if (appBuildManifest) {
    for (const [manifestKey, files] of Object.entries(appBuildManifest.pages || {})) {
      if (routeKeys.has(normalizeManifestKey(manifestKey))) {
        addManifestFiles(fileSet, files);
      }
    }
  }

  for (const [manifestKey, serverFile] of Object.entries(appPathsManifest)) {
    if (routeKeys.has(normalizeManifestKey(manifestKey))) {
      addManifestFiles(fileSet, await collectClientReferenceChunks(nextDir, serverFile));
    }
  }

  if (route.id === "homepage") {
    addManifestFiles(fileSet, buildManifest.pages?.["/"]);
    addManifestFiles(fileSet, buildManifest.pages?.["/_app"]);
  }

  if (!Array.from(fileSet).some((file) => file.endsWith(".js") || file.endsWith(".css"))) {
    await addFallbackRouteFiles(nextDir, fileSet, route);
  }

  const assets = [];
  for (const relativeFile of fileSet) {
    const fullPath = resolveBuiltFile(root, nextDir, relativeFile);
    if (fullPath) {
      assets.push(await statAsset({ relativeFile, fullPath }));
    }
  }

  return assets;
}

async function collectClientReferenceChunks(nextDir, serverFile) {
  const clientReferenceFile = path.join(
    nextDir,
    "server",
    serverFile.replace(/\.js$/, "_client-reference-manifest.js"),
  );
  if (!fsSync.existsSync(clientReferenceFile)) return [];

  const content = await fs.readFile(clientReferenceFile, "utf8");
  const chunks = new Set();
  for (const match of content.matchAll(/"chunks":\s*\[([^\]]*)\]/g)) {
    for (const chunkMatch of match[1].matchAll(/"([^"]+)"/g)) {
      chunks.add(chunkMatch[1].replace(/^\/_next\//, ""));
    }
  }
  return [...chunks];
}

async function statAsset(asset) {
  const buffer = await fs.readFile(asset.fullPath);
  return {
    ...asset,
    type: assetType(asset.relativeFile),
    rawBytes: buffer.length,
    gzipBytes: zlib.gzipSync(buffer, { level: 9 }).length,
    brotliBytes: zlib.brotliCompressSync(buffer, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      },
    }).length,
  };
}

function assetType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".js" || extension === ".mjs") return "js";
  if (extension === ".css") return "css";
  return "other";
}

function sumByType(assets, type) {
  return assets
    .filter((asset) => asset.type === type)
    .reduce((total, asset) => total + asset.gzipBytes, 0);
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function metricLabel(metric) {
  return metric
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .replace("Java Script", "JavaScript")
    .replace("Css", "CSS")
    .replace("Gzip", "gzip")
    .replace("Bytes", "bytes");
}

function compareMetric(route, metric, value, budget) {
  if (!budget || !Number.isFinite(value)) {
    return { id: route.id, label: route.label, metric, value, status: "missing", budget };
  }
  if (Number.isFinite(budget.fail) && value > budget.fail) {
    return { id: route.id, label: route.label, metric, value, status: "fail", budget };
  }
  if (Number.isFinite(budget.warn) && value > budget.warn) {
    return { id: route.id, label: route.label, metric, value, status: "warn", budget };
  }
  if (Number.isFinite(budget.target) && value > budget.target) {
    return { id: route.id, label: route.label, metric, value, status: "watch", budget };
  }
  return { id: route.id, label: route.label, metric, value, status: "pass", budget };
}

function annotationForResult(result) {
  const value = formatBytes(result.value);
  const fail = result.budget?.fail ? formatBytes(result.budget.fail) : "n/a";
  const warn = result.budget?.warn ? formatBytes(result.budget.warn) : "n/a";
  const title = `${result.label} ${metricLabel(result.metric)}`;

  if (result.status === "fail") {
    return `::error title=Public performance budget::${title} is ${value}; hard limit is ${fail}.`;
  }
  if (result.status === "warn") {
    return `::warning title=Public performance budget::${title} is ${value}; warning limit is ${warn}.`;
  }
  if (result.status === "watch") {
    return `::notice title=Public performance budget::${title} is ${value}; above target but below warning/fail limits.`;
  }
  return null;
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label} is missing required value: ${needle}`);
  }
}

function validateLighthouseConfig(root, expected) {
  const lighthouseConfig = require(path.join(root, "lighthouserc.js"));
  const collect = lighthouseConfig?.ci?.collect || {};
  const assertions = lighthouseConfig?.ci?.assert?.assertions || {};
  const urls = new Set(collect.url || []);
  const problems = [];

  for (const url of expected.requiredUrls || []) {
    if (!urls.has(url)) problems.push(`Lighthouse CI is missing required URL ${url}`);
  }

  const checks = [
    ["categories:performance", expected.performanceWarnScore, 1],
    ["largest-contentful-paint", expected.largestContentfulPaintWarnMs, 1],
    ["total-blocking-time", expected.totalBlockingTimeWarnMs, 1],
    ["cumulative-layout-shift", expected.cumulativeLayoutShiftWarn, 1],
    ["server-response-time", expected.serverResponseTimeWarnMs, 1],
  ];

  for (const [auditId, expectedValue, optionIndex] of checks) {
    const assertion = assertions[auditId];
    const actual = Array.isArray(assertion) ? assertion[optionIndex] : null;
    const values = actual && typeof actual === "object" ? Object.values(actual) : [];
    if (!values.includes(expectedValue)) {
      problems.push(`Lighthouse CI assertion ${auditId} must include ${expectedValue}`);
    }
  }

  return problems;
}

async function validateImageOptimizer(root, expected) {
  const nextConfig = await fs.readFile(path.join(root, "next.config.ts"), "utf8");
  const problems = [];

  for (const format of expected.formats || []) {
    if (!nextConfig.includes(`"${format}"`)) {
      problems.push(`next.config.ts image formats must include ${format}`);
    }
  }

  const scalarChecks = [
    ["maximumResponseBody", expected.maximumResponseBodyBytes],
    ["minimumCacheTTL", expected.minimumCacheTtlSeconds],
  ];

  for (const [key, value] of scalarChecks) {
    const compact = String(value).replace(/(\d)(?=(\d{3})+$)/g, "$1_");
    if (!nextConfig.includes(`${key}: ${value}`) && !nextConfig.includes(`${key}: ${compact}`)) {
      problems.push(`next.config.ts images.${key} must be ${value}`);
    }
  }

  if (Number.isFinite(expected.maximumQuality)) {
    const matches = [...nextConfig.matchAll(/qualities:\s*\[([^\]]+)\]/g)];
    const qualityValues = matches.flatMap((match) => match[1].split(",").map((value) => Number(value.trim())).filter(Number.isFinite));
    if (qualityValues.length === 0 || Math.max(...qualityValues) > expected.maximumQuality) {
      problems.push(`next.config.ts images.qualities must not exceed ${expected.maximumQuality}`);
    }
  }

  const countChecks = [
    ["deviceSizes", expected.maximumDeviceSizeCount],
    ["imageSizes", expected.maximumImageSizeCount],
  ];

  for (const [key, maxCount] of countChecks) {
    if (!Number.isFinite(maxCount)) continue;
    const match = nextConfig.match(new RegExp(`${key}:\\s*\\[([^\\]]+)\\]`));
    const count = match ? match[1].split(",").map((value) => value.trim()).filter(Boolean).length : 0;
    if (count === 0 || count > maxCount) {
      problems.push(`next.config.ts images.${key} must define at most ${maxCount} entries`);
    }
  }

  assertIncludes(nextConfig, "PUBLIC_PAGE_CACHE_CONTROL", "next.config.ts public page cache policy");
  assertIncludes(nextConfig, "source: \"/articles/:path*\"", "next.config.ts article cache policy");

  return problems;
}

function buildMarkdownReport(report) {
  const lines = [
    "# NutsNews Public Performance Budget Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Route Budgets",
    "",
    "| Route | Metric | Value | Target | Warn | Fail | Status |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const result of report.results) {
    lines.push([
      `| ${result.label}`,
      metricLabel(result.metric),
      formatBytes(result.value),
      result.budget?.target ? formatBytes(result.budget.target) : "n/a",
      result.budget?.warn ? formatBytes(result.budget.warn) : "n/a",
      result.budget?.fail ? formatBytes(result.budget.fail) : "n/a",
      result.status,
      "|",
    ].join(" | "));
  }

  lines.push("", "## Route Assets", "");
  for (const route of report.routes) {
    lines.push(`### ${route.label}`, "", "| File | Type | Raw | gzip | Brotli |", "| --- | --- | ---: | ---: | ---: |");
    for (const asset of route.assets) {
      lines.push(`| \`${asset.relativeFile}\` | ${asset.type} | ${formatBytes(asset.rawBytes)} | ${formatBytes(asset.gzipBytes)} | ${formatBytes(asset.brotliBytes)} |`);
    }
    lines.push("");
  }

  lines.push("## Guardrail Checks", "");
  lines.push(report.guardrailProblems.length === 0 ? "All Lighthouse and image optimizer guardrails passed." : report.guardrailProblems.map((problem) => `- ${problem}`).join("\n"));
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const configPath = path.resolve(root, args.configPath);
  const outputDir = path.resolve(root, args.outputDir);
  const config = await readJson(configPath);

  if (!fsSync.existsSync(path.join(root, ".next", "build-manifest.json"))) {
    throw new Error("No Next.js build manifest found. Run `npm run build` before `npm run test:performance-budget`.");
  }

  const routeReports = [];
  const results = [];

  for (const route of config.routes || []) {
    const assets = await collectRouteAssets(root, route);
    const jsAssets = assets.filter((asset) => asset.type === "js");
    const cssAssets = assets.filter((asset) => asset.type === "css");
    if (jsAssets.length === 0) {
      throw new Error(`${route.label} has no JavaScript assets in the Next.js build manifest.`);
    }

    const metrics = {
      initialJavaScriptGzipBytes: sumByType(assets, "js"),
      initialCssGzipBytes: sumByType(assets, "css"),
      totalInitialTransferGzipBytes: jsAssets.concat(cssAssets).reduce((total, asset) => total + asset.gzipBytes, 0),
    };

    routeReports.push({
      id: route.id,
      label: route.label,
      metrics,
      assets: [...assets].sort((a, b) => b.gzipBytes - a.gzipBytes),
    });

    for (const [metric, value] of Object.entries(metrics)) {
      results.push(compareMetric(route, metric, value, route[metric]));
    }
  }

  const guardrailProblems = [
    ...validateLighthouseConfig(root, config.lighthouse || {}),
    ...(await validateImageOptimizer(root, config.imageOptimizer || {})),
  ];

  await fs.mkdir(outputDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    configPath: path.relative(root, configPath),
    config,
    routes: routeReports,
    results,
    guardrailProblems,
  };

  await fs.writeFile(path.join(outputDir, "public-performance-budget.json"), `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(path.join(outputDir, "public-performance-budget.md"), buildMarkdownReport(report));

  console.log("\nNutsNews public performance budget");
  for (const result of results) {
    console.log(`- ${result.label} ${metricLabel(result.metric)}: ${formatBytes(result.value)} (${result.status})`);
    const annotation = annotationForResult(result);
    if (annotation) console.log(annotation);
  }

  for (const problem of guardrailProblems) {
    console.log(`::error title=Public performance guardrail::${problem}`);
  }

  console.log(`\nReport written to ${path.relative(root, outputDir)}/public-performance-budget.md`);

  const failed = results.some((result) => result.status === "fail") || guardrailProblems.length > 0;
  if (failed && !args.warnOnly) {
    throw new Error("Public performance budget failed. Review the report and either fix the regression or intentionally update the budget.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
