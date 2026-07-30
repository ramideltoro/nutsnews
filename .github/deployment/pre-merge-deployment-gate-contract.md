# Historical Pre-Merge Deployment Gate And Current Main Release Contract

This document preserves the historical PR deployment pipeline contract for recovery reference and records the current post-merge release boundary. The default PR path no longer runs deployment stages from `container-image.yml`; branch protection remains lean, while every successful trusted `main` build now dispatches the exact immutable candidate into the staged qualification and protected production promotion chain.

For maintainer setup, target URLs, secrets, protected-target authentication, reruns, stale PR heads, rollback, and manual recovery paths, see [Deployment Environments, Secrets, And Recovery Runbook](./environments-secrets-recovery.md).

## Current Automatic Main Release

The current release order is:

```text
Merge Gate passes
maintainer or GitHub native auto-merge updates main
Container Image builds, smoke-tests, and publishes an immutable image
Request Automatic NutsNews Production Release validates exact-run metadata
infra deploys VPS staging
infra runs staging browser and admin-backend qualification
infra applies the qualified image to VPS production
app deploys, smokes, and promotes the same source commit to Vercel production
infra rolls VPS back automatically if the Vercel production stage fails
```

The automatic handoff accepts only a successful `Container Image` run whose event is a same-repository push, whose branch is `main`, and whose metadata matches the triggering workflow ID and commit. It has no production credentials. Its only write capability is the staging-only cross-repository dispatch token; production secrets remain behind the downstream infra and app production environments.

Production schema compatibility is checked before promotion. Database migration workflows remain separately protected and are not made automatic by this release trigger.

## Historical Scope

The historical PR contract treated the PR candidate as the only release unit. Every deployment stage deployed the same immutable candidate identity, and every UI test stage verified that the live target reported that same identity.

That retired contract performed deployment work before the merge. The current contract moves the staged release after a successful `main` image build while retaining the immutable identity and qualification requirements.

## Required Stage Order

The required order is:

```text
VPS staging
UI tests
Vercel staging
UI tests
Vercel production
UI tests
VPS production
UI tests
```

Stages must run serially. A deploy stage may start only after the previous UI test stage has passed, and the final gate may pass only after the VPS production UI tests have passed.

| Order | Stage | Deployment target | Runtime env | Required evidence type |
| --- | --- | --- | --- | --- |
| 1 | Deploy PR candidate to VPS staging | `vps-staging` | `staging` | Target-specific deploy evidence |
| 2 | Run shared UI smoke suite against VPS staging | `vps-staging` | `staging` | Reusable UI test evidence |
| 3 | Deploy PR candidate to Vercel staging | `vercel-staging` | `staging` | Target-specific deploy evidence |
| 4 | Run shared UI smoke suite against Vercel staging | `vercel-staging` | `staging` | Reusable UI test evidence |
| 5 | Deploy PR candidate to Vercel production | `vercel-production` | `production` | Target-specific deploy evidence |
| 6 | Run shared UI smoke suite against Vercel production | `vercel-production` | `production` | Reusable UI test evidence |
| 7 | Deploy PR candidate to VPS production | `production-vps` | `production` | Target-specific deploy evidence |
| 8 | Run shared UI smoke suite against VPS production | `production-vps` | `production` | Reusable UI test evidence |

`production-vps` is the current runtime identity used by the app for the VPS production target. The stage label remains VPS production.

## Evidence Fields

Every stage must publish sanitized evidence with these field names:

| Field | Meaning |
| --- | --- |
| `source_commit` | Full commit SHA for the PR candidate being released. |
| `build_id` | Build identity for the immutable PR release artifact. |
| `image_digest` or `deployment_id` | Immutable deployed unit. VPS stages use `image_digest`; Vercel stages use `deployment_id`. |
| `target_url` | URL used by the deploy verifier or UI smoke suite. |
| `runtime_env` | Runtime environment reported by the target, such as `staging` or `production`. |
| `deployment_target` | Runtime deployment target reported by the target, such as `vps-staging`, `vercel-staging`, `vercel-production`, or `production-vps`. |
| `workflow_run_id` | GitHub Actions run ID that produced the deploy or UI test evidence. |
| `test_artifact_links` | Links or artifact names for retained UI smoke output, traces, summaries, screenshots, or machine-readable evidence. |

The evidence must be immutable for the workflow run that produced it. A later stage must consume the prior stage evidence by candidate identity and must fail closed when `source_commit`, `build_id`, runtime env, or deployment target do not match.

## Evidence Boundaries

Reusable UI test evidence comes from the shared UI smoke suite. It must be target-agnostic and limited to target URL, expected runtime identity, expected release identity, safe auth headers, test result, and retained test artifacts.

Target-specific deploy evidence comes from the platform workflow that changed an environment. It may include provider-specific details such as a VPS image digest, infra apply run, GitOps deployment ID, Vercel deployment ID, Vercel promotion result, or alias verification result.

UI test evidence must not replace deploy evidence. Deploy evidence must not replace UI test evidence. The final gate needs both for every target.

## Deployed UI Smoke Command

The shared deployed UI smoke command is `npm run test:e2e:deployed` from `web/`. The command runs the same Playwright spec against `PLAYWRIGHT_BASE_URL` for VPS staging, Vercel staging, Vercel production, and VPS production.

Target-specific expectations must be supplied through environment variables, not copied spec files. Deployment jobs must call this same command for every release target so the retained UI evidence is comparable across providers.

Each UI test job must retain a JUnit report, HTML report, trace-on-failure output when protected headers are not configured, and `web/test-results/deployed-ui-smoke/evidence.json`. The JSON evidence must include `target_url`, `target_type`, `source_commit`, `build_id`, `deployment_id`, `result`, and artifact paths so the final gate can validate evidence without parsing free-form logs.

UI smoke artifact names must include the target, PR number or workflow run ID, and run attempt, for example `nutsnews-ui-smoke-vps-staging-pr-42-attempt-1`.

Protected target authentication is configured through environment variables. `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` provide Cloudflare Access service-token headers and must be supplied together. `VERCEL_AUTOMATION_BYPASS_SECRET` or `VERCEL_PROTECTION_BYPASS_SECRET` provides Vercel Deployment Protection bypass headers. Public production targets may omit all protected-target header variables.

Retained UI artifacts must not include protected-target secrets. Playwright traces are disabled when protected-target headers are configured, and workflows must mask the Cloudflare and Vercel header values before running the shared command.

The Vercel preview workflow remains separate for non-release previews, but it delegates to `npm run test:e2e:deployed` so preview behavior uses the shared deployed-target smoke coverage.

## Deployment Hardening

Deployment and UI smoke jobs must use `scripts/deployment_hardening.mjs` helpers for bounded exponential backoff, transient network/API retries, and terminal deployment polling. The helper owns the common behavior for GitHub workflow polling, GitHub infra deployment status polling, and Vercel deployment polling.

Transient network failures and HTTP `408`, `425`, `429`, `500`, `502`, `503`, and `504` responses are retried until the bounded timeout. Validation failures such as stale PR heads, source commit mismatches, build ID mismatches, deployment target mismatches, malformed evidence, and provider terminal failure states fail fast.

Pre-merge deploy pipelines must use the concurrency group `nutsnews-premerge-deploy-pr-<pr_number>` with `cancel-in-progress: true` so a newer run supersedes older active work for the same PR. Each deploy stage must use the stable idempotency key `pr-<pr_number>-<source_commit>-<target_type>`; rerunning the same PR head either reuses the same provider deployment identity or explicitly supersedes the previous attempt for that idempotency key.

Every deploy and UI test stage must set an explicit GitHub Actions `timeout-minutes` value and pass a bounded helper timeout for any provider polling loop. Logs and summaries must include PR number, target type, source commit, build ID, deployment ID, workflow run ID, and run attempt when available, but must never print tokens, protected auth headers, cookies, or raw provider secret values.

## Trusted PR Eligibility

The pre-merge deployment pipeline is deployment-eligible only for same-repository PR branches in `ramideltoro/nutsnews`. Fork PRs and other untrusted PR sources are not deployment-eligible.

The eligibility gate must compare the event PR head SHA with the current PR head SHA from the GitHub API before any deployment stage can run. If the PR head changed after the workflow started, deployment stages must skip or fail closed and must write a clear check summary explaining that the candidate is stale.

Every protected deployment stage must re-check that the live PR head SHA still matches the trusted PR head SHA before reading protected environment secrets or changing a target. Deployment workflows must not use `pull_request_target` or an equivalent pattern that checks out untrusted PR code with production secrets.

## PR Release Artifact

The pre-merge pipeline must publish one immutable PR release artifact before any deployment stage starts. The artifact is built from the exact current PR head SHA after trusted PR eligibility has passed and after the live PR head is rechecked.

Downstream deployment jobs must consume `needs.pr-release-artifact.outputs.metadata_json` or the matching scalar outputs from that same job. They must not rebuild, retag, or infer a different artifact identity.

The artifact identity is the full source commit SHA plus the immutable image digest. PR images are tagged only with the full source commit SHA and are consumed as `ghcr.io/ramideltoro/nutsnews@sha256:<digest>`; the pipeline must never use a mutable `latest` tag.

The PR metadata artifact is retained for 7 days. PR images are tagged only with the full source commit SHA so registry cleanup can safely remove unreferenced PR candidates after PR close or after no deployment evidence references the digest.

## VPS Staging Deploy

The `deploy-vps-staging` PR job dispatches the exact `needs.pr-release-artifact.outputs.metadata_json` identity to `ramideltoro/nutsnews-infra` using the existing `nutsnews-staging-release` event. The dispatch payload is limited to schema version, migration head, Supabase project ref, source repository, source commit, image repository, image digest, build ID, and source workflow run ID.

The stage computes a deterministic `stg-<sha24>` deployment ID from that payload and uses `pr-<pr_number>-<source_commit>-vps-staging` as its idempotency key. Reruns of the same PR head and run attempt reuse the same build ID, deployment ID, and idempotency key.

The stage must wait for a terminal GitHub infra deployment status before succeeding. Infra creates that success status only after its fixed-command deploy has verified the deployed `/readyz` runtime identity, config generation, and running image digest from inside the protected staging boundary. App-side deploy evidence must include target URL, deployment ID, infra run ID, source commit, build ID, image digest, runtime env `staging`, deployment target `vps-staging`, workflow run ID, and run attempt. The verified infra status must report runtime env `staging`, deployment target `vps-staging`, and `infra staging qualification` readiness before later deployment stages may start.

## VPS Staging UI Smoke

The `ui-smoke-vps-staging` PR job starts only after `deploy-vps-staging` succeeds. Because VPS staging is protected by Cloudflare Access credentials stored in `ramideltoro/nutsnews-infra`, the app repo does not browser-hit staging directly. It waits for the protected infra `Qualify Verified NutsNews Staging Candidate` workflow to publish a passing `staging-qualification-...` artifact for the same staging deployment ID and then writes standardized app-side smoke evidence.

The stage must call `node scripts/pr_vps_staging_qualification.mjs`, which delegates the browser qualification to infra while still emitting `web/test-results/deployed-ui-smoke/evidence.json` through the shared evidence schema. It must upload the standardized `nutsnews-ui-smoke-vps-staging-...` artifact and include a `delegated_to` block with the infra qualification repository, workflow, run ID, deploy run ID, artifact name, and URL.

## Vercel Staging Deploy

The `deploy-vercel-staging` PR job starts only after `ui-smoke-vps-staging` succeeds. It deploys the exact PR source commit from `needs.pr-release-artifact.outputs.source_commit` to the configured Vercel staging target and must not rebuild from any mutable branch ref.

The stage must record Vercel deployment URL, Vercel deployment ID, Vercel source SHA, source commit, build ID, image digest, runtime env `staging`, and deployment target `vercel-staging`. It must verify the deployment target is not `production` and that no production host alias such as `nutsnews.com` or `www.nutsnews.com` is attached before later stages may start.

## Vercel Staging UI Smoke

The `ui-smoke-vercel-staging` PR job starts only after `deploy-vercel-staging` succeeds. `PLAYWRIGHT_BASE_URL` must be the exact Vercel staging deployment URL produced by `deploy-vercel-staging`, and the preflight identity check must confirm the expected PR source commit, build ID, runtime env `staging`, and deployment target `vercel-staging`.

The stage uses the same `node ../scripts/run_deployed_ui_smoke_with_evidence.mjs` wrapper as VPS staging. When `VERCEL_AUTOMATION_BYPASS_SECRET` is configured, the Vercel Deployment Protection bypass header is masked and traces are disabled by the shared protected-target header helper before artifacts are uploaded.

## Vercel Production Deploy

The `deploy-vercel-production` PR job starts only after `ui-smoke-vercel-staging` succeeds. It stages the exact PR source commit with `vercel deploy --prod --skip-domain`, promotes that deployment after validation, and must not deploy a mutable branch ref or a different build ID.

The stage must verify Vercel deployment ID, Vercel source SHA, staged deployment URL, and the configured Vercel secondary production target before succeeding. Normal validation must not assume `www.nutsnews.com` or `nutsnews.com` belong to Vercel, because those hostnames are VPS-primary after cutover. Apex and `www` may be verified as Vercel failover aliases only when `NUTSNEWS_VERIFY_VERCEL_FAILOVER_ALIASES=true` during a controlled DNS failover test. Its deploy evidence must include source commit, build ID, image digest, deployment ID, deployment URL, `vercel_secondary_targets`, any `vercel_failover_aliases`, runtime env `production`, deployment target `vercel-production`, workflow run ID, and run attempt.

## Vercel Production UI Smoke

The `ui-smoke-vercel-production` PR job starts only after `deploy-vercel-production` succeeds. The base URL is the Vercel secondary target selected by the deploy evidence, and the identity preflight must confirm the expected PR source commit, build ID, runtime env `production`, and deployment target `vercel-production` before browser tests start.

The stage uses the shared `node ../scripts/run_deployed_ui_smoke_with_evidence.mjs` wrapper and sets `NUTSNEWS_PRODUCTION_SAFE_SURFACES=true` for the smoke profile. Production UI smoke must avoid destructive writes and retain the standardized `nutsnews-ui-smoke-vercel-production-...` evidence artifact.

## VPS Production Deploy

The `deploy-vps-production` PR job starts only after `ui-smoke-vercel-production` succeeds. It dispatches `nutsnews-production-vps-release` to `ramideltoro/nutsnews-infra` with a compact versioned payload containing the same immutable PR artifact identity, the Vercel production deployment ID that already passed UI smoke, deterministic `prod-<sha24>` deployment ID, and idempotency key `pr-<pr_number>-<source_commit>-production-vps`.

The stage waits for the protected infra pre-merge VPS production workflow to complete, records infra run ID, target URL, source commit, build ID, image digest, workflow run ID, and run attempt, and verifies `/readyz` reports runtime env `production` and deployment target `production-vps` before succeeding. The default VPS production target URL is `https://www.nutsnews.com/`; `https://vps.nutsnews.com/` remains the direct-origin URL for pre-cutover or origin-only checks.

## VPS Production UI Smoke

The `ui-smoke-vps-production` PR job starts only after `deploy-vps-production` succeeds. The base URL is the VPS production target URL from deploy evidence, and the identity preflight must confirm the expected PR source commit, build ID, image digest, runtime env `production`, and deployment target `production-vps` before browser tests start.

The stage uses the same `node ../scripts/run_deployed_ui_smoke_with_evidence.mjs` wrapper as the other deployed targets, sets `NUTSNEWS_UI_SMOKE_TARGET_TYPE=production-vps`, sets `NUTSNEWS_PRODUCTION_SAFE_SURFACES=true`, and retains the standardized `nutsnews-ui-smoke-production-vps-...` evidence artifact. The shared production smoke profile is limited to public read-only surfaces, search `GET` requests, and browser-local theme/language changes; destructive flows such as contact submission, admin mutations, feed controls, cache purges, and ingestion controls are intentionally skipped.

## Merge And Main Behavior

Ordinary PRs do not deploy before merge. The maintainer merges only after GitHub shows `Merge Gate` and any other required checks green for the current PR head. The legacy `Release candidate` check is not a direct branch-protection status for ordinary PR merges.

GitHub native auto-merge may be enabled on a PR, but it must rely only on the required branch-protection checks and GitHub's current-head enforcement. The repo must not add a custom workflow, PAT, deploy key, or GitHub App token that pushes to `main` or merges the PR after deployments pass.

Branch protection must block merge until `Merge Gate` passes for the current PR head, with strict up-to-date required checks enabled. After merge, `Container Image` builds and validates the exact `main` commit. Only successful image publication may trigger `automatic-production-release.yml`, which dispatches that immutable candidate to the existing protected staging and production chain.

The automatic deployment workflow must never push or merge `main`, accept fork workflow runs, deploy a mutable branch ref, skip staging qualification, or attach production credentials before the downstream protected environments.

## Required Merge Check

The required branch-protection check for ordinary PR merges is:

```text
Merge Gate
```

`Merge Gate` is the lean PR check that covers dependency install, TypeScript, lint, focused web regressions, security headers, and production build without coupling branch protection to image publishing or deployment jobs.

`Release candidate` is no longer a direct branch-protection check, and the ruleset audit must fail if it is re-added as an ordinary merge requirement.

The `pre-merge-deployment-gate` job depends on the trusted eligibility gate, the immutable PR release artifact, all four deployment jobs, and all four shared UI smoke jobs. For deployment-eligible PRs it downloads each retained evidence artifact, verifies every stage concluded `success`, verifies UI smoke evidence concluded `pass`, and fails closed on cancelled, skipped, stale, or missing evidence.

Every evidence file must reference the current live PR head SHA, build ID, workflow run ID, and run attempt. The gate re-reads the current PR head from the GitHub API before validating evidence. If the trusted eligibility gate marked the PR intentionally ineligible, the final check may pass with a skipped deployment summary and no target evidence.

The check summary must list the stage order, target URLs, deployment IDs, result, and GitHub artifact links for every retained deploy and UI smoke evidence artifact.

The release workflow regression path verifies that exactly one reviewed post-main automatic handoff exists, that it consumes only exact-run `Container Image` metadata, and that manual recovery and dispatch-only production workflows cannot bypass the staged qualification chain.
