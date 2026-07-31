# Worker-Uplift Authenticated Production Admin Evidence

This procedure verifies that an authorized operator can read the worker-uplift
shadow projection on the deployed production admin surface. It does not grant
or exercise administrative mutation, production-write, cutover, DNS/failover,
or legacy-worker authority.

## Evidence boundaries

The `Worker-Uplift Authenticated Production Admin Evidence` workflow is a
manual, protected, read-only check. Its exact inputs identify the source
commit, build, and Vercel production deployment being evaluated. The workflow
checks out its evidence tooling from the immutable workflow-dispatch commit,
records that commit separately, and never substitutes it for the deployed
candidate identity. Before opening the admin route, the workflow checks that
Vercel reports the supplied release counterpart deployment as `READY`,
production-targeted, and bound to the candidate source commit. It separately
reads only the public source, build, runtime environment, and deployment-target
fields from the canonical `/api/runtime-config` response. The canonical
production runtime must identify the same candidate source and build and must
remain `production-vps`; the response body is not retained.

The workflow creates a five-minute Auth.js session from the deployed runtime's
current Vercel Production `AUTH_SECRET`. It uses the existing protected Vercel
read credential to retrieve that value and the current `ADMIN_EMAILS` allowlist
through the documented per-variable API, verifies that the dedicated
`NUTSNEWS_ADMIN_EVIDENCE_EMAIL` Production environment identity is allowlisted,
and retains neither value. This avoids a second, potentially stale auth-secret
copy in GitHub. The artifact records only the value-free Vercel Production
source classification. The identity, allowlist, session, cookie, credentials,
response payloads, and private endpoints are never written to the artifact.
The browser blocks every request method except `GET` and `HEAD`, performs no
clicks, and closes the session when the check ends.

The workflow also opens the same route without a session and requires the
initial redirect and final `/admin/login` page. Existing Google authentication,
the admin allowlist, and the protected layout remain unchanged.

## Dispatch

Use the exact identifiers from the immutable production release evidence:

```text
source_commit=<40-character nutsnews commit>
build_id=<container workflow run>-<attempt>
deployment_id=<Vercel deployment id>
deployment_url=https://<immutable deployment hostname>
target_origin=https://www.nutsnews.com
confirm_read_only=verify-authenticated-admin-read-only
```

Dispatch only after the production release artifact and provider API agree on
all candidate identifiers. Dispatch the workflow from the reviewed `main`
revision that owns the evidence contract; the artifact records that tooling
commit independently from the candidate. The workflow uses the `Production`
GitHub environment. It does not require routine reviewer approval when that
environment has approval disabled; do not weaken environment protections to
run it.

## Passing evidence

The artifact
`worker-uplift-authenticated-admin-evidence-<run>-<attempt>` contains only
`worker-uplift-admin-evidence.json`. A pass requires:

- unauthenticated access receives the protected redirect and ends at the login
  page;
- the ephemeral authorized session receives the admin shards page;
- the session secret and allowlist come from the current Vercel Production
  environment and are used only in memory;
- the canonical production runtime and immutable release counterpart identify
  the exact same source commit and build;
- the evidence artifact identifies the immutable source commit of the tooling
  that collected and validated it;
- the page shows `Legacy Shards` as owner and `Shadow` as write policy;
- all eight uplift stages are present in contract order;
- all seven main-queue services show at least one consumer and an immutable
  deployment version;
- current overall health, queue age, retries, and DLQ counts are recorded;
- stale and unavailable display contracts and private-value rejection tests
  pass; and
- no disallowed request method or guarded mutation is observed.

The overall status is validated against the backend projection's complete
enum, including legacy-only and rollback states. This workflow proves that the
protected surface faithfully exposes current health, not that the candidate is
ready for production. Stale, unknown, legacy-only, rollback, or unavailable
stage telemetry still fails closed, as do missing consumer, queue-age, or
candidate fields. Production-readiness decisions evaluate the recorded health
separately.

Validate a downloaded artifact with:

```bash
node scripts/validate_worker_uplift_admin_production_evidence.mjs \
  worker-uplift-admin-evidence.json
```

Record the workflow run, artifact ID and digest, JSON SHA-256, check time, and
immutable deployment identifiers on the tracking issue. Do not paste the
Production identity, session material, environment values, private projection
content, or response bodies.

## Fail-safe interpretation

A login redirect for the authorized session, an unavailable projection, a
stale projection, a missing stage/version, a zero or unknown main-queue
consumer count, non-shadow writes, a deployment mismatch, or a redaction
failure makes the evidence workflow fail. Investigate through existing
read-only status workflows. Recovery or deployment actions remain separate
protected operations and require their own authorized workflow and scope.

This readiness evidence does not authorize cutover. Legacy shard ingestion
remains the production owner and worker-uplift production writes remain
disabled.
