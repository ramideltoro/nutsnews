#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_URL = 'https://www.nutsnews.com/';
const DEFAULT_OUTPUT_DIR = 'reports/pagespeed';

function parseArgs(argv) {
  const args = {
    url: process.env.PAGESPEED_URL || process.env.NUTSNEWS_PAGESPEED_URL || DEFAULT_URL,
    strategy: process.env.PAGESPEED_STRATEGY || 'both',
    outputDir: process.env.PAGESPEED_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
    failOnLowScore: process.env.PAGESPEED_FAIL_ON_LOW_SCORE === '1',
    minPerformance: Number(process.env.PAGESPEED_MIN_PERFORMANCE || 0.7),
    minAccessibility: Number(process.env.PAGESPEED_MIN_ACCESSIBILITY || 0.9),
    minBestPractices: Number(process.env.PAGESPEED_MIN_BEST_PRACTICES || 0.85),
    minSeo: Number(process.env.PAGESPEED_MIN_SEO || 0.9),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--url' && next) {
      args.url = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--url=')) {
      args.url = arg.slice('--url='.length);
      continue;
    }

    if (arg === '--strategy' && next) {
      args.strategy = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--strategy=')) {
      args.strategy = arg.slice('--strategy='.length);
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

    if (arg === '--fail-on-low-score') {
      args.failOnLowScore = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!['mobile', 'desktop', 'both'].includes(args.strategy)) {
    throw new Error(`Invalid --strategy value: ${args.strategy}. Use mobile, desktop, or both.`);
  }

  if (!args.url.startsWith('http://') && !args.url.startsWith('https://')) {
    throw new Error(`Invalid URL: ${args.url}. Use a full URL like https://www.nutsnews.com/`);
  }

  return args;
}

function printHelp() {
  console.log(`NutsNews PageSpeed Insights audit\n\nUsage:\n  npm run audit:pagespeed\n  npm run audit:pagespeed:mobile\n  npm run audit:pagespeed:desktop\n  node scripts/pagespeed-insights.mjs --url https://www.nutsnews.com/contact --strategy mobile\n\nEnvironment variables:\n  PAGESPEED_INSIGHTS_API_KEY   Optional Google PageSpeed Insights API key\n  PAGESPEED_URL                URL to audit. Defaults to https://www.nutsnews.com/\n  PAGESPEED_STRATEGY           mobile, desktop, or both\n  PAGESPEED_OUTPUT_DIR         Report folder. Defaults to reports/pagespeed\n  PAGESPEED_FAIL_ON_LOW_SCORE  Set to 1 to exit non-zero when thresholds fail\n`);
}

function scoreToPercent(score) {
  if (typeof score !== 'number') {
    return 'n/a';
  }
  return `${Math.round(score * 100)}`;
}

function scoreStatus(score, minimum) {
  if (typeof score !== 'number') {
    return 'missing';
  }
  return score >= minimum ? 'pass' : 'watch';
}

function getNumericAudit(lhr, auditId) {
  const audit = lhr?.audits?.[auditId];
  if (!audit) {
    return 'n/a';
  }
  return audit.displayValue || (typeof audit.numericValue === 'number' ? `${Math.round(audit.numericValue)} ms` : 'n/a');
}

function getCategoryScores(lhr) {
  return {
    performance: lhr?.categories?.performance?.score,
    accessibility: lhr?.categories?.accessibility?.score,
    bestPractices: lhr?.categories?.['best-practices']?.score,
    seo: lhr?.categories?.seo?.score,
  };
}

function getMetrics(lhr) {
  return {
    fcp: getNumericAudit(lhr, 'first-contentful-paint'),
    lcp: getNumericAudit(lhr, 'largest-contentful-paint'),
    cls: getNumericAudit(lhr, 'cumulative-layout-shift'),
    tbt: getNumericAudit(lhr, 'total-blocking-time'),
    speedIndex: getNumericAudit(lhr, 'speed-index'),
  };
}

function getTopDiagnostics(lhr) {
  const audits = Object.values(lhr?.audits || {});

  return audits
    .filter((audit) => {
      if (!audit || audit.score === null || audit.score === undefined) {
        return false;
      }
      if (audit.score >= 0.9) {
        return false;
      }
      return audit.details || audit.displayValue || audit.description;
    })
    .sort((a, b) => {
      const aSavings = a.numericValue || 0;
      const bSavings = b.numericValue || 0;
      return bSavings - aSavings;
    })
    .slice(0, 8)
    .map((audit) => ({
      id: audit.id,
      title: audit.title,
      score: audit.score,
      displayValue: audit.displayValue || '',
    }));
}

function getThresholds(args) {
  return {
    performance: args.minPerformance,
    accessibility: args.minAccessibility,
    bestPractices: args.minBestPractices,
    seo: args.minSeo,
  };
}

function buildApiUrl(urlToAudit, strategy) {
  const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  apiUrl.searchParams.set('url', urlToAudit);
  apiUrl.searchParams.set('strategy', strategy);
  apiUrl.searchParams.append('category', 'performance');
  apiUrl.searchParams.append('category', 'accessibility');
  apiUrl.searchParams.append('category', 'best-practices');
  apiUrl.searchParams.append('category', 'seo');

  const apiKey = process.env.PAGESPEED_INSIGHTS_API_KEY || process.env.GOOGLE_PAGESPEED_API_KEY;
  if (apiKey) {
    apiUrl.searchParams.set('key', apiKey);
  }

  return apiUrl;
}

async function runPageSpeed(urlToAudit, strategy) {
  const apiUrl = buildApiUrl(urlToAudit, strategy);
  const response = await fetch(apiUrl);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`PageSpeed API request failed for ${strategy}: HTTP ${response.status} ${body}`);
  }

  return JSON.parse(body);
}

function printSummary(result) {
  const scores = result.summary.scores;
  const metrics = result.summary.metrics;
  const statuses = result.summary.statuses;

  console.log(`\n${result.strategy.toUpperCase()} — ${result.url}`);
  console.log('Scores:');
  console.log(`  Performance:    ${scoreToPercent(scores.performance)} (${statuses.performance})`);
  console.log(`  Accessibility:  ${scoreToPercent(scores.accessibility)} (${statuses.accessibility})`);
  console.log(`  Best Practices: ${scoreToPercent(scores.bestPractices)} (${statuses.bestPractices})`);
  console.log(`  SEO:            ${scoreToPercent(scores.seo)} (${statuses.seo})`);
  console.log('Metrics:');
  console.log(`  FCP:         ${metrics.fcp}`);
  console.log(`  LCP:         ${metrics.lcp}`);
  console.log(`  CLS:         ${metrics.cls}`);
  console.log(`  TBT:         ${metrics.tbt}`);
  console.log(`  Speed Index: ${metrics.speedIndex}`);

  if (result.summary.topDiagnostics.length > 0) {
    console.log('Top items to review:');
    for (const item of result.summary.topDiagnostics) {
      const score = typeof item.score === 'number' ? Math.round(item.score * 100) : 'n/a';
      const suffix = item.displayValue ? ` — ${item.displayValue}` : '';
      console.log(`  - ${item.title} [${item.id}] score=${score}${suffix}`);
    }
  }
}

function buildMarkdownReport(results, thresholds) {
  const lines = [
    '# NutsNews PageSpeed Insights Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Thresholds',
    '',
    '| Category | Minimum |',
    '| --- | ---: |',
    `| Performance | ${Math.round(thresholds.performance * 100)} |`,
    `| Accessibility | ${Math.round(thresholds.accessibility * 100)} |`,
    `| Best Practices | ${Math.round(thresholds.bestPractices * 100)} |`,
    `| SEO | ${Math.round(thresholds.seo * 100)} |`,
    '',
  ];

  for (const result of results) {
    const { scores, metrics, statuses, topDiagnostics } = result.summary;
    lines.push(`## ${result.strategy.toUpperCase()} — ${result.url}`);
    lines.push('');
    lines.push('| Category | Score | Status |');
    lines.push('| --- | ---: | --- |');
    lines.push(`| Performance | ${scoreToPercent(scores.performance)} | ${statuses.performance} |`);
    lines.push(`| Accessibility | ${scoreToPercent(scores.accessibility)} | ${statuses.accessibility} |`);
    lines.push(`| Best Practices | ${scoreToPercent(scores.bestPractices)} | ${statuses.bestPractices} |`);
    lines.push(`| SEO | ${scoreToPercent(scores.seo)} | ${statuses.seo} |`);
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('| --- | ---: |');
    lines.push(`| First Contentful Paint | ${metrics.fcp} |`);
    lines.push(`| Largest Contentful Paint | ${metrics.lcp} |`);
    lines.push(`| Cumulative Layout Shift | ${metrics.cls} |`);
    lines.push(`| Total Blocking Time | ${metrics.tbt} |`);
    lines.push(`| Speed Index | ${metrics.speedIndex} |`);
    lines.push('');

    if (topDiagnostics.length > 0) {
      lines.push('### Top items to review');
      lines.push('');
      lines.push('| Audit | Score | Detail |');
      lines.push('| --- | ---: | --- |');
      for (const item of topDiagnostics) {
        const score = typeof item.score === 'number' ? Math.round(item.score * 100) : 'n/a';
        lines.push(`| ${item.title} \`${item.id}\` | ${score} | ${item.displayValue || ''} |`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const strategies = args.strategy === 'both' ? ['mobile', 'desktop'] : [args.strategy];
  const thresholds = getThresholds(args);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  await mkdir(args.outputDir, { recursive: true });

  const results = [];
  let hasLowScore = false;

  for (const strategy of strategies) {
    const data = await runPageSpeed(args.url, strategy);
    const lhr = data.lighthouseResult;
    const scores = getCategoryScores(lhr);
    const metrics = getMetrics(lhr);
    const statuses = {
      performance: scoreStatus(scores.performance, thresholds.performance),
      accessibility: scoreStatus(scores.accessibility, thresholds.accessibility),
      bestPractices: scoreStatus(scores.bestPractices, thresholds.bestPractices),
      seo: scoreStatus(scores.seo, thresholds.seo),
    };

    hasLowScore = hasLowScore || Object.values(statuses).includes('watch');

    const result = {
      url: args.url,
      strategy,
      fetchedAt: new Date().toISOString(),
      pageSpeedId: data.id,
      summary: {
        scores,
        statuses,
        metrics,
        topDiagnostics: getTopDiagnostics(lhr),
      },
      raw: data,
    };

    results.push(result);
    printSummary(result);

    const jsonPath = path.join(args.outputDir, `pagespeed-${strategy}-${timestamp}.json`);
    await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`Saved JSON: ${jsonPath}`);
  }

  const markdownPath = path.join(args.outputDir, `pagespeed-summary-${timestamp}.md`);
  await writeFile(markdownPath, buildMarkdownReport(results, thresholds));
  console.log(`\nSaved summary: ${markdownPath}`);

  if (hasLowScore && args.failOnLowScore) {
    console.error('\nOne or more PageSpeed scores are below the configured thresholds.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
