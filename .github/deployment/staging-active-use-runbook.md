# Staging Active-Use Runbook

Staging is not an always-on environment. It is a bounded validation target that
is enabled only by explicit operator action and then returned to an off state by
the GitOps-managed auto-idle path in `ramideltoro/nutsnews-infra`.

## Intended Off State

The reviewed off state is:

- hosting/container/runtime: the `nutsnews-staging` app project and the
  `nutsnews-staging-access` verifier project are stopped; no staging container
  publishes host ports; the staging cache volume is removed when auto-idle runs.
- scheduled/background work: staging web runtime uses `NUTSNEWS_RUNTIME_ENV=staging`,
  `NUTSNEWS_SIDE_EFFECTS_MODE=disabled`, `NUTSNEWS_DATA_ENVIRONMENT=staging`,
  and staging Supabase credentials. Worker/controller cron-like production work
  is not enabled by this app workflow.
- public access: `staging.nutsnews.com` is behind Cloudflare Access while
  enabled. In the off state anonymous traffic must fail closed with Access
  denial or no healthy upstream, and authenticated health/readiness should not
  continue returning the staging app identity after the containers are idled.
- credentials: `staging-vps`, `staging-tests`, and `cloudflare-admin` remain
  separate trust boundaries in the infra repo. App-side manual dispatch uses
  only `NUTSNEWS_INFRA_STAGING_TOKEN` to request the fixed staging workflow.
- cost-bearing services: the same-host staging budget is limited to the infra
  `vps_service_foundation_nutsnews_staging_resource_budget`, and auto-idle
  removes the staging cache volume after qualification expiry or orphan grace.

Infra defaults that make this enforceable are:

```text
vps_service_foundation_nutsnews_staging_enabled: false
vps_service_foundation_nutsnews_staging_access_enabled: false
vps_service_foundation_nutsnews_staging_auto_idle_enabled: true
vps_service_foundation_nutsnews_staging_auto_idle_grace_seconds: 3600
vps_service_foundation_nutsnews_staging_auto_idle_remove_cache_volume: true
vps_service_foundation_nutsnews_staging_test_budget.qualification_ttl_hours: 24
vps_service_foundation_nutsnews_staging_test_budget.scale_down_after_qualification_expiry: true
```

## Enable Staging

Use the app repo workflow `Manual VPS Staging Recovery Dispatch`
(`.github/workflows/staging-release.yml`) only when an already-reviewed
immutable image must be validated on VPS staging. Required inputs are:

```text
confirmation=request-vps-staging-recovery
operator_reason=<8-180 character reason>
validation_ttl_hours=1|4|8|24
off_state_acknowledgement=staging-auto-idle-required
source_commit=<40-char app commit>
image_digest=sha256:<64 hex chars>
build_id=<run-id>-<attempt>
schema_version=<14 digits>
migration_head=<14 digits>
supabase_project_ref=<20-char production project ref>
```

The workflow validates the inputs, computes the deterministic `stg-*`
deployment ID, and dispatches the compact immutable candidate to
`ramideltoro/nutsnews-infra` with event `nutsnews-staging-release`. The dispatch
payload intentionally excludes the operator reason and TTL so infra continues to
accept only the reviewed candidate schema.

The step summary is the app-side evidence for who requested staging, why it was
needed, which immutable source/image was used, the requested disable-by time,
and which off-state verification must happen before staging is considered
closed. `validation_ttl_hours` is an operator commitment recorded for audit; it
does not alter the strict infra candidate payload. If validation finishes before
infra auto-idle would run, execute the immediate teardown command below.

## Enabled-State Verification

The infra workflow `Deploy Verified NutsNews Staging Candidate` must verify:

- source commit and OCI image provenance before attaching `staging-vps` secrets;
- staging Ansible syntax and fixed-command staging gateway checks;
- immutable image digest, config generation, resource limits, log limits,
  directory separation, and root-only env-file permissions;
- live `/healthz` and `/readyz` staging identity inside the protected boundary;
- sanitized GitHub Deployment status for environment `staging`.

The infra workflow `Qualify Verified NutsNews Staging Candidate` then runs the
off-VPS staging qualification suite through `staging-tests` credentials. That
workflow is the health/readiness evidence while staging is enabled.

## Teardown And Off-State Verification

The normal teardown path is `nutsnews-staging-auto-idle.timer` in the infra repo.
It runs the `nutsnews-staging-auto-idle.service` oneshot at the configured
cadence, after qualification expiry plus grace or after orphaned staging grace.
It must only target the staging app, staging Access verifier, and staging cache
volume, and its status must include `production_touched=false`.

For immediate teardown after validation, run the fixed service from the
protected VPS operations path:

```bash
sudo systemctl start nutsnews-staging-auto-idle.service
sudo python3 -m json.tool /opt/nutsnews/portal-assets/data/staging-idle-status.json
sudo tail -n 20 /opt/nutsnews/logs/staging-auto-idle/idle.jsonl
```

Expected off-state evidence:

```text
status: idled or already_idled
action: idled or already_idled
production_touched: false
managed_projects includes nutsnews-staging and nutsnews-staging-access
managed_containers includes nutsnews-app-staging and nutsnews-staging-access-verifier
running_after for all managed containers is false when containers were running before teardown
```

The enabled-state `Staging Access Probe` checks anonymous denial and authenticated
health/readiness. After teardown, anonymous requests must still fail closed, and
authenticated health/readiness should not keep returning HTTP 200 from the
staging app because the staging containers are stopped.

## Long-Running Exceptions

Long-running staging is not the default. A manual app dispatch always requires
`operator_reason`, `validation_ttl_hours`, and
`off_state_acknowledgement=staging-auto-idle-required`. Anything beyond the
24-hour qualification TTL or the one-hour auto-idle grace is an infrastructure
policy exception and must be reviewed as an infra change, not worked around by
rerunning staging indefinitely.
