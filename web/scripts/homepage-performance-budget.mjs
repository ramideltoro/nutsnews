#!/usr/bin/env node
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DEFAULT_CONFIG = 'performance-budget.json';
const DEFAULT_OUTPUT_DIR = 'reports/performance-budget';
const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const ROUTE_MANIFEST_KEYS = new Set(['/', '/page', 'app/page', 'app/(home)/page']);

function parseArgs(argv) {
  const args = {
    configPath: process.env.PERFORMANCE_BUDGET_CONFIG || DEFAULT_CONFIG,
    outputDir: process.env.PERFORMANCE_BUDGET_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
    warnOnly: process.env.PERFORMANCE_BUDGET_WARN_ONLY === '1',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--config' && next) {
      args.configPath = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--config=')) {
      args.configPath = arg.slice('--config='.length);
      continue;
    }

    if (arg === '--output-dir' && next) {
      args.outputDir = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--output-dir=')) {
      args.outputDir = arg.slice('--output-dir='.length);
      continue;
    }

    if (arg === '--warn-only') {
      args.warnOnly = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`NutsNews homepage performance budget\n\nUsage:\n  npm run analyze:homepage\n  node scripts/homepage-performance-budget.mjs --warn-only\n\nEnvironment variables:\n  PERFORMANCE_BUDGET_CONFIG      Budget config path. Defaults to performance-budget.json\n  PERFORMANCE_BUDGET_OUTPUT_DIR  Report folder. Defaults to reports/performance-budget\n  PERFORMANCE_BUDGET_WARN_ONLY   Set to 1 to never exit non-zero\n`);
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (fallback !== null && error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeRouteKey(key) {
  return String(key || '')
    .replace(/\\/g, '/')
    .replace(/^app\//, 'app/')
    .replace(/\/page$/, '/page')
    .replace(/\/route$/, '/route');
}

function isHomepageManifestKey(key) {
  const normalized = normalizeRouteKey(key);
  if (ROUTE_MANIFEST_KEYS.has(normalized)) return true;
  if (normalized.endsWith('/page') && normalized.replace(/^app/, '') === '/page') return true;
  return false;
}

function addManifestFiles(fileSet, files) {
  for (const file of asArray(files)) {
    if (typeof file === 'string' && file.trim()) {
      fileSet.add(file.replace(/^\/+/, '').replace(/\\/g, '/'));
    }
  }
}

async function collectHomepageRouteFiles(root) {
  const nextDir = path.join(root, '.next');
  const fileSet = new Set();

  const buildManifest = await readJson(path.join(nextDir, 'build-manifest.json'), {});
  addManifestFiles(fileSet, buildManifest.rootMainFiles);
  addManifestFiles(fileSet, buildManifest.pages?.['/']);
  addManifestFiles(fileSet, buildManifest.pages?.['/_app']);

  const appBuildManifest = await readJson(path.join(nextDir, 'app-build-manifest.json'), {});
  for (const [routeKey, files] of Object.entries(appBuildManifest.pages || {})) {
    if (isHomepageManifestKey(routeKey)) {
      addManifestFiles(fileSet, files);
    }
  }


  if (!Array.from(fileSet).some((file) => file.endsWith('.js') || file.endsWith('.css'))) {
    await addFallbackAppAssets(nextDir, fileSet);
  }

  const resolved = [];
  for (const relativeFile of fileSet) {
    const candidates = [
      path.join(nextDir, relativeFile),
      path.join(root, relativeFile),
      path.join(nextDir, relativeFile.replace(/^\.next\//, '')),
    ];

    const fullPath = candidates.find((candidate) => fsSync.existsSync(candidate) && fsSync.statSync(candidate).isFile());
    if (fullPath) {
      resolved.push({ relativeFile, fullPath });
    }
  }

  return resolved;
}

async function addFallbackAppAssets(nextDir, fileSet) {
  const staticDir = path.join(nextDir, 'static');
  if (!fsSync.existsSync(staticDir)) return;

  const files = await walk(staticDir);
  for (const fullPath of files) {
    const relative = path.relative(nextDir, fullPath).replace(/\\/g, '/');
    const normalized = relative.toLowerCase();
    if (!normalized.endsWith('.js') && !normalized.endsWith('.css')) continue;
    if (
      normalized.includes('/chunks/app/page') ||
      normalized.includes('/chunks/app/layout') ||
      normalized.includes('/css/')
    ) {
      fileSet.add(relative);
    }
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
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
  if (extension === '.js' || extension === '.mjs') return 'js';
  if (extension === '.css') return 'css';
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  return 'other';
}

async function collectHomepageStaticImages(root) {
  const sourceFiles = [
    path.join(root, 'app/page.tsx'),
    path.join(root, 'app/components/ArticleFeed.tsx'),
    path.join(root, 'app/components/OptimizedArticleImage.tsx'),
  ];
  const imagePaths = new Set();

  for (const filePath of sourceFiles) {
    if (!fsSync.existsSync(filePath)) continue;
    const content = await fs.readFile(filePath, 'utf8');
    const imageMatches = content.matchAll(/["'`]\/(?!\/)([^"'`]+?\.(?:avif|gif|ico|jpe?g|png|svg|webp))(?:\?[^"'`]*)?["'`]/gi);
    for (const match of imageMatches) {
      imagePaths.add(match[1]);
    }
  }

  const assets = [];
  for (const publicPath of imagePaths) {
    const candidates = [
      path.join(root, 'public', publicPath),
      path.join(root, 'app', publicPath),
    ];
    const fullPath = candidates.find((candidate) => fsSync.existsSync(candidate) && fsSync.statSync(candidate).isFile());
    if (fullPath) {
      assets.push(await statAsset({ relativeFile: `/${publicPath}`, fullPath }));
    }
  }

  return assets;
}

function sumByType(assets, type, key = 'gzipBytes') {
  return assets
    .filter((asset) => asset.type === type)
    .reduce((total, asset) => total + asset[key], 0);
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function formatMetricValue(metric, value) {
  if (metric.endsWith('Ms')) return `${value} ms`;
  return formatBytes(value);
}

function compareMetric(metric, value, budget) {
  if (!budget || !Number.isFinite(value)) {
    return { metric, value, status: 'missing', budget };
  }

  if (Number.isFinite(budget.fail) && value > budget.fail) {
    return { metric, value, status: 'fail', budget };
  }

  if (Number.isFinite(budget.warn) && value > budget.warn) {
    return { metric, value, status: 'warn', budget };
  }

  if (Number.isFinite(budget.target) && value > budget.target) {
    return { metric, value, status: 'watch', budget };
  }

  return { metric, value, status: 'pass', budget };
}

function annotationForResult(result) {
  const label = metricLabel(result.metric);
  const value = formatMetricValue(result.metric, result.value);
  const fail = result.budget?.fail ? formatMetricValue(result.metric, result.budget.fail) : 'n/a';
  const warn = result.budget?.warn ? formatMetricValue(result.metric, result.budget.warn) : 'n/a';

  if (result.status === 'fail') {
    return `::error title=Homepage performance budget::${label} is ${value}; hard limit is ${fail}.`;
  }

  if (result.status === 'warn') {
    return `::warning title=Homepage performance budget::${label} is ${value}; warning limit is ${warn}.`;
  }

  if (result.status === 'watch') {
    return `::notice title=Homepage performance budget::${label} is ${value}; it is above the target but below warning/fail limits.`;
  }

  return null;
}

function metricLabel(metric) {
  return metric
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .replace('Java Script', 'JavaScript')
    .replace('Css', 'CSS')
    .replace('Js', 'JS')
    .replace('Lcp', 'LCP')
    .replace('Gzip', 'gzip')
    .replace('Bytes', 'bytes')
    .replace('Ms', 'ms');
}

function buildMarkdownReport({ config, routeAssets, imageAssets, metrics, results }) {
  const lines = [
    '# NutsNews Homepage Performance Budget Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    '| Metric | Value | Target | Warn | Fail | Status |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const result of results) {
    const { metric, value, budget, status } = result;
    lines.push([
      `| ${metricLabel(metric)}`,
      formatMetricValue(metric, value),
      budget?.target ? formatMetricValue(metric, budget.target) : 'n/a',
      budget?.warn ? formatMetricValue(metric, budget.warn) : 'n/a',
      budget?.fail ? formatMetricValue(metric, budget.fail) : 'n/a',
      status,
      '|',
    ].join(' | '));
  }

  lines.push('');
  lines.push('## Route Assets');
  lines.push('');
  lines.push('| File | Type | Raw | gzip | Brotli |');
  lines.push('| --- | --- | ---: | ---: | ---: |');

  for (const asset of [...routeAssets].sort((a, b) => b.gzipBytes - a.gzipBytes)) {
    lines.push(`| \`${asset.relativeFile}\` | ${asset.type} | ${formatBytes(asset.rawBytes)} | ${formatBytes(asset.gzipBytes)} | ${formatBytes(asset.brotliBytes)} |`);
  }

  if (routeAssets.length === 0) {
    lines.push('| No route assets were found. Run this after `npm run build`. | n/a | n/a | n/a | n/a |');
  }

  lines.push('');
  lines.push('## Homepage Static Images');
  lines.push('');
  lines.push('| File | Raw | gzip | Brotli |');
  lines.push('| --- | ---: | ---: | ---: |');

  for (const asset of [...imageAssets].sort((a, b) => b.rawBytes - a.rawBytes)) {
    lines.push(`| \`${asset.relativeFile}\` | ${formatBytes(asset.rawBytes)} | ${formatBytes(asset.gzipBytes)} | ${formatBytes(asset.brotliBytes)} |`);
  }

  if (imageAssets.length === 0) {
    lines.push('| No static homepage images were found. Publisher article images are runtime assets measured by Lighthouse/PageSpeed. | n/a | n/a | n/a |');
  }

  lines.push('');
  lines.push('## Runtime Budgets', '');
  lines.push(`- LCP target: ${config.homepage.largestContentfulPaintMs.target} ms, warning: ${config.homepage.largestContentfulPaintMs.warn} ms, hard limit: ${config.homepage.largestContentfulPaintMs.fail} ms.`);
  lines.push(`- Runtime image transfer target: ${formatBytes(config.homepage.runtimeImageTransferBytes.target)}, warning: ${formatBytes(config.homepage.runtimeImageTransferBytes.warn)}, hard limit: ${formatBytes(config.homepage.runtimeImageTransferBytes.fail)}.`);
  lines.push('- Runtime LCP and publisher image transfer are measured by Lighthouse CI and PageSpeed because they depend on article data, CDN behavior, and the browser viewport.');
  lines.push('');
  lines.push('## Raw Metrics JSON', '');
  lines.push('```json');
  lines.push(JSON.stringify(metrics, null, 2));
  lines.push('```');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const configPath = path.resolve(root, args.configPath);
  const outputDir = path.resolve(root, args.outputDir);
  const config = await readJson(configPath);
  const homepageBudget = config.homepage || {};

  const routeAssets = await Promise.all((await collectHomepageRouteFiles(root)).map(statAsset));
  const hasBuildAssets = routeAssets.some((asset) => asset.type === 'js' || asset.type === 'css');
  if (!hasBuildAssets) {
    throw new Error('No homepage JavaScript or CSS assets were found in .next. Run `npm run build` before `npm run analyze:homepage`.');
  }

  const imageAssets = await collectHomepageStaticImages(root);

  const metrics = {
    route: homepageBudget.route || '/',
    initialJavaScriptGzipBytes: sumByType(routeAssets, 'js'),
    initialCssGzipBytes: sumByType(routeAssets, 'css'),
    homepageStaticImageBytes: imageAssets.reduce((total, asset) => total + asset.rawBytes, 0),
    totalInitialTransferGzipBytes: routeAssets.reduce((total, asset) => total + asset.gzipBytes, 0),
    routeAssetCount: routeAssets.length,
    staticHomepageImageCount: imageAssets.length,
  };

  const results = [
    compareMetric('initialJavaScriptGzipBytes', metrics.initialJavaScriptGzipBytes, homepageBudget.initialJavaScriptGzipBytes),
    compareMetric('initialCssGzipBytes', metrics.initialCssGzipBytes, homepageBudget.initialCssGzipBytes),
    compareMetric('homepageStaticImageBytes', metrics.homepageStaticImageBytes, homepageBudget.homepageStaticImageBytes),
    compareMetric('totalInitialTransferGzipBytes', metrics.totalInitialTransferGzipBytes, homepageBudget.totalInitialTransferGzipBytes),
  ];

  await fs.mkdir(outputDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    configPath: path.relative(root, configPath),
    config,
    metrics,
    results,
    routeAssets,
    imageAssets,
  };

  await fs.writeFile(path.join(outputDir, 'homepage-performance-budget.json'), `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(path.join(outputDir, 'homepage-performance-budget.md'), buildMarkdownReport({ config, routeAssets, imageAssets, metrics, results }));

  console.log('\nNutsNews homepage performance budget');
  for (const result of results) {
    console.log(`- ${metricLabel(result.metric)}: ${formatMetricValue(result.metric, result.value)} (${result.status})`);
    const annotation = annotationForResult(result);
    if (annotation) console.log(annotation);
  }
  console.log(`\nReport written to ${path.relative(root, outputDir)}/homepage-performance-budget.md`);

  const failed = results.some((result) => result.status === 'fail');
  if (failed && !args.warnOnly) {
    throw new Error('Homepage performance budget failed. Review the report and either fix the regression or intentionally update the budget.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
