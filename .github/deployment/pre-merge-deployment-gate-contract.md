# Pre-Merge Deployment Gate Contract

This contract defines the required PR deployment pipeline before workflow rewiring starts. It is the source of truth for stage order, evidence names, merge timing, and the final branch-protection check.

## Scope

The PR candidate is the only release unit. Every deployment stage must deploy the same immutable candidate identity, and every UI test stage must verify that the live target reports that same identity.

Merge to `main` is a handoff after all deployment gates have passed. A merge to `main` must not trigger deployment work.

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

## Merge And Main Behavior

All deployment stages complete before merge into `main`.

Branch protection must block merge until the final pre-merge deployment gate check passes for the current PR head. After merge, `main` may run audits, metadata checks, and reporting, but it must not deploy VPS staging, Vercel staging, Vercel production, or VPS production.

The merge handoff records that `main` now points at the already-deployed candidate. It is not a deployment trigger.

## Final Required Check

The final branch-protection check is:

```text
Pre-merge deployment gate
```

That check passes only after all eight ordered stages have passed and the aggregated evidence contains the required fields for every deployment target.
