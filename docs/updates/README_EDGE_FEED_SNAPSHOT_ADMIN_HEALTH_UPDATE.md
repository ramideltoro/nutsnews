# Edge Feed Snapshot Admin Health Update

This update improves the `/admin/edge-snapshot` dashboard so it can explain Worker fallback problems instead of only showing a generic HTTP error.

## Changes

- The web app now parses the Worker status JSON even when the Worker reports an unhealthy state.
- The admin dashboard now shows:
  - endpoint configured
  - Worker KV binding
  - HTTP status
  - snapshot age
  - article count
  - version
- A dev-only admin auth bypass is available only when:
  - `NUTSNEWS_ADMIN_TEST_AUTH_BYPASS=true`
  - `NODE_ENV !== "production"`
- The offline web E2E regression now verifies that `/admin/edge-snapshot` reflects a healthy mocked Worker status.

## Healthy dashboard

Expected healthy values:

```text
Current Status: Edge fallback ready
status: hit
Endpoint configured: Yes
Worker KV binding: Yes
HTTP status: 200
Article count: greater than 0
Version: 1
```

## Unhealthy Worker binding

If the Worker status payload says `status: unbound` or `kvBound: false`, redeploy the Worker with `NUTSNEWS_KV_NAMESPACE_ID` set.
