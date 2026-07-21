# Workflow Check Inventory

This inventory supports issue #309 and is the input for the branch protection update in issue #310. Branch protection should use the final required check `Pre-merge deployment gate` and the PR-required checks listed here when the new pre-merge release pipeline is wired.

No deployment work is hidden inside a workflow classified as an existing check. Workflows that mutate environments, purge production cache, sync protected provider secrets, or dispatch deployments are classified as manual recovery or deprecated post-main work instead of PR-required checks.

## Classification Rules

- PR-required: must run before merge for relevant PRs, either directly or through the final `Pre-merge deployment gate`.
- optional PR: can run for PR or preview feedback but is not a required release blocker.
- scheduled/operational: monitors live production, repository posture, or reporting state and may remain scheduled, tag-based, or manual because it is not a deployment stage.
- manual recovery: protected operator workflow for data, token, cache, or recovery work; never a hidden merge check.
- deprecated post-main work: current deployment or post-deployment automation that must be replaced by the pre-merge deployment gate path.

## Inventory

| Workflow | Classification | Why it belongs there | Deployment note |
| --- | --- | --- | --- |
| `accessibility-ci.yml` | PR-required | Runs local axe and Playwright accessibility coverage before web changes merge. | No deployment. |
| `actionlint.yml` | PR-required | Lints GitHub Actions changes before workflow changes merge. | No deployment. |
| `admin-access-denied-contract.yml` | PR-required | Verifies the protected admin access-denied contract before merge. | No deployment. |
| `api-contracts.yml` | PR-required | Verifies API, route, sitemap, robots, and runtime compatibility before merge. | No deployment. |
| `app-store-docs-check.yml` | PR-required | Blocks regressions to public support/privacy docs needed by the iOS/PWA release surface. | No deployment. |
| `cloudflare-cache-observability.yml` | PR-required | Runs cache configuration regression on PRs; live cache probing remains scheduled/manual operational monitoring. | No deployment. |
| `cloudflare-production-cache-purge-regression.yml` | PR-required | Guards the production cache purge workflow contract before purge automation changes merge. | No deployment. |
| `cloudflare-production-cache-purge.yml` | deprecated post-main work | Currently reacts to production deployment statuses and purges Cloudflare after deployment; this belongs in the pre-merge/recovery plan, not as an existing check. | Mutates production cache. |
| `codeql.yml` | PR-required | Runs CodeQL before merge while keeping default-branch and scheduled security reporting. | No deployment. |
| `container-image.yml` | PR-required | Builds, smoke-tests, runs migration gates, publishes the immutable PR artifact, emits the current `Release candidate` check, and for trusted same-repository PRs dispatches the first pre-merge VPS staging deployment stage plus the shared VPS staging UI smoke gate. | Deploys only the trusted PR candidate to VPS staging before merge, then runs shared UI smoke evidence against that target; main image publish is artifact work. |
| `db-size-warning.yml` | scheduled/operational | Reports production database growth from protected production credentials on a schedule or operator request. | No deployment. |
| `dependency-review.yml` | PR-required | Blocks vulnerable dependency changes before merge. | No deployment. |
| `feed-health-report.yml` | scheduled/operational | Reports live feed and worker health from production data on a schedule or operator request. | No deployment. |
| `fluid-active-cpu-regression.yml` | PR-required | Verifies Vercel CPU safeguards before changes merge. | No deployment. |
| `gitleaks.yml` | PR-required | Scans for committed secrets before merge while keeping default-branch and scheduled coverage. | No deployment. |
| `homepage-performance-budget.yml` | PR-required | Builds the app and enforces homepage bundle/performance budget review before merge. | No deployment. |
| `image-coverage-report.yml` | scheduled/operational | Reports live article image coverage from production data on a schedule or operator request. | No deployment. |
| `immutable-all-tests-guard.yml` | PR-required | Ensures required all-test guard configuration cannot be weakened before merge. | No deployment. |
| `immutable-tests-guard.yml` | PR-required | Ensures required test guard configuration cannot be weakened before merge. | No deployment. |
| `lighthouse-ci.yml` | PR-required | Builds the app and runs Lighthouse CI before merge. | No deployment. |
| `link-check.yml` | PR-required | Checks Markdown links for documentation changes before merge; scheduled runs catch remote link rot. | No deployment. |
| `main-ruleset-audit.yml` | scheduled/operational | Uses an administration-read token to detect remote branch protection drift on schedule or operator request. | No deployment. |
| `openssf-scorecard.yml` | scheduled/operational | Publishes repository security posture and SARIF on schedule or operator request; it is not a per-release blocker. | No deployment. |
| `osv-scanner.yml` | PR-required | Scans dependency vulnerability changes before merge while keeping default-branch and scheduled reporting. | No deployment. |
| `owasp-zap-baseline.yml` | scheduled/operational | Passively scans live public targets on schedule or operator request without blocking every release. | No deployment. |
| `pagespeed-insights.yml` | scheduled/operational | Runs operator-requested PageSpeed audits against public URLs for monitoring and investigation. | No deployment. |
| `production-supabase-migration-regression.yml` | PR-required | Guards production migration workflow behavior before migration automation changes merge. | No deployment. |
| `production-supabase-migration.yml` | manual recovery | Protected, typed-confirmation workflow for applying production Supabase migrations. | Mutates production data schema. |
| `public-reader-smoke.yml` | PR-required | Runs public reader Playwright smoke coverage before web changes merge. | No deployment. |
| `release-notes.yml` | scheduled/operational | Creates GitHub releases for tags or operator requests; it is release documentation, not a merge blocker. | No deployment. |
| `seo-structured-data.yml` | scheduled/operational | Audits currently live production structured data on schedule or operator request; local route coverage is already PR-gated by API contracts. | No deployment. |
| `sitemap-robots-check.yml` | PR-required | Runs local sitemap/robots contract coverage before merge and keeps live URL probing scheduled/manual. | No deployment. |
| `snyk.yml` | PR-required | Runs Snyk dependency tests before merge while keeping default-branch project monitoring. | No deployment. |
| `staging-release-regression.yml` | PR-required | Guards staging and release workflow contracts before release workflow changes merge. | No deployment. |
| `staging-release.yml` | deprecated post-main work | Currently dispatches VPS staging after a successful `main` Container Image run; this must move behind the pre-merge gate. | Dispatches staging deployment. |
| `staging-supabase-migration-regression.yml` | PR-required | Guards staging migration workflow behavior before migration automation changes merge. | No deployment. |
| `staging-supabase-migration.yml` | manual recovery | Protected, typed-confirmation workflow for applying staging Supabase migrations. | Mutates staging data schema. |
| `supabase-backup.yml` | scheduled/operational | Creates and verifies production backups on schedule or operator request. | No deployment. |
| `supabase-restore-fire-drill-regression.yml` | PR-required | Guards restore fire drill automation before recovery workflow changes merge. | No deployment. |
| `translation-coverage.yml` | scheduled/operational | Reports live translation coverage from production data; strict release translation checks run in the PR release candidate. | No deployment. |
| `vercel-backend-token-sync.yml` | manual recovery | Protected operator workflow that syncs backend API token material into Vercel production. | Mutates protected provider configuration. |
| `vercel-preview-smoke.yml` | optional PR | Runs against Vercel preview deployment statuses or manual preview URLs; shared target-agnostic UI smoke evidence replaces it for required deployment gates. | No production deployment. |
| `vercel-production-release.yml` | deprecated post-main work | Currently deploys and promotes Vercel production from repository dispatch; this becomes a pre-merge deployment stage. | Deploys Vercel production. |
| `visual-regression.yml` | PR-required | Runs Playwright visual regression before web changes merge. | No deployment. |
| `web-ci.yml` | PR-required | Runs typecheck, lint, route tests, runtime safety, security, and build before web changes merge. | No deployment. |
| `web-offline-e2e.yml` | PR-required | Runs offline end-to-end coverage before web changes merge. | No deployment. |

## Branch Protection Hand-Off

Issue #310 should reference this inventory when updating branch protection. At minimum, it must require `Pre-merge deployment gate` for the current PR head and must not require scheduled/operational, manual recovery, or deprecated post-main workflows as direct merge checks.

Deprecated post-main workflows must be removed or rewired by the deployment uplift issues before this inventory can be considered fully enforced.
