# Worker-Uplift Authenticated Production Admin Evidence

This procedure verifies that an authorized operator can read the worker-uplift
shadow projection on the deployed production admin surface. It does not grant
or exercise administrative mutation, production-write, cutover, DNS/failover,
or legacy-worker authority.

## Evidence boundaries

The `Worker-Uplift Authenticated Production Admin Evidence` workflow is a
manual, protected, read-only check. Its exact inputs identify the source
commit, build, and Vercel production deployment being evaluated. Before opening
the admin route, the workflow checks that Vercel reports the supplied
deployment as `READY`, production-targeted, bound to that source commit, and
serving the canonical production alias.

The workflow creates a five-minute Auth.js session from the existing
production authentication secret and a dedicated admin evidence identity held
as the `NUTSNEWS_ADMIN_EVIDENCE_EMAIL` Production environment secret. The
identity, session, cookie, credentials, response payloads, and private
endpoints are never written to the artifact. The browser blocks every request
method except `GET` and `HEAD`, performs no clicks, and closes the session when
the check ends.

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
all candidate identifiers. The workflow uses the `Production` GitHub
environment. It does not require routine reviewer approval when that
environment has approval disabled; do not weaken environment protections to
run it.

## Passing evidence

The artifact
`worker-uplift-authenticated-admin-evidence-<run>-<attempt>` contains only
`worker-uplift-admin-evidence.json`. A pass requires:

- unauthenticated access receives the protected redirect and ends at the login
  page;
- the ephemeral authorized session receives the admin shards page;
- the page shows `Legacy Shards` as owner and `Shadow` as write policy;
- all eight uplift stages are present in contract order;
- all seven main-queue services show at least one consumer and an immutable
  deployment version;
- current overall health, queue age, retries, and DLQ counts are recorded;
- stale and unavailable display contracts and private-value rejection tests
  pass; and
- no disallowed request method or guarded mutation is observed.

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
