#!/usr/bin/env node
import { assertProductionOperation } from '../web/runtimeSafety.mjs';

assertProductionOperation('cloudflare-cache-purge');

const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
const purgeEverything = String(process.env.CLOUDFLARE_PURGE_EVERYTHING || 'true').toLowerCase() === 'true';
const dryRun = String(process.env.CLOUDFLARE_PURGE_DRY_RUN || 'false').toLowerCase() === 'true';
const deploymentEnvironment = process.env.DEPLOYMENT_ENVIRONMENT || 'unknown';
const deploymentState = process.env.DEPLOYMENT_STATE || 'unknown';
const deploymentUrl = process.env.DEPLOYMENT_URL || '';
const manualReason = process.env.MANUAL_PURGE_REASON || '';

function fail(message) {
  console.error(`Cloudflare cache purge failed: ${message}`);
  process.exit(1);
}

if (!purgeEverything) {
  fail('CLOUDFLARE_PURGE_EVERYTHING must remain true for the production post-deploy purge.');
}

if (!apiToken) {
  fail('Missing CLOUDFLARE_API_TOKEN GitHub Actions secret.');
}

if (!zoneId) {
  fail('Missing CLOUDFLARE_ZONE_ID GitHub Actions secret.');
}

if (!/^[a-f0-9]{32}$/i.test(zoneId)) {
  fail('CLOUDFLARE_ZONE_ID must look like a 32-character Cloudflare zone id.');
}

const requestBody = { purge_everything: true };
const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;

console.log('Cloudflare production cache purge configuration validated.');
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

console.log('Cloudflare production cache purge completed successfully.');
