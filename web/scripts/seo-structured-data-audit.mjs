#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertProductionOperation } from '../runtimeSafety.mjs';

assertProductionOperation('seo-structured-data-audit');

const DEFAULT_BASE_URL = 'https://www.nutsnews.com';
const DEFAULT_ARTICLE_LIMIT = 3;
const DEFAULT_OUTPUT_DIR = 'reports/seo';
const MAX_SITEMAP_FETCHES = 25;

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.SEO_AUDIT_BASE_URL || process.env.NUTSNEWS_SITE_URL || DEFAULT_BASE_URL,
    articleLimit: Number(process.env.SEO_AUDIT_ARTICLE_LIMIT || DEFAULT_ARTICLE_LIMIT),
    outputDir: process.env.SEO_AUDIT_OUTPUT_DIR || DEFAULT_OUTPUT_DIR,
    extraPaths: (process.env.SEO_AUDIT_EXTRA_PATHS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    failOnWarnings: process.env.SEO_AUDIT_FAIL_ON_WARNINGS === '1',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--base-url' && next) {
      args.baseUrl = next;
      index += 1;
      continue;
    }

    if (arg.startsWith('--base-url=')) {
      args.baseUrl = arg.slice('--base-url='.length);
      continue;
    }

    if (arg === '--article-limit' && next) {
      args.articleLimit = Number(next);
      index += 1;
      continue;
    }

    if (arg.startsWith('--article-limit=')) {
      args.articleLimit = Number(arg.slice('--article-limit='.length));
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

    if (arg === '--extra-path' && next) {
      args.extraPaths.push(next);
      index += 1;
      continue;
    }

    if (arg.startsWith('--extra-path=')) {
      args.extraPaths.push(arg.slice('--extra-path='.length));
      continue;
    }

    if (arg === '--fail-on-warnings') {
      args.failOnWarnings = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  args.baseUrl = normalizeBaseUrl(args.baseUrl);

  if (!Number.isFinite(args.articleLimit) || args.articleLimit < 1) {
    throw new Error(`Invalid article limit: ${args.articleLimit}. Use a positive number.`);
  }

  return args;
}

function printHelp() {
  console.log(`NutsNews SEO structured data audit\n\nUsage:\n  npm run audit:seo\n  node scripts/seo-structured-data-audit.mjs --base-url https://www.nutsnews.com --article-limit 3\n\nEnvironment variables:\n  SEO_AUDIT_BASE_URL          Public site URL. Defaults to https://www.nutsnews.com\n  SEO_AUDIT_ARTICLE_LIMIT     Number of article URLs to audit from sitemap. Defaults to 3\n  SEO_AUDIT_EXTRA_PATHS       Comma-separated extra paths such as /privacy,/contact\n  SEO_AUDIT_OUTPUT_DIR        Report folder. Defaults to reports/seo\n  SEO_AUDIT_FAIL_ON_WARNINGS  Set to 1 to make warnings fail the workflow\n`);
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url.href.replace(/\/$/, '');
}

function normalizeUrl(value, baseUrl) {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value, baseUrl);
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch {
    return String(value).trim();
  }
}

function normalizeType(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeType).join(',');
  }

  return String(value || '').toLowerCase();
}

function typeMatches(node, acceptedTypes) {
  const type = node?.['@type'];

  if (Array.isArray(type)) {
    return type.some((item) => acceptedTypes.includes(String(item).toLowerCase()));
  }

  return acceptedTypes.includes(String(type || '').toLowerCase());
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function stripTags(value) {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function parseAttributes(tag) {
  const attrs = {};
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
  let match;

  while ((match = attrPattern.exec(tag)) !== null) {
    const key = match[1].toLowerCase();
    const rawValue = match[2] || '';
    const value = rawValue.replace(/^['"]|['"]$/g, '');
    attrs[key] = decodeHtmlEntities(value);
  }

  return attrs;
}

function parseJsonLdBlocks(html) {
  const blocks = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(html)) !== null) {
    const attrs = parseAttributes(match[1]);
    const type = String(attrs.type || '').toLowerCase();

    if (!type.includes('application/ld+json')) {
      continue;
    }

    const raw = match[2].trim();

    if (!raw) {
      blocks.push({ raw, parsed: null, error: 'Empty JSON-LD script block' });
      continue;
    }

    try {
      blocks.push({ raw, parsed: JSON.parse(raw), error: null });
    } catch (error) {
      blocks.push({ raw, parsed: null, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return blocks;
}

function collectJsonLdNodes(value, nodes = []) {
  if (!value) {
    return nodes;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdNodes(item, nodes);
    }
    return nodes;
  }

  if (typeof value !== 'object') {
    return nodes;
  }

  if (value['@type'] || value['@id']) {
    nodes.push(value);
  }

  if (Array.isArray(value['@graph'])) {
    collectJsonLdNodes(value['@graph'], nodes);
  }

  return nodes;
}

function extractHtmlMetadata(html, pageUrl) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => parseAttributes(match[0]));
  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => parseAttributes(match[0]));
  const canonicalTag = linkTags.find((attrs) => String(attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
  const jsonLdBlocks = parseJsonLdBlocks(html);

  const metaByName = new Map();
  const metaByProperty = new Map();

  for (const attrs of metaTags) {
    if (attrs.name) {
      metaByName.set(String(attrs.name).toLowerCase(), attrs.content || '');
    }

    if (attrs.property) {
      metaByProperty.set(String(attrs.property).toLowerCase(), attrs.content || '');
    }
  }

  return {
    url: pageUrl,
    title: titleMatch ? stripTags(titleMatch[1]) : '',
    description: metaByName.get('description') || '',
    canonical: canonicalTag?.href || '',
    openGraph: {
      type: metaByProperty.get('og:type') || '',
      title: metaByProperty.get('og:title') || '',
      description: metaByProperty.get('og:description') || '',
      image: metaByProperty.get('og:image') || '',
      url: metaByProperty.get('og:url') || '',
    },
    twitter: {
      card: metaByName.get('twitter:card') || '',
      title: metaByName.get('twitter:title') || '',
      description: metaByName.get('twitter:description') || '',
      image: metaByName.get('twitter:image') || '',
    },
    jsonLdBlocks,
    jsonLdNodes: jsonLdBlocks.flatMap((block) => collectJsonLdNodes(block.parsed)),
  };
}

function isHttpUrl(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function asArray(value) {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getNodeUrl(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    return value['@id'] || value.url || '';
  }

  return '';
}

function validateCommonPage({ pageType, pageUrl, metadata, baseUrl }) {
  const errors = [];
  const warnings = [];
  const expectedUrl = normalizeUrl(pageUrl, baseUrl);
  const canonical = normalizeUrl(metadata.canonical, baseUrl);

  if (!metadata.title) {
    errors.push('Missing <title>.');
  } else if (metadata.title.length < 8) {
    warnings.push(`Title is very short: "${metadata.title}".`);
  } else if (metadata.title.length > 90) {
    warnings.push(`Title is long (${metadata.title.length} chars).`);
  }

  if (!metadata.description) {
    errors.push('Missing meta description.');
  } else if (metadata.description.length < 50) {
    warnings.push(`Meta description is short (${metadata.description.length} chars).`);
  } else if (metadata.description.length > 180) {
    warnings.push(`Meta description is long (${metadata.description.length} chars).`);
  }

  if (!metadata.canonical) {
    errors.push('Missing canonical link.');
  } else if (!isHttpUrl(metadata.canonical, baseUrl)) {
    errors.push(`Canonical URL is not a valid HTTP(S) URL: ${metadata.canonical}`);
  } else if (pageType !== 'extra' && canonical !== expectedUrl) {
    errors.push(`Canonical mismatch. Expected ${expectedUrl}, found ${canonical}.`);
  }

  if (!metadata.openGraph.title) {
    errors.push('Missing og:title.');
  }

  if (!metadata.openGraph.description) {
    errors.push('Missing og:description.');
  }

  if (!metadata.openGraph.image) {
    errors.push('Missing og:image.');
  } else if (!isHttpUrl(metadata.openGraph.image, baseUrl)) {
    errors.push(`og:image is not a valid HTTP(S) URL: ${metadata.openGraph.image}`);
  }

  if (!metadata.twitter.card) {
    warnings.push('Missing twitter:card.');
  }

  if (!metadata.twitter.image) {
    warnings.push('Missing twitter:image.');
  } else if (!isHttpUrl(metadata.twitter.image, baseUrl)) {
    warnings.push(`twitter:image is not a valid HTTP(S) URL: ${metadata.twitter.image}`);
  }

  const invalidJsonLdBlocks = metadata.jsonLdBlocks.filter((block) => block.error);
  if (metadata.jsonLdBlocks.length === 0) {
    errors.push('Missing application/ld+json structured data.');
  }

  for (const block of invalidJsonLdBlocks) {
    errors.push(`Invalid JSON-LD: ${block.error}`);
  }

  return { errors, warnings };
}

function validateHomepage({ pageUrl, metadata, baseUrl }) {
  const { errors, warnings } = validateCommonPage({ pageType: 'home', pageUrl, metadata, baseUrl });
  const homepageNode = metadata.jsonLdNodes.find((node) =>
    typeMatches(node, ['collectionpage', 'webpage', 'website']),
  );

  if (!homepageNode) {
    errors.push('Homepage JSON-LD should include CollectionPage, WebPage, or WebSite.');
  } else {
    if (!homepageNode.name) {
      warnings.push('Homepage JSON-LD is missing name.');
    } else if (!String(homepageNode.name).toLowerCase().includes('nutsnews')) {
      warnings.push(`Homepage JSON-LD name does not include NutsNews: ${homepageNode.name}`);
    }

    if (!homepageNode.url) {
      warnings.push('Homepage JSON-LD is missing url.');
    } else if (normalizeUrl(homepageNode.url, baseUrl) !== normalizeUrl(pageUrl, baseUrl)) {
      warnings.push(`Homepage JSON-LD url does not match page URL: ${homepageNode.url}`);
    }
  }

  const articleNodes = metadata.jsonLdNodes.filter((node) => typeMatches(node, ['article', 'newsarticle', 'blogposting']));
  if (articleNodes.length === 0) {
    warnings.push('Homepage JSON-LD has no Article items. This is okay if the page intentionally has only website-level schema.');
  }

  return { errors, warnings };
}

function validateArticlePage({ pageUrl, metadata, baseUrl }) {
  const { errors, warnings } = validateCommonPage({ pageType: 'article', pageUrl, metadata, baseUrl });
  const articleNode = metadata.jsonLdNodes.find((node) => typeMatches(node, ['article', 'newsarticle', 'blogposting']));

  if (!articleNode) {
    errors.push('Article page JSON-LD is missing Article, NewsArticle, or BlogPosting.');
    return { errors, warnings };
  }

  if (!articleNode.headline) {
    errors.push('Article JSON-LD is missing headline.');
  }

  if (!articleNode.description) {
    errors.push('Article JSON-LD is missing description.');
  }

  const images = asArray(articleNode.image).map((image) => getNodeUrl(image)).filter(Boolean);
  if (images.length === 0) {
    errors.push('Article JSON-LD is missing image.');
  } else {
    const invalidImage = images.find((image) => !isHttpUrl(image, baseUrl));
    if (invalidImage) {
      errors.push(`Article JSON-LD image is not a valid HTTP(S) URL: ${invalidImage}`);
    }
  }

  if (!articleNode.datePublished) {
    errors.push('Article JSON-LD is missing datePublished.');
  } else if (Number.isNaN(Date.parse(articleNode.datePublished))) {
    errors.push(`Article JSON-LD datePublished is not a valid date: ${articleNode.datePublished}`);
  }

  if (!articleNode.dateModified) {
    warnings.push('Article JSON-LD is missing dateModified.');
  } else if (Number.isNaN(Date.parse(articleNode.dateModified))) {
    warnings.push(`Article JSON-LD dateModified is not a valid date: ${articleNode.dateModified}`);
  }

  const mainEntityUrl = normalizeUrl(getNodeUrl(articleNode.mainEntityOfPage), baseUrl);
  if (!mainEntityUrl) {
    errors.push('Article JSON-LD is missing mainEntityOfPage.');
  } else if (mainEntityUrl !== normalizeUrl(pageUrl, baseUrl)) {
    errors.push(`Article JSON-LD mainEntityOfPage mismatch. Expected ${normalizeUrl(pageUrl, baseUrl)}, found ${mainEntityUrl}.`);
  }

  const publisherName = articleNode.publisher?.name || '';
  if (!publisherName) {
    errors.push('Article JSON-LD is missing publisher.name.');
  } else if (!String(publisherName).toLowerCase().includes('nutsnews')) {
    warnings.push(`Article JSON-LD publisher.name is not NutsNews: ${publisherName}`);
  }

  if (!articleNode.isBasedOn) {
    warnings.push('Article JSON-LD is missing isBasedOn original publisher URL.');
  }

  if (metadata.openGraph.type && !String(metadata.openGraph.type).toLowerCase().includes('article')) {
    warnings.push(`Article page og:type is not article: ${metadata.openGraph.type}`);
  }

  return { errors, warnings };
}

function validateExtraPage({ pageUrl, metadata, baseUrl }) {
  return validateCommonPage({ pageType: 'extra', pageUrl, metadata, baseUrl });
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'NutsNews SEO Audit Bot (+https://www.nutsnews.com)',
    },
    redirect: 'follow',
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${body.slice(0, 400)}`);
  }

  return body;
}

function extractSitemapUrls(xml, baseUrl) {
  const urls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => decodeHtmlEntities(match[1]))
    .map((url) => normalizeUrl(url, baseUrl));

  return [...new Set(urls)];
}

function isSitemapIndex(xml) {
  return /<sitemapindex(?:\s|>)/i.test(xml);
}

function isSameOriginUrl(url, baseUrl) {
  try {
    return new URL(url).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

async function collectSitemapUrls({ sitemapUrl, baseUrl, seen = new Set() }) {
  if (seen.has(sitemapUrl)) {
    return [];
  }

  if (seen.size >= MAX_SITEMAP_FETCHES) {
    throw new Error(`Sitemap traversal exceeded ${MAX_SITEMAP_FETCHES} files. Last URL: ${sitemapUrl}`);
  }

  seen.add(sitemapUrl);
  const sitemapXml = await fetchText(sitemapUrl);
  const urls = extractSitemapUrls(sitemapXml, baseUrl);

  if (!isSitemapIndex(sitemapXml)) {
    return urls;
  }

  const nestedSitemapUrls = urls.filter((url) => isSameOriginUrl(url, baseUrl));
  const nestedUrls = [];

  for (const nestedSitemapUrl of nestedSitemapUrls) {
    nestedUrls.push(
      ...(await collectSitemapUrls({
        sitemapUrl: nestedSitemapUrl,
        baseUrl,
        seen,
      })),
    );
  }

  return [...new Set(nestedUrls)];
}

async function getArticleUrls(baseUrl, articleLimit) {
  const sitemapCandidates = [`${baseUrl}/sitemap-index.xml`, `${baseUrl}/sitemap.xml`];
  let urls = [];
  let lastError = null;

  for (const sitemapUrl of sitemapCandidates) {
    try {
      urls = await collectSitemapUrls({ sitemapUrl, baseUrl });
      if (urls.length > 0) {
        break;
      }
    } catch (error) {
      lastError = error;
      if (sitemapUrl.endsWith('/sitemap.xml')) {
        throw error;
      }
    }
  }

  const articleUrls = urls.filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.pathname.startsWith('/articles/');
    } catch {
      return false;
    }
  });

  if (articleUrls.length === 0) {
    const errorSuffix = lastError instanceof Error ? ` Last sitemap error: ${lastError.message}` : '';
    throw new Error(`No article URLs found in sitemap index or root sitemap.${errorSuffix}`);
  }

  return articleUrls.slice(0, articleLimit);
}

function getPageSummary(metadata) {
  const jsonLdTypes = metadata.jsonLdNodes
    .map((node) => normalizeType(node['@type']))
    .filter(Boolean);

  return {
    title: metadata.title,
    descriptionLength: metadata.description.length,
    canonical: metadata.canonical,
    ogImage: metadata.openGraph.image,
    twitterImage: metadata.twitter.image,
    jsonLdBlockCount: metadata.jsonLdBlocks.length,
    jsonLdTypes,
  };
}

async function auditPage({ pageType, pageUrl, baseUrl }) {
  const html = await fetchText(pageUrl);
  const metadata = extractHtmlMetadata(html, pageUrl);

  let result;
  if (pageType === 'home') {
    result = validateHomepage({ pageUrl, metadata, baseUrl });
  } else if (pageType === 'article') {
    result = validateArticlePage({ pageUrl, metadata, baseUrl });
  } else {
    result = validateExtraPage({ pageUrl, metadata, baseUrl });
  }

  return {
    pageType,
    url: pageUrl,
    status: result.errors.length === 0 ? 'pass' : 'fail',
    errors: result.errors,
    warnings: result.warnings,
    summary: getPageSummary(metadata),
  };
}

function printPageResult(result) {
  const icon = result.status === 'pass' ? 'PASS' : 'FAIL';
  console.log(`\n${icon} ${result.pageType.toUpperCase()} — ${result.url}`);
  console.log(`  title: ${result.summary.title || '(missing)'}`);
  console.log(`  canonical: ${result.summary.canonical || '(missing)'}`);
  console.log(`  JSON-LD types: ${result.summary.jsonLdTypes.join(', ') || '(none)'}`);

  if (result.errors.length > 0) {
    console.log('  Errors:');
    for (const error of result.errors) {
      console.log(`    - ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('  Warnings:');
    for (const warning of result.warnings) {
      console.log(`    - ${warning}`);
    }
  }
}

function buildMarkdownReport({ baseUrl, generatedAt, results, failOnWarnings }) {
  const totalErrors = results.reduce((count, result) => count + result.errors.length, 0);
  const totalWarnings = results.reduce((count, result) => count + result.warnings.length, 0);
  const lines = [
    '# NutsNews SEO Structured Data Audit',
    '',
    `Generated: ${generatedAt}`,
    `Base URL: ${baseUrl}`,
    `Status: ${totalErrors === 0 && (!failOnWarnings || totalWarnings === 0) ? 'PASS' : 'FAIL'}`,
    '',
    '## Summary',
    '',
    '| Page | Type | Status | Errors | Warnings | JSON-LD types |',
    '| --- | --- | --- | ---: | ---: | --- |',
  ];

  for (const result of results) {
    lines.push(
      `| ${result.url} | ${result.pageType} | ${result.status} | ${result.errors.length} | ${result.warnings.length} | ${result.summary.jsonLdTypes.join(', ') || 'none'} |`,
    );
  }

  for (const result of results) {
    lines.push('');
    lines.push(`## ${result.pageType.toUpperCase()} — ${result.url}`);
    lines.push('');
    lines.push(`- Title: ${result.summary.title || '(missing)'}`);
    lines.push(`- Description length: ${result.summary.descriptionLength}`);
    lines.push(`- Canonical: ${result.summary.canonical || '(missing)'}`);
    lines.push(`- OG image: ${result.summary.ogImage || '(missing)'}`);
    lines.push(`- Twitter image: ${result.summary.twitterImage || '(missing)'}`);
    lines.push(`- JSON-LD blocks: ${result.summary.jsonLdBlockCount}`);
    lines.push(`- JSON-LD types: ${result.summary.jsonLdTypes.join(', ') || '(none)'}`);

    if (result.errors.length > 0) {
      lines.push('');
      lines.push('### Errors');
      for (const error of result.errors) {
        lines.push(`- ${error}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('');
      lines.push('### Warnings');
      for (const warning of result.warnings) {
        lines.push(`- ${warning}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

async function writeReports({ outputDir, payload }) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'seo-structured-data-audit.json'), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(path.join(outputDir, 'seo-structured-data-audit.md'), buildMarkdownReport(payload));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();
  const homeUrl = args.baseUrl;
  const articleUrls = await getArticleUrls(args.baseUrl, args.articleLimit);
  const extraUrls = args.extraPaths.map((extraPath) => normalizeUrl(extraPath, args.baseUrl));

  const pages = [
    { pageType: 'home', pageUrl: homeUrl },
    ...articleUrls.map((pageUrl) => ({ pageType: 'article', pageUrl })),
    ...extraUrls.map((pageUrl) => ({ pageType: 'extra', pageUrl })),
  ];

  console.log(`NutsNews SEO structured data audit`);
  console.log(`Base URL: ${args.baseUrl}`);
  console.log(`Article URLs: ${articleUrls.length}`);

  const results = [];
  for (const page of pages) {
    const result = await auditPage({ ...page, baseUrl: args.baseUrl });
    results.push(result);
    printPageResult(result);
  }

  const totalErrors = results.reduce((count, result) => count + result.errors.length, 0);
  const totalWarnings = results.reduce((count, result) => count + result.warnings.length, 0);
  const payload = {
    baseUrl: args.baseUrl,
    generatedAt,
    failOnWarnings: args.failOnWarnings,
    totals: {
      pages: results.length,
      errors: totalErrors,
      warnings: totalWarnings,
    },
    results,
  };

  await writeReports({ outputDir: args.outputDir, payload });

  console.log(`\nReports written to ${args.outputDir}`);
  console.log(`Checked ${results.length} page(s): ${totalErrors} error(s), ${totalWarnings} warning(s).`);

  if (totalErrors > 0 || (args.failOnWarnings && totalWarnings > 0)) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`SEO audit failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
