# Workflow Check Inventory

This inventory supports issue #309 and the branch protection update in issue #333. Branch protection should require the lean `Merge Gate` check for ordinary PR merges.

No deployment work is hidden inside a workflow classified as an existing check. Workflows that mutate environments, purge production cache, sync protected provider secrets, or dispatch deployments are classified as manual recovery or deprecated post-main work instead of PR-required checks.

## Classification Rules

- PR-required: must run before merge for relevant PRs, either directly or through the final `Pre-merge deployment gate`.
- optional PR: can run for PR or preview feedback but is not a required release blocker.
- scheduled/operational: monitors live production, repository posture, or reporting state and may remain scheduled, tag-based, or manual because it is not a deployment stage.
- manual recovery: protected operator workflow for data, token, cache, or recovery work; never a hidden merge check.
- dispatch-only recovery: repository dispatch workflow accepted only from a protected recovery chain; never a hidden merge check and never triggered by `main`.

## PR Pipeline Budget

A default PR-triggered workflow is a workflow with a `pull_request` trigger that has no trigger-level `paths` or `paths-ignore` constraint and is not label-only. The default PR workflow budget is at most 8 workflows. The target operating range is 5-8, but the guard enforces the maximum only so path-filtered checks are not added back just to satisfy a lower bound.

Ordinary PR workflows must not use protected production or deployment environments. `Merge Gate` is the single default PR owner for TypeScript, lint, and production build failures. Heavyweight checks such as Lighthouse, Playwright smoke, visual regression, accessibility, CodeQL, Snyk, OSV, deployment, and live cache observability must be path-filtered, scheduled, manual, or label-triggered rather than broad default PR checks.

Manual recovery and dispatch-only release workflows are outside this budget because they do not run on ordinary PRs.

## Inventory

| Workflow | Classification | Why it belongs there | Deployment note |
| --- | --- | --- | --- |
| `accessibility-ci.yml` | PR-required | Runs local axe and Playwright accessibility coverage only for UI or accessibility-test changes before merge. | No deployment. |
| `actionlint.yml` | PR-required | Lints GitHub Actions changes before workflow changes merge. | No deployment. |
| `admin-access-denied-contract.yml` | PR-required | Verifies the protected admin access-denied contract before merge. | No deployment. |
| `api-contracts.yml` | PR-required | Verifies API, route, sitemap, robots, and runtime compatibility before merge. | No deployment. |
| `app-store-docs-check.yml` | PR-required | Blocks regressions to public support/privacy docs only when App Store documentation inputs change. | No deployment. |
| `cloudflare-cache-config.yml` | PR-required | Runs deterministic cache observability config and public cache policy regressions for cache-related changes before merge. | No deployment. |
| `cloudflare-cache-observability.yml` | scheduled/operational | Runs scheduled or manually requested live Cloudflare/VPS-primary cache policy probes and uploads observability artifacts. | No deployment. |
| `cloudflare-production-cache-purge-regression.yml` | PR-required | Guards the production cache purge workflow contract before purge automation changes merge. | No deployment. |
| `cloudflare-production-cache-purge.yml` | manual recovery | Typed operator workflow for manual production cache purge recovery; it no longer reacts to deployment statuses after merge. | Mutates production cache only on manual dispatch. |
| `codeql.yml` | PR-required | Runs CodeQL for source, script, workflow, and security-config PRs while keeping default-branch and scheduled security reporting. | No deployment. |
| `container-image.yml` | default-branch/manual | Builds, smoke-tests, and publishes immutable images only from main pushes or operator dispatches. Ordinary PRs no longer enter the container/release workflow, and database migration validation lives in `database-migration-gate.yml`. | No ordinary PR deployment. Main image publish remains artifact work. |
| `database-migration-gate.yml` | PR-required | Runs Supabase migration naming, reset, drift, lock, RLS, fixture, and migration request checks only for database-related changes. | No deployment. |
| `db-size-warning.yml` | scheduled/operational | Reports production database growth from protected production credentials on a schedule or operator request. | No deployment. |
| `dependency-review.yml` | PR-required | Blocks vulnerable dependency changes before merge. | No deployment. |
| `feed-health-report.yml` | scheduled/operational | Reports live feed and worker health from production data on a schedule or operator request. | No deployment. |
| `fluid-active-cpu-regression.yml` | PR-required | Verifies Vercel CPU safeguards only when runtime, cache, public API, cost guardrail, or regression inputs change. | No deployment. |
| `gitleaks.yml` | PR-required | Scans for committed secrets before merge while keeping default-branch and scheduled coverage. | No deployment. |
| `homepage-performance-budget.yml` | PR-required | Builds the app and enforces homepage bundle/performance budget review before merge. | No deployment. |
| `image-coverage-report.yml` | scheduled/operational | Reports live article image coverage from production data on a schedule or operator request. | No deployment. |
| `immutable-all-tests-guard.yml` | PR-required | Reports established test-like, guard, workflow, and test inventory changes only when those inputs change. | No deployment. |
| `immutable-tests-guard.yml` | PR-required | Reports locked preview smoke, guard script, and related workflow changes only when those protected inputs change. | No deployment. |
| `lighthouse-ci.yml` | scheduled/operational | Runs scheduled or manually requested Lighthouse audits; lighter merge-critical performance coverage remains in `homepage-performance-budget.yml`. | No deployment. |
| `link-check.yml` | PR-required | Checks Markdown links for documentation changes before merge; scheduled runs catch remote link rot. | No deployment. |
| `main-ruleset-audit.yml` | scheduled/operational | Uses an administration-read token to detect remote branch protection drift on schedule or operator request. | No deployment. |
| `merge-gate.yml` | PR-required | Provides the required lean merge check for dependency install, TypeScript, lint, focused web regressions, security headers, and production build. | No deployment. |
| `openssf-scorecard.yml` | scheduled/operational | Publishes repository security posture and SARIF on schedule or operator request; it is not a per-release blocker. | No deployment. |
| `osv-scanner.yml` | PR-required | Scans dependency-risk PRs before merge while keeping default-branch and scheduled full-repository reporting. | No deployment. |
| `owasp-zap-baseline.yml` | scheduled/operational | Passively scans live public targets on schedule or operator request without blocking every release. | No deployment. |
| `pagespeed-insights.yml` | scheduled/operational | Runs operator-requested PageSpeed audits against public URLs for monitoring and investigation. | No deployment. |
| `production-supabase-migration-regression.yml` | PR-required | Guards production migration workflow behavior before migration automation changes merge. | No deployment. |
| `production-supabase-migration.yml` | manual recovery | Protected, typed-confirmation workflow for applying production Supabase migrations. | Mutates production data schema. |
| `pr-pipeline-budget.yml` | PR-required | Reports default PR workflow count and blocks pipeline budget drift when workflow policy inputs change. | No deployment. |
| `public-reader-smoke.yml` | PR-required | Runs public reader Playwright smoke coverage for web and smoke harness changes before merge or after relevant main pushes. | No deployment. |
| `release-notes.yml` | scheduled/operational | Creates GitHub releases for tags or operator requests; it is release documentation, not a merge blocker. | No deployment. |
| `seo-structured-data.yml` | scheduled/operational | Audits currently live production structured data on schedule or operator request; local route coverage is already PR-gated by API contracts. | No deployment. |
| `sitemap-robots-check.yml` | PR-required | Runs local sitemap/robots contract coverage before merge and keeps live URL probing scheduled/manual. | No deployment. |
| `snyk.yml` | PR-required | Runs Snyk dependency tests for dependency-risk PRs while keeping default-branch project monitoring main-only. | No deployment. |
| `staging-release-regression.yml` | PR-required | Guards staging and release workflow contracts before release workflow changes merge. | No deployment. |
| `staging-release.yml` | manual recovery | Typed operator workflow for manual VPS staging recovery dispatch with an operator reason, bounded TTL declaration, and required auto-idle acknowledgement. | Dispatches staging only on manual recovery; teardown/off-state verification is owned by the infra auto-idle path. |
| `staging-supabase-migration-regression.yml` | PR-required | Guards staging migration workflow behavior before migration automation changes merge. | No deployment. |
| `staging-supabase-migration.yml` | manual recovery | Protected, typed-confirmation workflow for applying staging Supabase migrations. | Mutates staging data schema. |
| `supabase-backup.yml` | scheduled/operational | Creates and verifies production backups on schedule or operator request. | No deployment. |
| `supabase-restore-fire-drill-regression.yml` | PR-required | Guards restore fire drill automation before recovery workflow changes merge. | No deployment. |
| `supabase-standby-readiness-regression.yml` | PR-required | Guards the standby credential readiness workflow before protected standby automation changes merge. | No deployment. |
| `supabase-standby-readiness.yml` | manual recovery | Protected, typed-confirmation workflow for checking Supabase hot-standby credential readiness and direct DB connectivity. | Reads protected standby credentials only on manual dispatch; no app deployment and no row data export. |
| `translation-coverage.yml` | scheduled/operational | Reports live translation coverage from production data; strict release translation checks run in the PR release candidate. | No deployment. |
| `vercel-backend-token-sync.yml` | manual recovery | Protected operator workflow that syncs backend API token material into Vercel production. | Mutates protected provider configuration. |
| `vercel-preview-smoke.yml` | optional PR | Runs against Vercel preview deployment statuses or manual preview URLs; shared target-agnostic UI smoke evidence replaces it for required deployment gates. | No production deployment. |
| `vercel-production-release.yml` | dispatch-only recovery | Dispatch-only Vercel production recovery path accepted from the protected infra chain; normal PR releases use the pre-merge Vercel production deploy job. | Deploys Vercel production only from protected repository dispatch. |
| `visual-regression.yml` | PR-required | Runs Playwright visual regression only for high-risk UI, CSS, public asset, or visual snapshot changes before merge. | No deployment. |
| `web-ci.yml` | default-branch/manual | Keeps the Web CI command set available for default-branch and operator-triggered validation after PR coverage moved to `Merge Gate`. | No deployment. |
| `web-offline-e2e.yml` | PR-required | Runs offline end-to-end coverage before web changes merge. | No deployment. |

## Branch Protection Hand-Off

The main ruleset must require `Merge Gate` for the current PR head. `Release candidate` is no longer a direct branch-protection check, and strict required status checks must stay enabled so a stale PR head cannot merge. Scheduled/operational, default-branch/manual, manual recovery, and dispatch-only recovery workflows must not be direct merge checks.

Automatic post-main deployment workflows have been removed or rewired behind manual/dispatch-only recovery paths.
