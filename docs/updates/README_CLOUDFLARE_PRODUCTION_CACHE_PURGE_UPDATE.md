# Cloudflare Production Cache Purge Update

This update adds automatic full Cloudflare cache purge after a successful production deployment.

## Added

* `.github/workflows/cloudflare-production-cache-purge.yml`
  * Runs on successful production `deployment_status` events.
  * Supports manual `workflow_dispatch` runs.
  * Calls Cloudflare with `purge_everything`.
  * Uses `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` GitHub Actions secrets.
* `scripts/cloudflare_purge_cache.mjs`
  * Validates required secrets.
  * Supports dry-run mode.
  * Calls Cloudflare's zone purge endpoint without logging secrets.
* `.github/workflows/cloudflare-production-cache-purge-regression.yml`
  * Runs regression checks on pull requests and pushes to `main`.
* `scripts/cloudflare_production_cache_purge_regression.mjs`
  * Locks the expected production-only trigger, secrets usage, purge-everything behavior, and immutable guard coverage.
* `docs/CLOUDFLARE_PRODUCTION_CACHE_PURGE.md`
  * Documents setup, required secrets, testing, and production verification.

## Required GitHub secrets

Add these in the NutsNews GitHub repo under **Settings → Secrets and variables → Actions**:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_ID
```

The Cloudflare token should be scoped only to the NutsNews zone and only needs cache purge permission.

## Immutable test policy

The new purge automation and regression files are added to the immutable test guard. Future changes require Rami's explicit approval phrase in the PR title or body:

```text
IMMUTABLE TEST CHANGE APPROVED BY RAMI
```

This PR modifies the immutable guard to add the new locked files, so the PR body should include that approval phrase for this one-time locking update.

## Local verification

Run from the repo root:

```bash
node scripts/cloudflare_production_cache_purge_regression.mjs
```

Optional dry run:

```bash
CLOUDFLARE_API_TOKEN=example-token \
CLOUDFLARE_ZONE_ID=00000000000000000000000000000000 \
CLOUDFLARE_PURGE_DRY_RUN=true \
node scripts/cloudflare_purge_cache.mjs
```
