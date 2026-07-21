# Deployment Environments, Secrets, And Recovery Runbook

This runbook is the maintainer checklist for the pre-merge deployment pipeline. It covers the GitHub environments, repository secrets, environment secrets, repository variables, target URLs, protected-target authentication, reruns, stale PR heads, and manual recovery paths used by NutsNews releases.

Normal release deployment happens before merge. The `Container Image` pull-request workflow deploys and smokes the immutable PR candidate across VPS staging, Vercel staging, Vercel production, and VPS production, then reports `Pre-merge deployment gate`. A `main` merge is not a deployment trigger; it is only the maintainer handoff that records the already-deployed candidate on `main`.

## Normal Release Targets

| Order | Jobs | Target type | Runtime env | GitHub environment | Target URL source | Expected target URL |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `deploy-vps-staging`, `ui-smoke-vps-staging` | `vps-staging` | `staging` | None | `NUTSNEWS_VPS_STAGING_URL`, or the infra deployment status `target_url` when returned | Defaults to `https://staging.nutsnews.com/` |
| 2 | `deploy-vercel-staging`, `ui-smoke-vercel-staging` | `vercel-staging` | `staging` | None | `deploy-vercel-staging.outputs.target_url` from `vercel deploy --target "$VERCEL_STAGING_TARGET"` | Exact immutable Vercel deployment URL returned by the deploy job; it must not be `nutsnews.com` or `www.nutsnews.com` |
| 3 | `deploy-vercel-production`, `ui-smoke-vercel-production` | `vercel-production` | `production` | `Production` | `NUTSNEWS_VERCEL_PRODUCTION_ALIASES`; deploy evidence selects the first validated alias as `target_url` | Defaults to `https://www.nutsnews.com/` and also validates `https://nutsnews.com/` |
| 4 | `deploy-vps-production`, `ui-smoke-vps-production` | `production-vps` | `production` | `Production` | `NUTSNEWS_VPS_PRODUCTION_URL`, or the infra deployment status `target_url` when returned | Defaults to `https://www.nutsnews.com/` |

The staging deployment jobs intentionally do not use a GitHub environment. Secrets needed by VPS staging or Vercel staging must be repository secrets because those jobs do not enter an environment before reading them.

## GitHub Environments

| Environment | Required for | Purpose |
| --- | --- | --- |
| `Production` | `deploy-vercel-production`, `ui-smoke-vercel-production`, `deploy-vps-production`, `ui-smoke-vps-production`, `vercel-production-release.yml`, `vercel-backend-token-sync.yml` | Gates production deployment, production UI smoke, dispatch-only Vercel recovery, and production Vercel backend-token sync. Store production-only secrets here when staging does not need them. |
| `staging-supabase` | `staging-supabase-migration.yml` | Operator-only staging database migration recovery. This environment is adjacent to release recovery; it is not part of the normal VPS/Vercel deployment stage order. |
| `production-supabase` | `production-supabase-migration.yml` | Operator-only production database migration recovery with protected Supabase access. This environment is adjacent to release recovery; it is not part of the normal VPS/Vercel deployment stage order. |

## Repository Secrets

These secrets must be available at repository scope because at least one normal staging deployment job reads them outside a GitHub environment:

| Secret | Used by | Notes |
| --- | --- | --- |
| `NUTSNEWS_INFRA_STAGING_TOKEN` | `deploy-vps-staging`, `staging-release.yml` | Dispatches the immutable candidate to `ramideltoro/nutsnews-infra` with event `nutsnews-staging-release`. |
| `VERCEL_TOKEN` | Vercel staging deploy, Vercel production deploy/recovery, `vercel-backend-token-sync.yml` | Vercel API/CLI token for the configured project. The same name is used by staging and production workflows. |
| `VERCEL_ORG_ID` | Vercel staging deploy, Vercel production deploy/recovery, `vercel-backend-token-sync.yml` | Vercel team or org ID passed to deployment lookups. |
| `VERCEL_PROJECT_ID` | Vercel staging deploy, Vercel production deploy/recovery, `vercel-backend-token-sync.yml` | Vercel project ID used by `vercel pull`, deploy validation, and token sync. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel staging and Vercel production deploy/UI smoke jobs | Required when Vercel Deployment Protection is enabled for the target. The validation helpers still accept legacy `VERCEL_PROTECTION_BYPASS_SECRET`, but the GitHub workflows read `VERCEL_AUTOMATION_BYPASS_SECRET`. |
| `CF_ACCESS_CLIENT_ID` | VPS staging and VPS production deploy/UI smoke jobs | Required only when a VPS target is protected by Cloudflare Access. Must be configured with `CF_ACCESS_CLIENT_SECRET`. |
| `CF_ACCESS_CLIENT_SECRET` | VPS staging and VPS production deploy/UI smoke jobs | Required only when a VPS target is protected by Cloudflare Access. Must be configured with `CF_ACCESS_CLIENT_ID`. |

`GITHUB_TOKEN` is the built-in Actions token and does not need to be configured as a repository secret.

## Production Environment Secrets

These secrets should be scoped to the `Production` environment unless a staging job also needs them:

| Secret | Used by | Notes |
| --- | --- | --- |
| `NUTSNEWS_INFRA_PRODUCTION_TOKEN` | `deploy-vps-production` | Dispatches event `nutsnews-production-vps-release` to `ramideltoro/nutsnews-infra` after Vercel production UI smoke has passed. |
| `NUTSNEWS_BACKEND_API_TOKEN` | `vercel-production-release.yml`, `vercel-backend-token-sync.yml` | Required for backend PostgreSQL primary production releases and for syncing the readable encrypted Vercel Production variable. |

## Recovery And Operations Secrets

These are not normal VPS/Vercel stage inputs, but operators need them for recovery:

| Secret | Workflow | Scope |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | `cloudflare-production-cache-purge.yml` | Repository secret or operator-controlled production secret for manual cache purge recovery. |
| `CLOUDFLARE_ZONE_ID` | `cloudflare-production-cache-purge.yml` | Repository secret or operator-controlled production secret for manual cache purge recovery. |
| `NUTSNEWS_RULESET_AUDIT_TOKEN` | `main-ruleset-audit.yml` | Repository secret with fine-grained `Administration: read`; never exposed to PR workflows. |
| `NUTSNEWS_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY` | `supabase-backup.yml` | Repository secret for scheduled/manual production backup and restore fire drill. |
| `NUTSNEWS_STAGING_MIGRATION_DATABASE_URL` | `staging-supabase-migration.yml` | `staging-supabase` environment secret. |
| `NUTSNEWS_PRODUCTION_SUPABASE_ACCESS_TOKEN` | `production-supabase-migration.yml` | `production-supabase` environment secret for linked Supabase migration access. |

## Repository Variables

| Variable | Used by | Default or expected value |
| --- | --- | --- |
| `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF` | PR release artifact metadata, Cloudflare cache purge, Supabase backup, production migration | Required 20-character production Supabase project ref. The immutable PR artifact records this value before deployment. |
| `NUTSNEWS_PRODUCTION_SUPABASE_URL` | Cloudflare cache purge, Supabase backup | Required production Supabase REST URL for operator recovery workflows. |
| `NUTSNEWS_VPS_STAGING_URL` | VPS staging deploy/UI smoke | Optional; defaults to `https://staging.nutsnews.com/`. |
| `VERCEL_STAGING_ENVIRONMENT` | Vercel staging deploy | Optional; defaults to `preview` for `vercel pull`. |
| `VERCEL_STAGING_TARGET` | Vercel staging deploy | Optional; defaults to `staging` for `vercel deploy --target`. |
| `NUTSNEWS_PR_PRODUCTION_WRITES_PAUSED` | Vercel production deploy | Optional; defaults to `false`. Set to `true` only when production write surfaces must remain paused while validating the PR candidate. |
| `NUTSNEWS_VERCEL_PRODUCTION_ALIASES` | Vercel production deploy/UI smoke | Optional comma-separated HTTPS aliases; defaults to `https://www.nutsnews.com/,https://nutsnews.com/`. |
| `NUTSNEWS_VPS_PRODUCTION_URL` | VPS production deploy/UI smoke | Optional; defaults to `https://www.nutsnews.com/`. |

## Protected Target Authentication

Cloudflare Access is handled through service-token headers. When `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are both configured, deploy validation and the shared UI smoke wrapper send `CF-Access-Client-Id` and `CF-Access-Client-Secret` to the VPS target. The two values must be supplied together. If the target is public, omit both.

Vercel Deployment Protection is handled through `VERCEL_AUTOMATION_BYPASS_SECRET`. Deploy validation and the shared UI smoke wrapper send `x-vercel-protection-bypass`; staging helpers also set `x-vercel-set-bypass-cookie` when needed. The deploy helper still recognizes legacy `VERCEL_PROTECTION_BYPASS_SECRET`, but the workflow contract is `VERCEL_AUTOMATION_BYPASS_SECRET`.

All protected values are masked before use. Playwright traces are disabled when protected target headers are configured so retained UI smoke evidence does not capture bypass secrets, Cloudflare service tokens, cookies, or raw provider credentials.

## Rerun And Stale Head Recovery

If a normal pre-merge stage fails, rerun the failed job or rerun the `Container Image` workflow for the current PR head. The deploy jobs share concurrency group `nutsnews-premerge-deploy-pr-<pr_number>` with `cancel-in-progress: true`, so a newer run supersedes older active work for the same PR. Each deploy stage uses idempotency key `pr-<pr_number>-<source_commit>-<target_type>`, which lets the same PR head reconcile or supersede the same provider-side candidate instead of creating an unrelated release identity.

If the workflow reports a stale PR head, do not merge that run. Push, rebase, or otherwise update the PR branch, then rerun from the latest head SHA. The trusted eligibility gate, each protected deploy stage, and the final `Pre-merge deployment gate` re-check the live PR head before accepting evidence, so stale deployment evidence cannot satisfy branch protection.

## Manual Recovery Paths

Use these paths only for operator recovery. They are not branch-protection checks and do not run automatically after a `main` push.

| Need | Workflow | Trigger and required confirmation | Inputs to carry forward |
| --- | --- | --- | --- |
| Recover VPS staging to a known immutable candidate | `staging-release.yml` | `workflow_dispatch` with `confirmation` set to `request-vps-staging-recovery` | `source_commit`, `image_digest`, `build_id`, `schema_version`, `migration_head`, `supabase_project_ref` |
| Recover Vercel production from the protected infra chain | `vercel-production-release.yml` | `repository_dispatch` event `nutsnews-vercel-production-release`; no manual dispatch | `source_commit`, `image_digest`, `build_id`, `vps_apply_run_id`, `release_kind`; release payloads also include staging evidence, rollback payloads may omit staging qualification fields |
| Roll back VPS production to the recorded last-known-good release | `protected-nutsnews-rollback.yml` in `ramideltoro/nutsnews-infra` | `workflow_dispatch` with `rollback_confirmation` set to `rollback-recorded-last-known-good` | `failed_image_digest` and a sanitized `rollback_reason`; the infra workflow selects the recorded restored source commit, image digest, build ID, schema version, migration head, and Supabase project ref |
| Manually purge Cloudflare production cache | `cloudflare-production-cache-purge.yml` | `workflow_dispatch` with `confirmation` set to `purge-production-cache` | `reason` and optional `dry_run`; requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF`, and `NUTSNEWS_PRODUCTION_SUPABASE_URL` |
| Sync backend API token into Vercel Production | `vercel-backend-token-sync.yml` | `workflow_dispatch` with `confirmation` set to `sync-backend-api-token-to-vercel-production` | `NUTSNEWS_BACKEND_API_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` |
| Apply staging Supabase forward migrations | `staging-supabase-migration.yml` | `workflow_dispatch` with `confirmation` set to `apply-staging-supabase-migrations` | `source_commit`, `migration_head`; requires `NUTSNEWS_STAGING_MIGRATION_DATABASE_URL` in `staging-supabase` |
| Apply production Supabase forward migrations | `production-supabase-migration.yml` | `workflow_dispatch` with `confirmation` set to `apply-production-supabase-migrations` | `source_commit`, `migration_head`, fresh `backup_run_id`; requires `NUTSNEWS_PRODUCTION_SUPABASE_ACCESS_TOKEN` in `production-supabase` and `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF` |
| Verify backup/restore readiness | `supabase-backup.yml` | Schedule or `workflow_dispatch` | Produces `supabase-rest-backup` and `supabase-restore-fire-drill-report` artifacts retained for 14 days |

Use final gate deploy/UI evidence to choose recovery inputs. The useful identity fields are `source_commit`, `build_id`, `image_digest`, `deployment_id`, `target_url`, `runtime_env`, `deployment_target`, `workflow_run_id`, and `workflow_run_attempt`.

## Merge Handoff

Branch protection must require `Pre-merge deployment gate` and `Release candidate` for the current PR head with strict up-to-date checks enabled. After those gates pass, the maintainer may merge or enable GitHub native auto-merge. Do not add a custom workflow that pushes to `main`, merges the PR, or deploys from `main` after merge.
