# Cache freshness qualification and recovery

This runbook is the release and incident contract for initiative #221 and cache issues #557–#579. Long edge lifetimes do not delay normal publication: a completed publication batch invalidates `public-feed` in both Next.js targets and Cloudflare. The normal target is visibility within two minutes. If every invalidation attempt fails, the homepage and feed APIs revalidate after two hours; newly published stories should never wait 24 hours.

## Policy and ownership

| Route/data class | Edge or data lifetime | Invalidation tag | Failure fallback |
|---|---:|---|---:|
| Homepage, `/api/articles`, `/api/home-feed`, sitemaps | 2 hours | `public-feed` | 2 hours, with up to 7 days stale-on-error |
| Article page and `/api/articles/<id>` | 30 days | `article:<id>` | 30-day revalidation, up to 90-day data expiry |
| Informational pages and site shell | 30 days | `site-shell` | deployment purge |
| Normalized public search | 6 hours | `public-feed` | 6 hours |
| `/_next/image` at Cloudflare | 30 days | URL/width/quality/accepted-format cache key | origin image optimizer |
| Worker KV public-feed snapshot | no expiry | overwritten after a successful refresh | last-known-good remains available indefinitely |

The `nutsnews` repository owns application policies, tags, revalidation authentication, targeted purge tooling, observability, and this runbook. `nutsnews-worker` owns post-publication invalidation and the durable KV snapshot. `nutsnews-infra` owns Cloudflare rules, bounded VPS image storage, and host telemetry.

## Activation order

1. Create one random secret of at least 32 characters. Store the identical value as `NUTSNEWS_CACHE_REVALIDATION_SECRET` in the GitHub `Production` and `production-vps` environments and in the Cloudflare Workers Secrets Store.
2. Store a zone-scoped tag-purge token as `CLOUDFLARE_CACHE_PURGE_API_TOKEN` in both GitHub production environments and the Workers Secrets Store. Store the zone ID as `CLOUDFLARE_ZONE_ID` for the app and `NUTSNEWS_CLOUDFLARE_ZONE_ID` for the Worker.
3. Deploy the app endpoint to VPS and Vercel. An unsigned POST to `/api/internal/cache/revalidate` must return `401`; all responses must include `Cache-Control: no-store`.
4. Deploy the Worker with `NUTSNEWS_CACHE_REVALIDATION_URLS` containing the canonical VPS URL and stable Vercel secondary URL.
5. Run the infra `Cloudflare Cache Rules Apply` workflow with `cache_policy_mode=baseline` and `run_mode=plan`. Resolve all unexpected drift before proceeding.
6. Run the same workflow with `cache_policy_mode=coordinated` in plan mode, review the exact route/key changes, and only then use the protected apply confirmation.

Do not enable the 30-day article/static rules before the app, Worker, tag purge, and deployment purge paths are deployed.

## Release qualification

Run the cache observability workflow against `https://www.nutsnews.com` and provide a known article path. Preserve its JSON and Markdown artifacts with the release evidence.

Then complete this matrix:

| Scenario | Procedure | Pass condition |
|---|---|---|
| Normal publication | Publish a qualification article through the normal Worker batch and record the database commit time. Poll `/api/articles`, `/api/home-feed`, `/`, and `/api/articles/<id>` every 10 seconds. | All public surfaces contain the article within 120 seconds. Worker logs show both Next targets and the Cloudflare `public-feed` purge completed. |
| Failed invalidation fallback | In staging only, temporarily point invalidation at a rejecting endpoint, publish a fixture, and restore configuration immediately after observation. | Failure is logged after three bounded attempts, publication is not rolled back, and the fixture becomes visible no later than the two-hour TTL. |
| Edit/removal | Execute the repository's editorial mutation hook after the committed fixture edit, then after removal. | `article:<id>` and `public-feed` are invalidated; a different warm article remains a HIT. The edited value/404 is visible within two minutes. |
| Eight-day KV fallback | In an isolated Worker test binding, retain a snapshot whose `updatedAt` is eight days old and run no writes. Query `/public-feed-snapshot`. | The same snapshot is returned; no KV expiration is present. |
| Origin outage | In a controlled staging window, block the app origin after warming public routes. | Cloudflare serves eligible stale content, protected routes remain uncached, and recovery does not require a full-zone purge. |
| Image formats | Request the same `/_next/image` URL and dimensions with AVIF-only and WebP-only `Accept` headers twice each. | Format responses never collide, the second request for each format is a HIT, and the origin cache remains at or below 10 GB/30 days. |
| Protected bypass | Probe admin, auth, internal API, contact POST, engagement POST, runtime config, and readiness routes. | Every response is `DYNAMIC`/`BYPASS` or has no-store policy; none becomes a HIT. |

The staging invalidation-failure and origin-outage exercises are controlled failure tests. Never perform them against production.

## Alert thresholds

- Page immediately on any completed publication event with `ok=false` for Next.js or Cloudflare invalidation.
- Warn when publication visibility exceeds 120 seconds; page when it approaches the two-hour fallback.
- Warn when the last-known-good snapshot age exceeds seven days, but do not delete it.
- Warn when the aggregate cache HIT ratio is below 70% for 15 minutes or origin-bound requests exceed twice the trailing seven-day hourly baseline.
- Warn when the VPS image cache exceeds 9 GB or its oldest file exceeds 27 days; page at 10 GB or 30 days.
- Warn when a route marked `requireCloudflareCacheable` remains `DYNAMIC` or `BYPASS` in two consecutive scheduled audits.

## Recovery

1. Confirm the database publication and KV snapshot succeeded. Do not republish or roll back content solely because invalidation failed.
2. Inspect Worker events `worker.cache.next_revalidation_*`, `worker.cache.cloudflare_purge_*`, and `worker.cache.public_feed_invalidation_completed`. Compare request ID, attempts, status, and latency.
3. Verify the app secret is identical on VPS, Vercel, and the Worker. Rotate all three together if compromise is suspected; deploy the app targets before the Worker.
4. Retry the allowlisted `public-feed` tag purge using the targeted purge workflow. For an article edit/removal, purge `article:<id>` and `public-feed`. For a deployment shell mismatch, purge `site-shell`.
5. If targeted purge is unavailable, wait for the two-hour feed fallback while serving the last-known-good snapshot. Use URL purge only for a precisely enumerated route set.
6. `purge_everything` is break-glass only. It requires the explicit production confirmation in the manual workflow and must be followed by a cache observability audit.
7. If image storage crosses its hard limit, inspect the pruner logs and volume mount. Do not manually delete a broad Docker volume path; restore the fixed pruner and let it remove only `/app/.next/cache/images`.

Record timestamps, IDs, cache statuses, and recovery actions in the incident or release issue.
