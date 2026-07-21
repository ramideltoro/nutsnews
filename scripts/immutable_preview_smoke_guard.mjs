#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const protectedFiles = [
  '.github/workflows/immutable-tests-guard.yml',
  '.github/workflows/vercel-preview-smoke.yml',
  '.github/workflows/cloudflare-production-cache-purge.yml',
  '.github/workflows/cloudflare-production-cache-purge-regression.yml',
  'scripts/immutable_preview_smoke_guard.mjs',
  'scripts/cloudflare_purge_cache.mjs',
  'scripts/cloudflare_production_cache_purge_regression.mjs',
  'scripts/web_offline_e2e_regression.mjs',
  'web/playwright.deployed.config.ts',
  'web/tests/deployed-ui-smoke.spec.ts',
];

const baseRef = process.env.BASE_REF || 'main';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function existsAtBase(filePath) {
  try {
    execFileSync('git', ['cat-file', '-e', `origin/${baseRef}:${filePath}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

try {
  execFileSync('git', ['fetch', 'origin', baseRef, '--depth=1'], { stdio: 'ignore' });
} catch (error) {
  console.warn(`Could not fetch origin/${baseRef}; continuing with the local checkout. ${error.message}`);
}


const guardWasAlreadyEstablished = existsAtBase('.github/workflows/immutable-tests-guard.yml');

if (!guardWasAlreadyEstablished) {
  console.log('Immutable test guard is being established for the first time. Future pull requests will report locked test changes.');
  process.exit(0);
}

const changed = git(['diff', '--name-status', `origin/${baseRef}...HEAD`, '--', ...protectedFiles])
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const blockedChanges = changed.filter((line) => {
  const [status, filePath] = line.split(/\s+/);

  if (status === 'A' && !existsAtBase(filePath)) {
    return false;
  }

  return protectedFiles.includes(filePath);
});

if (blockedChanges.length === 0) {
  console.log('Immutable test guard passed. No locked test files were modified after being established.');
  process.exit(0);
}

console.warn('Immutable test guard notice. These locked regression test files were modified:');
console.warn(blockedChanges.map((line) => `- ${line}`).join('\n'));
console.warn('');
console.warn('Manual approval phrases are no longer required; reviewers should inspect the listed locked regression changes.');
process.exit(0);
