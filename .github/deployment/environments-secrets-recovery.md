# Deployment Environments, Secrets, And Recovery Runbook

This runbook is the maintainer checklist for automatic deployment and explicit recovery paths. It covers the GitHub environments, repository secrets, environment secrets, repository variables, target URLs, protected-target authentication, reruns, stale source revisions, and manual recovery paths used by NutsNews releases.

Every successful same-repository merge to `main` now enters the automatic production release chain. `Container Image` builds and smoke-tests an immutable image, publishes exact-run release metadata, and `automatic-production-release.yml` validates that metadata before dispatching the candidate to the protected infra chain. The chain deploys VPS staging, runs the full staging qualification suite, applies VPS production, deploys and smokes Vercel production, and rolls VPS back automatically if Vercel promotion fails. Manual `Container Image` runs remain build-only.

Production database migrations remain separately protected. If the exact app source requires a migration that production has not applied, the infra promotion fails closed and directs the operator to the protected production migration workflow before retrying the release.

For the staging off-state, bounded enablement, auto-idle teardown, and
verification contract, see [Staging Active-Use Runbook](./staging-active-use-runbook.md).

## Normal Release Targets

| Order | Workflows or jobs | Target type | Runtime env | GitHub environment | Target URL source | Expected target URL |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `Container Image` and `automatic-production-release.yml` | immutable release candidate | N/A | None | Exact `main` source commit, workflow run ID, build ID, image digest, migration contract, and production project ref | GitHub Actions artifact plus protected `nutsnews-staging-release` repository dispatch |
| 2 | Infra `Deploy Verified NutsNews Staging Candidate` and `Qualify Verified NutsNews Staging Candidate` | `vps-staging` | `staging` | Infra `staging-vps` and `staging-tests` | The independently validated infra deployment record | `https://staging.nutsnews.com/` |
| 3 | Infra `Promote NutsNews Production Release` and `Protected Ansible Apply` | `production-vps` | `production` | Infra `production-vps` | The qualified immutable image and production manifest selected by the promotion workflow | `https://www.nutsnews.com/`; `https://vps.nutsnews.com/` remains the direct-origin verification URL |
| 4 | `vercel-production-release.yml` | `vercel-production` | `production` | App `Production` | Protected infra repository dispatch after successful VPS apply | Generated immutable Vercel deployment URL and configured secondary production URLs; apex and `www` are checked only during an explicit failover-alias test |

The automatic app handoff reads only the staging-only cross-repository token. VPS staging secrets remain isolated in infra environments, and production credentials are not available until the protected downstream workflows attach their production environments.

## GitHub Environments

| Environment | Required for | Purpose |
| --- | --- | --- |
| `automatic-release` | `automatic-production-release.yml` | Limits the post-main handoff to the protected default branch without exposing production secrets or requiring a manual reviewer. It reads the repository-scoped staging-only dispatch token and cannot access VPS or Vercel production credentials. |
| `Production` | `vercel-production-release.yml`, `vercel-backend-token-sync.yml` | Supplies production-only Vercel release, smoke, backend, and token-sync secrets. The normal release workflow reaches it only through the protected infra repository dispatch. |
| `staging-recovery` | `staging-release.yml` | Restricts the manual staging recovery dispatch to a reviewed default-branch workflow context. It uses the same staging-only repository token and does not expose production credentials. |
| `staging-supabase` | `staging-supabase-migration.yml` | Operator-only staging database migration recovery. This environment is adjacent to release recovery; it is not part of the normal VPS/Vercel deployment stage order. |
| `production-supabase` | `production-supabase-migration.yml` | Operator-only production database migration recovery with protected Supabase access. This environment is adjacent to release recovery; it is not part of the normal VPS/Vercel deployment stage order. |
| `supabase-standby` | `supabase-standby-readiness.yml` | Operator-only hot-standby credential readiness gate. It proves the protected existing production Supabase standby inventory and direct DB connectivity through the restricted backend forced-command SSH probe without exposing standby credentials to normal app, worker, or release workflows. |

`supabase/standby_manifest.json` is the source-controlled standby replication manifest for the existing production Supabase project. The manifest records the current Supabase migration head, schema fingerprint, exact base tables, excluded views/materialized views, primary-key or replica-identity rules, and sequence safety policy for backend PostgreSQL primary -> existing production Supabase standby sync. `supabase-standby-manifest-regression.yml` and `database-migration-gate.yml` run `node scripts/supabase_standby_manifest.mjs` so missing tables, missing primary key/replica identity metadata, excluded view drift, sequence drift, or schema fingerprint mismatch fails before merge. This manifest is not a failover approval; no app or worker writes may target Supabase before the approved failover path passes lag, parity, schema, sequence, writer-pause, and split-brain checks. Destructive Supabase retirement work is blocked until this manifest exists and validates, and after #505 standby acceptance it still requires explicit owner approval through #506 or a later cleanup issue. Standby credentials and sync resources are retained; standby credentials and sync resources must not be removed by blind cleanup. It targets existing production Supabase only, with no new Supabase project or `nutsnews-standby` database.

Issue #498 reconciliation is backend-owned in `ramideltoro/nutsnews-backend` through the protected `backend-supabase-standby-reconciliation.yml` workflow. That workflow compares backend PostgreSQL primary to the existing production Supabase standby target with safe metadata only, can apply a typed-confirmation backend-to-Supabase backfill when required, advances target sequences to a safe next value, and uploads the `backend-supabase-standby-reconciliation` report artifact. It reuses the backend `production-backend` environment and the existing production Supabase DB URL; it does not create a Supabase project, create a `nutsnews-standby` database, expose Supabase as the app/worker provider, or approve failover.

## Repository Secrets

These secrets must be available at repository scope because at least one normal staging deployment job reads them outside a GitHub environment:

| Secret | Used by | Notes |
| --- | --- | --- |
| `NUTSNEWS_INFRA_STAGING_TOKEN` | `automatic-production-release.yml`, `staging-release.yml`, `vercel-production-release.yml` | Dispatches the exact immutable candidate to `ramideltoro/nutsnews-infra` with event `nutsnews-staging-release`; the Vercel release workflow also uses it to verify the matching staging qualification and admin-backend evidence before promotion. |
| `VERCEL_TOKEN` | `vercel-production-release.yml`, `vercel-backend-token-sync.yml` | Vercel API/CLI token for the configured project. |
| `VERCEL_ORG_ID` | `vercel-production-release.yml`, `vercel-backend-token-sync.yml` | Vercel team or org ID passed to deployment lookups. |
| `VERCEL_PROJECT_ID` | `vercel-production-release.yml`, `vercel-backend-token-sync.yml` | Vercel project ID used by `vercel pull`, deployment validation, and token sync. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | `vercel-production-release.yml` | Required when Vercel Deployment Protection is enabled. The validation helpers still accept legacy `VERCEL_PROTECTION_BYPASS_SECRET`, but the workflow contract is `VERCEL_AUTOMATION_BYPASS_SECRET`. |
| `CF_ACCESS_CLIENT_ID` | VPS production deploy/UI smoke jobs when production is Cloudflare-protected | Required only when a VPS target tested by this app workflow is protected by Cloudflare Access. Must be configured with `CF_ACCESS_CLIENT_SECRET`. VPS staging browser qualification uses infra repo environment secrets instead. |
| `CF_ACCESS_CLIENT_SECRET` | VPS production deploy/UI smoke jobs when production is Cloudflare-protected | Required only when a VPS target tested by this app workflow is protected by Cloudflare Access. Must be configured with `CF_ACCESS_CLIENT_ID`. VPS staging browser qualification uses infra repo environment secrets instead. |

`GITHUB_TOKEN` is the built-in Actions token and does not need to be configured as a repository secret.

## Production Environment Secrets

These secrets should be scoped to the `Production` environment unless a staging job also needs them:

| Secret | Used by | Notes |
| --- | --- | --- |
| `NUTSNEWS_INFRA_PRODUCTION_TOKEN` | `deploy-vps-production` | Dispatches event `nutsnews-production-vps-release` to `ramideltoro/nutsnews-infra` after Vercel production UI smoke has passed, then waits for the protected pre-merge VPS production workflow run. |
| `NUTSNEWS_BACKEND_API_TOKEN` | `deploy-vps-production`, `vercel-production-release.yml`, `vercel-backend-token-sync.yml` | Required for backend PostgreSQL primary production releases, tokened admin backend operation smoke coverage, and syncing the readable encrypted Vercel Production variable. |

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
| `NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF` | `supabase-standby-readiness.yml` | `supabase-standby` environment secret for the existing production Supabase project ref. It must match `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF`. |
| `NUTSNEWS_STANDBY_SUPABASE_URL` | `supabase-standby-readiness.yml` | `supabase-standby` environment secret for the existing production Supabase HTTPS URL used as the standby target. |
| `NUTSNEWS_STANDBY_SUPABASE_DB_URL` | `supabase-standby-readiness.yml` | `supabase-standby` environment secret for the direct existing production Supabase Postgres URL. It must use the direct `db.<project-ref>.supabase.co:5432/postgres?sslmode=require` form. |
| `NUTSNEWS_STANDBY_SUPABASE_SERVICE_ROLE_KEY` | `supabase-standby-readiness.yml` | `supabase-standby` environment secret for future protected standby writes to the existing production Supabase project. Normal production app and worker traffic must not read it before an approved failover path exists. |
| `NUTSNEWS_STANDBY_SUPABASE_ANON_KEY` | `supabase-standby-readiness.yml` | `supabase-standby` environment secret for existing production Supabase client-readiness validation. It is retained inside the protected environment until failover approval. |
| `NUTSNEWS_STANDBY_PROBE_SSH_PRIVATE_KEY` | `supabase-standby-readiness.yml` | `supabase-standby` environment secret containing only the private half of the dedicated probe key. It is used only with BatchMode, IdentitiesOnly, strict host checking, disabled forwarding, and no remote command so the backend forced command owns the fixed read-only query. |
| `NUTSNEWS_STANDBY_PROBE_KNOWN_HOSTS` | `supabase-standby-readiness.yml` | `supabase-standby` environment secret containing the independently verified backend host key for strict SSH host checking. Do not replace it with an unreviewed fresh `ssh-keyscan` result. |

## Repository Variables

| Variable | Used by | Default or expected value |
| --- | --- | --- |
| `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF` | Automatic release metadata, Cloudflare cache purge, Supabase backup, production migration | Required 20-character production Supabase project ref. `Container Image` records this value in the exact-run metadata before the automatic release handoff. |
| `NUTSNEWS_PRODUCTION_SUPABASE_URL` | Cloudflare cache purge, Supabase backup | Required production Supabase REST URL for operator recovery workflows. |
| `NUTSNEWS_VPS_STAGING_URL` | VPS staging deploy/UI smoke | Optional; defaults to `https://staging.nutsnews.com/`. |
| `VERCEL_STAGING_ENVIRONMENT` | Vercel staging deploy | Optional; defaults to `preview` for `vercel pull`. |
| `VERCEL_STAGING_TARGET` | Vercel staging deploy | Optional; defaults to `staging` for `vercel deploy --target`. |
| `NUTSNEWS_PR_PRODUCTION_WRITES_PAUSED` | Vercel production deploy | Optional; defaults to `false`. Set to `true` only when production write surfaces must remain paused while validating the PR candidate. |
| `NUTSNEWS_PRIMARY_PRODUCTION_URL` | VPS production deploy/UI smoke, cache observability | Optional shared primary entrypoint; defaults to `https://www.nutsnews.com/`. |
| `NUTSNEWS_VPS_PRODUCTION_URL` | VPS production deploy/UI smoke | Optional override for the primary VPS smoke URL. After cutover it should be `https://www.nutsnews.com/` or omitted so the default applies. |
| `NUTSNEWS_VPS_PRODUCTION_DIRECT_URL` | Direct-origin VPS validation | Optional direct origin URL for pre-cutover or origin-only checks; defaults to `https://vps.nutsnews.com/`. |
| `NUTSNEWS_VERCEL_SECONDARY_PRODUCTION_URLS` | Vercel production release and recovery | Optional comma-separated HTTPS secondary Vercel URLs. If omitted, Vercel validation uses the generated immutable deployment URL. Must not contain `https://www.nutsnews.com/` or `https://nutsnews.com/`. |
| `NUTSNEWS_VERIFY_VERCEL_FAILOVER_ALIASES` | Controlled DNS failover validation | Optional boolean; defaults to `false`. Set to `true` only during a controlled DNS failover test where apex and `www` intentionally route to Vercel. |
| `NUTSNEWS_VERCEL_FAILOVER_PRODUCTION_ALIASES` | Controlled DNS failover validation | Optional comma-separated HTTPS aliases; defaults to `https://www.nutsnews.com/,https://nutsnews.com/` only when `NUTSNEWS_VERIFY_VERCEL_FAILOVER_ALIASES=true`. Legacy `NUTSNEWS_VERCEL_PRODUCTION_ALIASES` is accepted by the script only as a failover alias source. |
| `NUTSNEWS_CACHE_OBSERVABILITY_URL` | Cloudflare cache observability | Optional live cache audit URL; falls back to `NUTSNEWS_PRIMARY_PRODUCTION_URL` and then `https://www.nutsnews.com`. |
| `NUTSNEWS_STANDBY_PROBE_HOST` | Supabase standby readiness | Required fixed existing backend address for the restricted backend forced-command SSH probe. |
| `NUTSNEWS_STANDBY_PROBE_USER` | Supabase standby readiness | Required locked backend probe account; expected value is `nutsnews-standby-probe`. |

## Failover Controller Configuration

The DNS failover controller uses these named settings. Keep the values synchronized across app docs, infra automation, and Cloudflare worker/controller configuration:

| Setting | Default | Meaning |
| --- | --- | --- |
| `NUTSNEWS_FAILOVER_HEALTH_CHECK_INTERVAL_SECONDS` | `15` seconds | Check the direct VPS readiness endpoint on a 15-second cadence with no-store/cache-busting requests. |
| `NUTSNEWS_FAILOVER_CONSECUTIVE_VPS_FAILURES` | `3` consecutive VPS failures | Move apex and `www` DNS to Vercel only after three consecutive failed VPS readiness checks. |
| `NUTSNEWS_FAILBACK_DNS_STATE_GATE` | `current_dns_state_is_vercel_fallback_and_vps_ready` | Fail back to VPS only when the current Cloudflare DNS state still matches the Vercel fallback records and the direct VPS readiness probe is healthy. |

## Protected Target Authentication

Cloudflare Access is handled through service-token headers. When `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` are both configured, deploy validation and the shared UI smoke wrapper send `CF-Access-Client-Id` and `CF-Access-Client-Secret` to the VPS target. The two values must be supplied together. If the target is public, omit both. VPS staging is qualified through the infra repo's protected `staging-tests` environment, which stores `NUTSNEWS_STAGING_ACCESS_CLIENT_ID` and `NUTSNEWS_STAGING_ACCESS_CLIENT_SECRET`; the app repository dispatches only the exact candidate identity and never reads those secrets.

Vercel Deployment Protection is handled through `VERCEL_AUTOMATION_BYPASS_SECRET`. Deploy validation sends `x-vercel-protection-bypass` first and falls back to the documented `x-vercel-protection-bypass` query parameter when Vercel protection redirects or blocks the header probe. The shared UI smoke wrapper sends `x-vercel-protection-bypass` and can set `x-vercel-set-bypass-cookie` when browser cookie setup is needed. The deploy helper still recognizes legacy `VERCEL_PROTECTION_BYPASS_SECRET`, but the workflow contract is `VERCEL_AUTOMATION_BYPASS_SECRET`.

All protected values are masked before use. Playwright traces are disabled when protected target headers are configured so retained UI smoke evidence does not capture bypass secrets, Cloudflare service tokens, cookies, or raw provider credentials.

## Rerun And Stale Head Recovery

If the automatic handoff fails before infra accepts it, rerun the failed `Container Image` workflow so the new successful run emits a self-consistent build ID, digest, and metadata artifact. If a downstream staging, qualification, promotion, VPS apply, or Vercel job fails, rerun that failed workflow with the same reviewed source commit and immutable image identity. The infra workflows serialize releases and validate source reachability, exact candidate identity, staging evidence, schema compatibility, and immutable digests before mutating production.

If a release is superseded by a newer `main` merge, allow the queued immutable candidates to finish in order or cancel the older run before its cross-repository dispatch. Never substitute metadata from one workflow run into another.

## Manual Recovery Paths

Use these paths only for operator recovery. They are not branch-protection checks. `vercel-production-release.yml` is also the final Vercel stage of the normal automatic chain, but it still accepts only protected repository dispatches from infra.

| Need | Workflow | Trigger and required confirmation | Inputs to carry forward |
| --- | --- | --- | --- |
| Recover VPS staging to a known immutable candidate | `staging-release.yml` | `workflow_dispatch` with `confirmation` set to `request-vps-staging-recovery`, `operator_reason`, `validation_ttl_hours`, and `off_state_acknowledgement=staging-auto-idle-required` | `source_commit`, `image_digest`, `build_id`, `schema_version`, `migration_head`, `supabase_project_ref`; the operator reason and TTL stay in app-side audit summaries, not the infra candidate payload |
| Recover Vercel production from the protected infra chain | `vercel-production-release.yml` | `repository_dispatch` event `nutsnews-vercel-production-release`; no manual dispatch | `source_commit`, `image_digest`, `build_id`, `vps_apply_run_id`, `release_kind`; release payloads also include staging deployment and qualification evidence with passing admin backend operation smoke results, and backend-primary recoveries run production admin backend operation smoke before promotion. Rollback payloads may omit staging qualification fields |
| Roll back VPS production to the recorded last-known-good release | `protected-nutsnews-rollback.yml` in `ramideltoro/nutsnews-infra` | `workflow_dispatch` with `rollback_confirmation` set to `rollback-recorded-last-known-good` | `failed_image_digest` and a sanitized `rollback_reason`; the infra workflow selects the recorded restored source commit, image digest, build ID, schema version, migration head, and Supabase project ref |
| Manually purge Cloudflare production cache | `cloudflare-production-cache-purge.yml` | `workflow_dispatch` with `confirmation` set to `purge-production-cache` | `reason` and optional `dry_run`; requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF`, and `NUTSNEWS_PRODUCTION_SUPABASE_URL` |
| Sync backend API token into Vercel Production | `vercel-backend-token-sync.yml` | `workflow_dispatch` with `confirmation` set to `sync-backend-api-token-to-vercel-production` | `NUTSNEWS_BACKEND_API_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` |
| Apply staging Supabase forward migrations | `staging-supabase-migration.yml` | `workflow_dispatch` with `confirmation` set to `apply-staging-supabase-migrations` | `source_commit`, `migration_head`; requires `NUTSNEWS_STAGING_MIGRATION_DATABASE_URL` in `staging-supabase` |
| Apply production Supabase forward migrations | `production-supabase-migration.yml` | `workflow_dispatch` with `confirmation` set to `apply-production-supabase-migrations` | `source_commit`, `migration_head`, fresh `backup_run_id`; requires `NUTSNEWS_PRODUCTION_SUPABASE_ACCESS_TOKEN` in `production-supabase` and `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF` |
| Validate standby schema manifest | `supabase-standby-manifest-regression.yml` and `database-migration-gate.yml` | Pull request, `main` push, or database gate dispatch for migration/manifest changes | Reads only source-controlled `supabase/standby_manifest.json` and `supabase/migrations/**`; verifies exact replicated table coverage, excluded view coverage, primary-key/replica-identity metadata, sequence safety metadata, and schema fingerprint. No secrets, no protected environment, no live database, no deployment. |
| Verify Supabase hot-standby credential readiness | `supabase-standby-readiness.yml` | `workflow_dispatch` with `confirmation` set to `verify-supabase-standby-readiness` | Preflight and readiness run on `ubuntu-latest`; readiness uses the protected `supabase-standby` environment, pipes the direct DB URL to the restricted backend forced-command SSH probe over stdin, and requires exactly the safe `READY` token. Requires `NUTSNEWS_STANDBY_SUPABASE_PROJECT_REF`, `NUTSNEWS_STANDBY_SUPABASE_URL`, `NUTSNEWS_STANDBY_SUPABASE_DB_URL`, `NUTSNEWS_STANDBY_SUPABASE_SERVICE_ROLE_KEY`, `NUTSNEWS_STANDBY_SUPABASE_ANON_KEY`, `NUTSNEWS_STANDBY_PROBE_SSH_PRIVATE_KEY`, and `NUTSNEWS_STANDBY_PROBE_KNOWN_HOSTS` in `supabase-standby`, with the standby ref matching `NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF`; fixed repository variables provide `NUTSNEWS_STANDBY_PROBE_HOST` and `NUTSNEWS_STANDBY_PROBE_USER`. It emits only safe metadata and the backend read-only direct-connectivity result. This is not a failover approval; lag <= 30 seconds, parity, schema, sequence, writer-pause, and split-brain checks must pass first. |
| Verify backup/restore readiness | `supabase-backup.yml` | Schedule or `workflow_dispatch` | Produces `supabase-rest-backup` and `supabase-restore-fire-drill-report` artifacts retained for 14 days |

Use deploy/UI evidence from automatic release or recovery runs to choose recovery inputs. The useful identity fields are `source_commit`, `build_id`, `image_digest`, `deployment_id`, `target_url`, `runtime_env`, `deployment_target`, `workflow_run_id`, and `workflow_run_attempt`.

## Merge Handoff

Branch protection must require `Merge Gate` for the current PR head with strict up-to-date checks enabled. `Release candidate` is not a direct branch-protection check. After required checks pass, a maintainer merge or GitHub native auto-merge triggers `Container Image`; only its successful same-repository `main` push may activate `automatic-production-release.yml`.

No workflow may push or merge into `main`. Automatic deployment begins only after GitHub has completed the merge and the immutable build has passed. The handoff must continue to reject fork runs, non-`main` runs, failed builds, mismatched workflow IDs or commits, unexpected metadata fields, mutable image references, and incomplete migration or Supabase identity.
