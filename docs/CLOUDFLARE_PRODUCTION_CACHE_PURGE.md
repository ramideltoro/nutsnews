# Cloudflare Production Cache Purge

NutsNews now has a dedicated GitHub Action that purges the full Cloudflare cache after a successful production deployment.

This is intentionally separate from preview smoke tests and cache observability checks. Preview deployments should never purge the production Cloudflare zone.

## Workflow

```text
.github/workflows/cloudflare-production-cache-purge.yml
```

The workflow runs in two cases:

1. Automatically on a successful GitHub `deployment_status` event where the deployment environment is `Production` or `production`.
2. Manually from GitHub Actions with `workflow_dispatch`.

The action waits for the deployment success signal instead of running directly on `push` to `main`. That prevents Cloudflare from being purged before Vercel has finished deploying production.

## What it purges

The action calls the Cloudflare purge-cache API with:

```json
{"purge_everything":true}
```

That clears the whole Cloudflare zone cache for NutsNews.

## Required GitHub Actions secrets

Add these repository secrets in GitHub under **Settings → Secrets and variables → Actions**:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_ID
```

Recommended Cloudflare API token permissions:

```text
Zone → Cache Purge → Purge
```

Scope the token only to the NutsNews Cloudflare zone.

Do not use the global Cloudflare API key.

## Manual dry run

You can validate the workflow configuration without calling Cloudflare by running the workflow manually and enabling `dry_run`.

A dry run checks that the required secrets exist and that the zone id looks valid, then exits without sending the purge request.

## Regression protection

These files are covered by a dedicated regression workflow:

```text
.github/workflows/cloudflare-production-cache-purge-regression.yml
scripts/cloudflare_production_cache_purge_regression.mjs
```

The regression verifies that:

* The purge workflow waits for a successful production `deployment_status` event.
* The purge workflow can also be run manually.
* The workflow does not run directly on pull requests or pushes.
* The Cloudflare API token and zone id come from GitHub Secrets.
* The purge request uses `purge_everything`.
* The purge script does not log the Cloudflare token.
* The purge automation files are locked by the immutable test guard.

The locked files can only be changed later if the PR title or body includes Rami's explicit approval phrase:

```text
IMMUTABLE TEST CHANGE APPROVED BY RAMI
```

## Test locally

From the repository root:

```bash
node scripts/cloudflare_production_cache_purge_regression.mjs
```

Dry-run the purge script locally without calling Cloudflare:

```bash
CLOUDFLARE_API_TOKEN=example-token \
CLOUDFLARE_ZONE_ID=00000000000000000000000000000000 \
CLOUDFLARE_PURGE_DRY_RUN=true \
node scripts/cloudflare_purge_cache.mjs
```

## Production verification

After the PR is merged and Vercel production deploy succeeds:

1. Open the **Purge Cloudflare Cache After Production Deploy** workflow run.
2. Confirm the job completed successfully after the production deployment.
3. Open `https://www.nutsnews.com` and confirm the latest production changes are visible.
4. Optionally run the existing cache observability workflow to confirm public routes are still cacheable.
