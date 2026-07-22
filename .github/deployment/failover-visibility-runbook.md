# Failover Visibility Runbook

This runbook is for operators checking whether `nutsnews.com` and
`www.nutsnews.com` are currently served by the VPS primary target or the Vercel
fallback target.

The failover controller is not a request router. Public traffic follows normal
Cloudflare DNS and proxy behavior to whichever DNS target is active. The
controller checks VPS readiness, reads Cloudflare DNS, records live production
origin observations, writes status and audit state to Durable Object storage,
and changes DNS only through guarded action paths. Health checks can change the
desired target before DNS and live-origin observations prove traffic has moved.

Do not paste or store Cloudflare tokens, HMAC secrets, raw authorization
headers, cookies, private origin IPs, raw DNS API responses, or protected
headers in tickets, alerts, screenshots, or examples.

## First Response

Use this sequence when an alert fires or a person asks where production traffic
is currently going.

1. Open `/admin/failover`.
2. Read the header summary and the "Status Snapshot" section.
3. Compare the three truths:
   - Controller state: `controllerState`, `activeDnsTarget`,
     `desiredDnsTarget`, `lastHealthResult`, and `manualLock`.
   - Actual Cloudflare DNS state: `actualApexDnsTarget` and
     `actualWwwDnsTarget`.
   - Observed live production origin: `liveOriginReadiness.apex.origin`,
     `liveOriginReadiness.www.origin`, and
     `liveOriginReadiness.dnsState`.
4. Check freshness. `generatedAt` and `lastVpsCheckAt` should normally move
   every 15 seconds. Treat controller data older than 60 seconds as stale.
5. If the three truths agree, record the target and continue with the matching
   alert checklist below.
6. If they disagree, use the disagreement checklist before changing DNS.

The normal healthy state is:

```json
{
  "controllerState": "vps_primary_healthy",
  "activeDnsTarget": "vps",
  "desiredDnsTarget": "vps",
  "actualApexDnsTarget": "vps",
  "actualWwwDnsTarget": "vps",
  "observedDeploymentTarget": "production-vps",
  "liveOriginReadiness": {
    "dnsState": "in_sync",
    "apex": { "origin": "vps", "ok": true, "status": 200 },
    "www": { "origin": "vps", "ok": true, "status": 200 }
  },
  "lastHealthResult": "reachable",
  "manualLock": false,
  "stale": false
}
```

The normal failed-over state is:

```json
{
  "controllerState": "failed_over_vercel",
  "activeDnsTarget": "vercel",
  "desiredDnsTarget": "vercel",
  "actualApexDnsTarget": "vercel",
  "actualWwwDnsTarget": "vercel",
  "observedDeploymentTarget": "vercel-production",
  "liveOriginReadiness": {
    "dnsState": "in_sync",
    "apex": { "origin": "vercel", "ok": true, "status": 200 },
    "www": { "origin": "vercel", "ok": true, "status": 200 }
  },
  "lastHealthResult": "timeout",
  "manualLock": false,
  "stale": false
}
```

## The Three Truths

Controller state is the controller's persisted view of what should happen.

Important fields:

| Field | Use |
| --- | --- |
| `controllerState` | Overall state: `vps_primary_healthy`, `vps_health_degraded`, `failed_over_vercel`, `failback_pending`, `manual_lock`, `dns_drift`, or `stale`. |
| `activeDnsTarget` | Last verified target the controller considers active. |
| `desiredDnsTarget` | Target the controller wants DNS to use. |
| `lastHealthResult` | Latest direct VPS readiness result. |
| `consecutiveVpsFailures` | Current failure streak toward failover. |
| `lastDnsChangeAt` | Last controller-recorded DNS target change time. |
| `lastDnsChangeReason` | Last automatic or manual DNS action reason. |
| `manualLock` | Whether automatic failback is locked. Health checks still run while locked. |
| `generatedAt` | Status snapshot write time. |
| `nextCheckDueAt` | Next expected health check time. |
| `stale` and `staleReason` | Whether the controller believes its status is stale. |

Actual Cloudflare DNS state is the controller's fresh readback of the managed
apex and `www` records. The public-safe classifications are `vps`, `vercel`,
`unknown`, and `unmanaged`. Operators should use classifications, not raw DNS
record content, in incident notes.

Important fields:

| Field | Use |
| --- | --- |
| `actualApexDnsTarget` | Cloudflare DNS readback classification for `nutsnews.com`. |
| `actualWwwDnsTarget` | Cloudflare DNS readback classification for `www.nutsnews.com`. |
| `liveOriginReadiness.dnsState` | Relationship between actual DNS and observed live origin: `in_sync`, `propagating`, `mismatch`, `partial`, `unreachable`, or `unknown`. |

Observed live production origin is the controller's readiness check against the
public production hostnames after Cloudflare DNS and proxy behavior. This can
lag the DNS readback during propagation or cache windows.

Important fields:

| Field | Use |
| --- | --- |
| `liveOriginReadiness.apex.origin` | Observed origin classification for `nutsnews.com`: `vps`, `vercel`, `unknown`, or `unreachable`. |
| `liveOriginReadiness.www.origin` | Observed origin classification for `www.nutsnews.com`. |
| `liveOriginReadiness.*.deploymentTarget` | Public-safe deployment target reported by readiness. |
| `liveOriginReadiness.*.cacheState` | Whether readiness appears `fresh`, `stale`, or `unknown`. |
| `liveOriginReadiness.*.error` | Safe error code for unreachable checks. |

## Expected Timing

The controller checks VPS readiness every 15 seconds.

Automatic failover eligibility requires 3 consecutive failed VPS checks. At the
normal cadence, the fastest expected desired-target failover decision is about
45 seconds after the first failed check. Operators still need to confirm
`activeDnsTarget`, Cloudflare DNS readback, and live-origin observations before
declaring that public traffic has moved.

Automatic failback eligibility starts only after the VPS readiness check is
reachable again and the current DNS state is safe to change. If manual lock is
enabled, the controller continues checking VPS health but does not automatically
move the desired target back.

Controller status is considered stale after 60 seconds. A stale status does not
prove production traffic is down; it means the controller state is not fresh
enough to trust without checking DNS and live origin.

Cloudflare DNS propagation and cache behavior can create a short window where
`actualApexDnsTarget` and `actualWwwDnsTarget` show the new target while
`liveOriginReadiness.*.origin` still observes the old target. During that
window, use `lastDnsChangeAt`, `liveOriginReadiness.dnsState`, and repeated
checks before declaring DNS drift.

## Protected Status Endpoint

Prefer `/admin/failover` for normal operations. The admin server signs requests
to the protected controller endpoint and never renders HMAC secrets to the
browser.

Endpoint:

```text
GET https://nutsnews-controller.nutsnews.workers.dev/status?mode=dashboard
```

Required headers:

```text
X-NutsNews-Failover-Timestamp: <unix timestamp seconds>
X-NutsNews-Failover-Signature: v1=<hmac hex>
```

Status signature payload:

```text
v1
GET
/status?mode=dashboard
<unix timestamp seconds>
```

Generate the signature with HMAC-SHA256 over that payload. The shared secret
comes from `NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET`. Keep it in the server-side
environment or Cloudflare secret storage only.

Safe response example:

```json
{
  "schemaVersion": "nutsnews.failover.status.v1",
  "generatedAt": "2026-07-22T03:30:00.000Z",
  "controllerState": "vps_primary_healthy",
  "activeDnsTarget": "vps",
  "desiredDnsTarget": "vps",
  "actualApexDnsTarget": "vps",
  "actualWwwDnsTarget": "vps",
  "observedDeploymentTarget": "production-vps",
  "liveOriginReadiness": {
    "checkedAt": "2026-07-22T03:30:00.000Z",
    "dnsState": "in_sync",
    "apex": {
      "hostname": "nutsnews.com",
      "ok": true,
      "origin": "vps",
      "status": 200,
      "cacheState": "fresh",
      "error": null
    },
    "www": {
      "hostname": "www.nutsnews.com",
      "ok": true,
      "origin": "vps",
      "status": 200,
      "cacheState": "fresh",
      "error": null
    }
  },
  "lastHealthResult": "reachable",
  "lastVpsCheckAt": "2026-07-22T03:29:55.000Z",
  "lastVpsReachable": true,
  "lastVpsStatus": 200,
  "lastVpsLatencyMs": 84,
  "consecutiveVpsFailures": 0,
  "failureThreshold": 3,
  "checkIntervalSeconds": 15,
  "lastDnsChangeAt": null,
  "lastDnsChangeReason": "none",
  "manualLock": false,
  "nextCheckDueAt": "2026-07-22T03:30:10.000Z",
  "stale": false,
  "staleReason": null,
  "controllerVersion": "controller-2026-07-22"
}
```

## Admin Dashboard

Route:

```text
/admin/failover
```

The dashboard is the primary operator surface. It shows:

- active and desired DNS target
- actual apex and `www` Cloudflare DNS readback classifications
- observed live origin for `nutsnews.com` and `www.nutsnews.com`
- latest VPS readiness result, latency, HTTP status, and failure streak
- controller freshness and next check time
- recent status-derived health and DNS rows
- manual lock state
- guarded manual controls
- manual action audit history when action HMAC is configured
- optional runbook and Cloudflare DNS dashboard links

Server-side configuration:

```text
NUTSNEWS_FAILOVER_CONTROLLER_STATUS_URL=https://nutsnews-controller.nutsnews.workers.dev/status?mode=dashboard
NUTSNEWS_FAILOVER_CONTROLLER_ACTION_URL=https://nutsnews-controller.nutsnews.workers.dev/actions
NUTSNEWS_FAILOVER_STATUS_HMAC_SECRET=<server-side status HMAC secret>
NUTSNEWS_FAILOVER_ACTION_HMAC_SECRET=<server-side action HMAC secret>
NUTSNEWS_FAILOVER_RUNBOOK_URL=<https URL for this runbook>
NUTSNEWS_FAILOVER_CLOUDFLARE_DASHBOARD_URL=<optional Cloudflare DNS dashboard URL>
```

If the dashboard says the controller is unavailable, do not assume DNS changed.
Check Workers Logs for `failover.health_check` and `failover.dns_decision`,
then check Cloudflare DNS directly through an authorized operator account.

## Workers Logs Queries

The controller emits structured JSON logs. The important top-level fields are
`event`, `level`, `service`, `environment`, and `message`. Failover-specific
fields include `failoverEventType`, target classifications, health result,
failure streak, DNS action, skip reason, and live-origin DNS state.

Use the Cloudflare Workers Logs view, Better Stack if the pipeline is
configured, or a Wrangler tail session.

CLI tail examples:

```sh
npx wrangler tail nutsnews-controller --format=json --search '"event":"failover.health_check"'
```

```sh
npx wrangler tail nutsnews-controller --format=json --search '"event":"failover.dns_decision"'
```

```sh
npx wrangler tail nutsnews-controller --format=json --search '"event":"failover.alert"'
```

Dashboard or log pipeline filters:

| Need | Filter fields |
| --- | --- |
| Latest health checks | `event = "failover.health_check"` |
| Failed VPS readiness | `event = "failover.health_check"` and `vpsReachable = false` |
| DNS decisions | `event = "failover.dns_decision"` |
| Failover/failback decisions | `event = "failover.dns_decision"` and `dnsAction IN ("failover_to_vercel", "failback_to_vps")` |
| DNS drift | `event = "failover.dns_decision"` and `dnsAction = "drift_detected"` |
| DNS API readback failures | `event = "failover.dns_decision"` and `dnsAction = "dns_api_error"` |
| Manual lock skips | `event = "failover.dns_decision"` and `dnsAction = "manual_lock_skip"` |
| Operator alerts | `event = "failover.alert"` |

Safe health-check log example:

```json
{
  "dt": "2026-07-22T03:30:00.000Z",
  "level": "info",
  "service": "nutsnews-controller",
  "environment": "production",
  "event": "failover.health_check",
  "message": "Failover controller VPS health check recorded",
  "failoverEventType": "health_check",
  "checkedAt": "2026-07-22T03:29:55.000Z",
  "source": "alarm",
  "controllerState": "vps_primary_healthy",
  "activeDnsTarget": "vps",
  "desiredDnsTarget": "vps",
  "actualApexDnsTarget": "vps",
  "actualWwwDnsTarget": "vps",
  "healthResult": "reachable",
  "vpsReachable": true,
  "vpsStatus": 200,
  "vpsLatencyMs": 84,
  "observedDeploymentTarget": "production-vps",
  "consecutiveVpsFailures": 0,
  "failureThreshold": 3,
  "liveOriginDnsState": "in_sync"
}
```

Safe DNS-decision log example:

```json
{
  "dt": "2026-07-22T03:30:45.000Z",
  "level": "warn",
  "service": "nutsnews-controller",
  "environment": "production",
  "event": "failover.dns_decision",
  "message": "Failover controller DNS decision recorded",
  "failoverEventType": "dns_decision",
  "controllerState": "failed_over_vercel",
  "activeDnsTarget": "vercel",
  "desiredDnsTarget": "vercel",
  "actualApexDnsTarget": "vercel",
  "actualWwwDnsTarget": "vercel",
  "healthResult": "timeout",
  "vpsReachable": false,
  "consecutiveVpsFailures": 3,
  "dnsAction": "failover_to_vercel",
  "dnsWriteAttempted": false,
  "dnsWriteSkipped": true,
  "dnsSkipReason": "dns_write_not_implemented_for_observation_only_controller",
  "dnsErrorCode": null,
  "dnsReadbackConfigured": true,
  "dnsReadbackOk": true,
  "liveOriginDnsState": "in_sync"
}
```

## Workers Analytics Engine Queries

The controller writes Workers Analytics Engine metrics to the
`nutsnews_failover_controller` dataset when the `FAILOVER_ANALYTICS` binding is
enabled. If the dataset has no rows, confirm the binding is enabled and at
least one health check has run after activation.

The controller uses:

| Analytics field | Meaning |
| --- | --- |
| `index1` | `nutsnews-failover:<environment>` |
| `blob2` | event type: `health_check` or `dns_target_change` |
| `blob3` | environment |
| `blob4` | controller version |
| `blob5` | source |
| `blob6` | controller state |
| `blob7` | active DNS target |
| `blob8` | desired DNS target |
| `blob9` | actual apex DNS target |
| `blob10` | actual `www` DNS target |
| `blob11` | health result |
| `blob12` | DNS action |
| `blob13` | safe error code |
| `blob14` | observed deployment target |
| `blob15` | live-origin DNS state |
| `blob16` | manual lock state |
| `blob17` | VPS reachable state |
| `double1` | event count |
| `double2` | VPS latency ms, or 0 when unavailable |
| `double3` | VPS HTTP status, or 0 when unavailable |
| `double4` | consecutive VPS failures |
| `double5` | failure threshold |
| `double6` | VPS reachable, 1 or 0 |
| `double7` | DNS update duration ms |
| `double8` | DNS target changed, 1 or 0 |
| `double9` | manual lock enabled, 1 or 0 |
| `double12` | DNS readback OK, 1 or 0 |

Recent health checks:

```sql
SELECT
  timestamp,
  blob3 AS environment,
  blob4 AS controller_version,
  blob5 AS source,
  blob6 AS controller_state,
  blob7 AS active_dns_target,
  blob8 AS desired_dns_target,
  blob11 AS health_result,
  blob12 AS dns_action,
  double2 AS vps_latency_ms,
  double3 AS vps_status_code,
  double4 AS consecutive_vps_failures
FROM nutsnews_failover_controller
WHERE
  timestamp > NOW() - INTERVAL '30' MINUTE
  AND blob2 = 'health_check'
ORDER BY timestamp DESC
LIMIT 200
```

Active target history:

```sql
SELECT
  timestamp,
  blob7 AS active_dns_target,
  blob8 AS desired_dns_target,
  blob9 AS actual_apex_dns_target,
  blob10 AS actual_www_dns_target,
  blob12 AS dns_action,
  blob15 AS live_origin_dns_state
FROM nutsnews_failover_controller
WHERE
  timestamp > NOW() - INTERVAL '24' HOUR
  AND blob2 = 'health_check'
ORDER BY timestamp DESC
LIMIT 500
```

Recent DNS target changes:

```sql
SELECT
  timestamp,
  blob3 AS environment,
  blob12 AS dns_action,
  blob7 AS active_dns_target,
  blob8 AS desired_dns_target,
  blob13 AS error_code,
  double7 AS dns_update_duration_ms,
  double8 AS dns_target_changed
FROM nutsnews_failover_controller
WHERE
  timestamp > NOW() - INTERVAL '7' DAY
  AND blob2 = 'dns_target_change'
ORDER BY timestamp DESC
LIMIT 100
```

Manual lock windows:

```sql
SELECT
  timestamp,
  blob6 AS controller_state,
  blob7 AS active_dns_target,
  blob8 AS desired_dns_target,
  blob12 AS dns_action,
  blob16 AS manual_lock
FROM nutsnews_failover_controller
WHERE
  timestamp > NOW() - INTERVAL '7' DAY
  AND blob16 = 'true'
ORDER BY timestamp DESC
LIMIT 200
```

DNS drift candidates:

```sql
SELECT
  timestamp,
  blob6 AS controller_state,
  blob7 AS active_dns_target,
  blob8 AS desired_dns_target,
  blob9 AS actual_apex_dns_target,
  blob10 AS actual_www_dns_target,
  blob12 AS dns_action,
  blob15 AS live_origin_dns_state
FROM nutsnews_failover_controller
WHERE
  timestamp > NOW() - INTERVAL '6' HOUR
  AND (
    blob6 = 'dns_drift'
    OR blob12 = 'drift_detected'
    OR blob15 IN ('mismatch', 'partial', 'unreachable')
  )
ORDER BY timestamp DESC
LIMIT 200
```

Safe row example:

```text
timestamp                  environment  controller_state     active  desired  health_result  failures
2026-07-22T03:30:00.000Z   production   vps_primary_healthy  vps     vps      reachable      0
```

## Alert Response

Every alert is emitted as `event = "failover.alert"` and includes
`alertType`, `severity`, target classifications, health fields, DNS timestamps,
manual lock state, and a safe status URL. Alert payloads exclude secrets,
tokens, cookies, private origin details, and raw API responses.

### `failover_to_vercel`

Meaning: the controller recorded Vercel as the active target after an automatic
or non-duplicate DNS action.

First response:

1. Open `/admin/failover`.
2. Confirm `activeDnsTarget`, `actualApexDnsTarget`,
   `actualWwwDnsTarget`, and both live origins are `vercel`.
3. Confirm `lastHealthResult` and `consecutiveVpsFailures`.
4. Check recent `failover.health_check` logs for the first failing check.
5. Keep traffic on Vercel until VPS readiness is stable again or an operator
   approves manual failback.
6. If planned maintenance is in progress, consider enabling manual lock so
   automatic failback does not happen before the maintenance owner is ready.

### `failback_to_vps`

Meaning: the controller recorded VPS as the active target after failback.

First response:

1. Confirm actual Cloudflare DNS classifications are both `vps`.
2. Confirm both live origins report `vps` and `ok = true`.
3. Confirm `lastHealthResult = "reachable"` and the failure streak is 0.
4. Check the latest `dns_target_change` analytics row for duration and target.
5. If live origin still reports Vercel, wait through the propagation/cache
   window before declaring drift.

### `stale_controller`

Meaning: the controller status did not update within the expected window.

First response:

1. Treat `/admin/failover` status as incomplete if `generatedAt` or
   `nextCheckDueAt` is older than 60 seconds.
2. Check Workers Logs for new `failover.health_check` or runtime errors.
3. Check whether the Durable Object binding is available and alarms are firing.
4. Check actual Cloudflare DNS through an authorized operator account.
5. Avoid DNS-changing manual actions until the controller can re-check DNS and
   return a fresh dashboard state.

### `dns_drift`

Meaning: desired controller target and actual Cloudflare DNS classifications
disagree outside the propagation window, or live-origin DNS state is
`mismatch`, `partial`, or `unreachable`.

First response:

1. Compare `desiredDnsTarget`, `actualApexDnsTarget`, and
   `actualWwwDnsTarget`.
2. Check `lastDnsChangeAt`. If the change is recent, wait for propagation and
   refresh.
3. If only apex or only `www` disagrees, treat this as partial DNS drift.
4. Check `failover.dns_decision` logs for `dns_api_error`,
   `drift_detected`, or `dnsReadbackOk = false`.
5. Do not force DNS from an old dashboard tab. Refresh first so stale-state
   protection has the current Cloudflare DNS snapshot.

### `manual_lock_enabled`

Meaning: automatic failback is disabled while health checks continue.

First response:

1. Confirm who enabled the lock and why in the Manual Action Audit section.
2. Confirm current target and live origin still match the intended operator
   state.
3. Keep the lock only while a named maintenance or incident owner needs it.
4. Disable the lock after VPS readiness, Cloudflare DNS, and live origin are
   stable on the intended target.

## Disagreement Checklist

Use this table when controller state, DNS readback, and live origin do not
agree.

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `desiredDnsTarget = vps`, DNS readback is `vercel`, live origin is `vercel` | Failback pending, manual lock, or drift | Check `manualLock`, `lastDnsChangeReason`, and audit history. Do not force failback until VPS readiness is stable and the dashboard has been refreshed. |
| DNS readback is `vps`, live origin is still `vercel` | DNS propagation or cache delay | Check `lastDnsChangeAt` and `liveOriginReadiness.*.cacheState`. Refresh after the propagation window. |
| Apex and `www` classifications differ | Partial DNS update or external DNS edit | Treat as DNS drift. Check `failover.dns_decision` logs and Cloudflare DNS change history. |
| Controller is `stale` but DNS and live origin agree | Controller alarm, Durable Object, or logging path issue | Investigate controller health before changing DNS. |
| DNS readback is `unknown` or `unmanaged` | Missing config, record not recognized, or API readback failed | Check controller config and Cloudflare DNS readback logs. Use authorized Cloudflare dashboard access for direct confirmation. |
| Live origin is `unreachable` but DNS readback is expected | Production path issue after DNS selection | Check public readiness, Cloudflare proxy status, and recent deployment health before changing DNS. |
| Manual DNS action returns `stale_dns_state` | Dashboard snapshot is older than current Cloudflare DNS | Refresh `/admin/failover`, re-check all three truths, and retry only if the current state still requires action. |
| Manual DNS action returns `cloudflare_dns_update_failed` | DNS write or post-write verification failed | Treat target as unchanged until the dashboard or Cloudflare DNS readback proves otherwise. Check logs before retrying. |

## Manual Failover Controls

Manual controls live in `/admin/failover`. They are guarded by admin
authorization, server-side HMAC signing, exact confirmation text, a required
reason, stale-state protection, and audit logging.

Use manual DNS actions only when:

- automatic failover has not happened yet and the VPS is clearly unsafe for
  production traffic
- planned maintenance requires traffic to stay on Vercel
- automatic failback is blocked and VPS readiness is now stable
- DNS drift must be reconciled after an operator has confirmed the current DNS
  and live-origin state

Available actions:

| Dashboard action | Confirmation text | Effect |
| --- | --- | --- |
| Enable Manual Lock | `ENABLE MANUAL LOCK` | Keeps health checks running but prevents automatic failback changes. |
| Disable Manual Lock | `DISABLE MANUAL LOCK` | Allows normal automatic failback behavior again. |
| Force DNS to Vercel | `FAILOVER TO VERCEL` | Re-checks Cloudflare DNS, writes apex and `www` to Vercel fallback, then verifies. |
| Force DNS to VPS | `FAILBACK TO VPS` | Re-checks Cloudflare DNS, writes apex and `www` to VPS primary, then verifies. |

Manual DNS action flow:

1. Refresh `/admin/failover`.
2. Read controller state, Cloudflare DNS readback, and live origin.
3. Enter a specific reason, such as `VPS maintenance window INC-123`.
4. Enter the exact confirmation phrase.
5. Submit the action.
6. Wait for the dashboard to reload.
7. Confirm `activeDnsTarget`, `actualApexDnsTarget`,
   `actualWwwDnsTarget`, and live origins match the requested target.
8. Check the Manual Action Audit row for actor, action, previous target, new
   target, reason, result, and message.

Safe audit event example:

```json
{
  "createdAt": "2026-07-22T03:35:00.000Z",
  "actor": "admin@example.com",
  "action": "force_dns_to_vercel",
  "previousTarget": "vps",
  "newTarget": "vercel",
  "reason": "VPS maintenance window INC-123",
  "result": "success",
  "message": "Cloudflare DNS verified on vercel.",
  "manualLock": false
}
```

If a manual action is refused as stale, refresh the dashboard and re-evaluate.
The refusal is intentional: the controller re-read Cloudflare DNS before writing
and found that the current records no longer matched the dashboard snapshot.

If a manual DNS write fails, treat DNS as unknown until Cloudflare DNS readback
or the Cloudflare dashboard proves the active target. Do not submit repeated
force actions without checking logs and Cloudflare state.

## Operator Notes

- Health checks continue while production is on Vercel.
- Health checks continue while manual lock is enabled.
- Manual lock affects automatic failback only; it does not hide alerts or stop
  status updates.
- `desiredDnsTarget` can differ from `activeDnsTarget` during failback pending,
  propagation, manual lock, or drift.
- `observedDeploymentTarget` comes from readiness metadata and is a public-safe
  classification. Use it to distinguish `production-vps` from
  `vercel-production`.
- Keep incident notes to public-safe fields: classifications, timestamps,
  result codes, event names, alert types, and audit IDs.
