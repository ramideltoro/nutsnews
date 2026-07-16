#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const requiredFiles = [
  '.github/workflows/cloudflare-production-cache-purge.yml',
  '.github/workflows/cloudflare-production-cache-purge-regression.yml',
  'scripts/cloudflare_purge_cache.mjs',
  'scripts/cloudflare_production_cache_purge_regression.mjs',
  'scripts/immutable_preview_smoke_guard.mjs',
];

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(haystack, needle, filePath) {
  assert(haystack.includes(needle), `${filePath} must include ${needle}`);
}

try {
  for (const file of requiredFiles) read(file);

  const purgeWorkflow = read('.github/workflows/cloudflare-production-cache-purge.yml');
  assertIncludes(purgeWorkflow, 'deployment_status:', 'cloudflare-production-cache-purge.yml');
  assertIncludes(purgeWorkflow, 'workflow_dispatch:', 'cloudflare-production-cache-purge.yml');
  assertIncludes(purgeWorkflow, "github.event.deployment_status.state == 'success'", 'cloudflare-production-cache-purge.yml');
  assertIncludes(purgeWorkflow, "github.event.deployment.environment == 'Production'", 'cloudflare-production-cache-purge.yml');
  assertIncludes(purgeWorkflow, "github.event.deployment.environment == 'production'", 'cloudflare-production-cache-purge.yml');
  assertIncludes(purgeWorkflow, 'CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}', 'cloudflare-production-cache-purge.yml');
  assertIncludes(purgeWorkflow, 'CLOUDFLARE_ZONE_ID: ${{ secrets.CLOUDFLARE_ZONE_ID }}', 'cloudflare-production-cache-purge.yml');
  assertIncludes(purgeWorkflow, 'CLOUDFLARE_PURGE_EVERYTHING: \'true\'', 'cloudflare-production-cache-purge.yml');
  assertIncludes(purgeWorkflow, 'node scripts/cloudflare_purge_cache.mjs', 'cloudflare-production-cache-purge.yml');
  assert(!/^\s+push:/m.test(purgeWorkflow), 'Production purge workflow must not run directly on push; it must wait for a successful production deployment_status event.');
  assert(!/^\s+pull_request:/m.test(purgeWorkflow), 'Production purge workflow must not run on pull requests.');
  assert(!/api_token\s*[:=]\s*[A-Za-z0-9_-]{20,}/i.test(purgeWorkflow), 'Workflow must not hard-code Cloudflare API tokens.');
  assert(!/zone_id\s*[:=]\s*[a-f0-9]{32}/i.test(purgeWorkflow), 'Workflow must not hard-code Cloudflare zone ids.');

  const purgeScript = read('scripts/cloudflare_purge_cache.mjs');
  assertIncludes(purgeScript, 'CLOUDFLARE_API_TOKEN', 'cloudflare_purge_cache.mjs');
  assertIncludes(purgeScript, 'CLOUDFLARE_ZONE_ID', 'cloudflare_purge_cache.mjs');
  assertIncludes(purgeScript, 'purge_everything: true', 'cloudflare_purge_cache.mjs');
  assertIncludes(purgeScript, '/purge_cache', 'cloudflare_purge_cache.mjs');
  assertIncludes(purgeScript, "method: 'POST'", 'cloudflare_purge_cache.mjs');
  assertIncludes(purgeScript, 'Authorization: `Bearer ${apiToken}`', 'cloudflare_purge_cache.mjs');
  assert(!/console\.(log|error|warn)\([^)]*apiToken[^)]*\)/.test(purgeScript), 'Purge script must not log the Cloudflare API token.');

  const regressionWorkflow = read('.github/workflows/cloudflare-production-cache-purge-regression.yml');
  assertIncludes(regressionWorkflow, 'pull_request:', 'cloudflare-production-cache-purge-regression.yml');
  assertIncludes(regressionWorkflow, 'push:', 'cloudflare-production-cache-purge-regression.yml');
  assertIncludes(regressionWorkflow, 'node scripts/cloudflare_production_cache_purge_regression.mjs', 'cloudflare-production-cache-purge-regression.yml');

  const immutableGuard = read('scripts/immutable_preview_smoke_guard.mjs');
  for (const file of [
    '.github/workflows/cloudflare-production-cache-purge.yml',
    '.github/workflows/cloudflare-production-cache-purge-regression.yml',
    'scripts/cloudflare_purge_cache.mjs',
    'scripts/cloudflare_production_cache_purge_regression.mjs',
  ]) {
    assertIncludes(immutableGuard, `'${file}'`, 'immutable_preview_smoke_guard.mjs');
  }
  assertIncludes(immutableGuard, 'Immutable test guard notice', 'immutable_preview_smoke_guard.mjs');
  assertIncludes(immutableGuard, 'Manual approval phrases are no longer required', 'immutable_preview_smoke_guard.mjs');
  assert(!immutableGuard.includes('IMMUTABLE TEST CHANGE APPROVED BY RAMI'), 'Immutable guard must not require a manual approval phrase.');

  console.log('Cloudflare production cache purge regression passed.');
} catch (error) {
  console.error(`Cloudflare production cache purge regression failed: ${error.message}`);
  process.exit(1);
}
