#!/usr/bin/env node
import { assertProductionOperation } from '../web/runtimeSafety.mjs';

assertProductionOperation('cloudflare-cache-purge');

const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
const purgeEverything = String(process.env.CLOUDFLARE_PURGE_EVERYTHING || 'false').toLowerCase() === 'true';
const purgeTags = parseList(process.env.CLOUDFLARE_PURGE_TAGS);
const purgeUrls = parseList(process.env.CLOUDFLARE_PURGE_URLS);
const breakGlassConfirmation = process.env.CLOUDFLARE_PURGE_CONFIRMATION || '';
const dryRun = String(process.env.CLOUDFLARE_PURGE_DRY_RUN || 'false').toLowerCase() === 'true';
const deploymentEnvironment = process.env.DEPLOYMENT_ENVIRONMENT || 'unknown';
const deploymentState = process.env.DEPLOYMENT_STATE || 'unknown';
const deploymentUrl = process.env.DEPLOYMENT_URL || '';
const manualReason = process.env.MANUAL_PURGE_REASON || '';

const ALLOWED_FIXED_TAGS = new Set(['public-feed', 'site-shell']);
const ARTICLE_TAG_PATTERN = /^article:[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const ALLOWED_HOSTS = new Set(['nutsnews.com', 'www.nutsnews.com']);

function parseList(value = '') {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function fail(message) {
  console.error(`Cloudflare cache purge failed: ${message}`);
  process.exit(1);
}

if (!apiToken) fail('Missing CLOUDFLARE_API_TOKEN GitHub Actions secret.');
if (!zoneId) fail('Missing CLOUDFLARE_ZONE_ID GitHub Actions secret.');
if (!/^[a-f0-9]{32}$/i.test(zoneId)) {
  fail('CLOUDFLARE_ZONE_ID must look like a 32-character Cloudflare zone id.');
}

const selectedModes = [purgeEverything, purgeTags.length > 0, purgeUrls.length > 0].filter(Boolean);
if (selectedModes.length !== 1) {
  fail('Select exactly one purge mode: tags, URLs, or break-glass purge-everything.');
}

let requestBody;
let purgeMode;

if (purgeEverything) {
  if (breakGlassConfirmation !== 'purge-everything-production') {
    fail('Full-zone purge requires CLOUDFLARE_PURGE_CONFIRMATION=purge-everything-production.');
  }
  requestBody = { purge_everything: true };
  purgeMode = 'break-glass-everything';
} else if (purgeTags.length > 0) {
  if (purgeTags.length > 30) fail('At most 30 cache tags may be purged per request.');
  for (const tag of purgeTags) {
    if (!ALLOWED_FIXED_TAGS.has(tag) && !ARTICLE_TAG_PATTERN.test(tag)) {
      fail(`Cache tag is not allowlisted: ${tag}`);
    }
  }
  requestBody = { tags: purgeTags };
  purgeMode = 'tags';
} else {
  if (purgeUrls.length > 30) fail('At most 30 URLs may be purged per request.');
  for (const value of purgeUrls) {
    let url;
    try {
      url = new URL(value);
    } catch {
      fail(`Purge URL is invalid: ${value}`);
    }
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
      fail(`Purge URL must use HTTPS on a NutsNews production host: ${value}`);
    }
  }
  requestBody = { files: purgeUrls };
  purgeMode = 'urls';
}

const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;

console.log('Cloudflare production cache purge configuration validated.');
console.log(`Purge mode: ${purgeMode}`);
console.log(`Purge target count: ${purgeTags.length || purgeUrls.length || 1}`);
console.log(`Deployment environment: ${deploymentEnvironment}`);
console.log(`Deployment state: ${deploymentState}`);
if (deploymentUrl) console.log(`Deployment URL: ${deploymentUrl}`);
if (manualReason) console.log(`Manual purge reason: ${manualReason}`);

if (dryRun) {
  console.log('Dry run enabled. Skipping Cloudflare API call.');
  process.exit(0);
}

let response;
try {
  response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });
} catch (error) {
  fail(`Could not reach Cloudflare API: ${error.message}`);
}

let payload;
try {
  payload = await response.json();
} catch {
  payload = null;
}

if (!response.ok || payload?.success !== true) {
  const errors = Array.isArray(payload?.errors) && payload.errors.length > 0
    ? payload.errors.map((error) => error.message || JSON.stringify(error)).join('; ')
    : `HTTP ${response.status}`;
  fail(errors);
}

console.log(`Cloudflare ${purgeMode} cache purge completed successfully.`);
