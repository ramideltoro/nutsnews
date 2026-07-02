# Cloudflare Cache Observability

Issue #91 adds a dedicated cache observability layer for NutsNews public routes.

Caching protects Supabase, Vercel, and the reader experience. The goal is to catch accidental cache regressions such as `no-store` headers, missing CDN headers, unexpected policy markers, or `/api/articles` falling out of the cacheable path.

---

## What is checked

The cache observability checker compares expected and actual response headers for these public routes:

| Route | Expected policy | Why it matters |
| --- | --- | --- |
| `/` | `public-home-cache-300s` | Homepage traffic should be CDN-cacheable. |
| `/articles/<id>` | `public-article-cache-300s` | Article detail pages should not hit origin for every reader. |
| `/api/articles?limit=1` | `public-api-cache-300s` | Highest-priority route because API regressions can increase Supabase pressure. |
| `/sitemap.xml` | `public-sitemap-cache-3600s` | Search crawler route should be cached longer than reader pages. |
| `/robots.txt` | `public-robots-cache-3600s` | Search crawler policy route should be cached longer than reader pages. |
| `/icon.png` | `public-static-asset-cache-immutable` | Static assets should be immutable and edge-cacheable. |
| `/apple-icon.png` | `public-static-asset-cache-immutable` | Static app icons should be immutable and edge-cacheable. |

The source of truth is:

```text
web/cache-observability.config.json
```

---

## Local commands

Validate the route configuration without making network requests:

```bash
cd web
npm run audit:cache:config
```

Run a live check against production:

```bash
cd web
npm run audit:cache -- --url https://www.nutsnews.com
```

Run a live check against a Vercel preview URL:

```bash
cd web
npm run audit:cache -- --url https://<preview-url>
```

If article discovery cannot find an article, pass one manually:

```bash
cd web
npm run audit:cache -- --url https://www.nutsnews.com --article-path /articles/<article-id>
```

The report is written to:

```text
web/reports/cache-observability/cache-observability.md
web/reports/cache-observability/cache-observability.json
```

---

## GitHub Actions

Workflow:

```text
.github/workflows/cloudflare-cache-observability.yml
```

It has two jobs:

| Job | When it runs | What it does |
| --- | --- | --- |
| `Cache config regression check` | Pull requests and pushes to `main` | Validates the cache route policy config and uploads a report artifact. |
| `Live cache policy and alert check` | Scheduled and manual workflow dispatch | Checks live Cloudflare/Vercel response headers and fails when cache policy regresses. |

The live job runs every 6 hours by default.

A failed scheduled run is the alert. GitHub will surface the failing workflow, annotations, and the uploaded report artifact.

---

## Admin dashboard

Protected admin route:

```text
/admin/cache
```

The dashboard shows:

* Overall pass/warn/fail status
* Expected vs actual `X-NutsNews-Cache-Policy`
* `Cache-Control`, `CDN-Cache-Control`, `Cloudflare-CDN-Cache-Control`, and `Vercel-CDN-Cache-Control`
* `cf-cache-status` when the checked URL is behind Cloudflare
* Article page discovery status
* Per-route findings

By default the admin page checks the current request host. On a Vercel preview deployment, `/admin/cache` checks that preview URL. In production, it checks the production host.

Optional environment overrides:

```text
NUTSNEWS_CACHE_OBSERVABILITY_URL=https://www.nutsnews.com
NUTSNEWS_CACHE_ARTICLE_PATH=/articles/<article-id>
```

Use the override when testing a preview deployment or when article discovery needs a known article URL.

---

## Expected headers

Reader-facing public routes should include these headers:

```text
Cache-Control
CDN-Cache-Control
Cloudflare-CDN-Cache-Control
Vercel-CDN-Cache-Control
X-NutsNews-Cache-Policy
```

`/api/articles` should also include:

```text
X-NutsNews-Article-Data-Source
X-NutsNews-Feed-Snapshot
```

These API headers show whether the request is served by the Supabase public feed snapshot, the articles fallback, or the Cloudflare edge snapshot fallback.

---

## What fails the check

The live check fails when:

* A required route returns an unexpected HTTP status.
* A required cache header is missing.
* `X-NutsNews-Cache-Policy` does not match the expected policy.
* `Cache-Control` contains `no-store` or `private` on a public route.
* Required CDN cache hints such as `s-maxage=300`, `s-maxage=3600`, or `immutable` are missing.
* `/api/articles` reports Cloudflare `BYPASS` or `DYNAMIC` for all observed samples.

Warnings are used when `cf-cache-status` is not present. That is normal on local checks and Vercel preview checks before Cloudflare.

---

## Preview deployment testing

After Vercel creates a preview URL for the PR, run:

```bash
cd web
npm run audit:cache -- --url https://<preview-url>
```

Look for:

* `Status: pass` or warnings only for missing `cf-cache-status`.
* Homepage policy: `public-home-cache-300s`.
* Articles API policy: `public-api-cache-300s`.
* Sitemap policy: `public-sitemap-cache-3600s`.
* Robots policy: `public-robots-cache-3600s`.
* Static icon policy: `public-static-asset-cache-immutable`.
* No public route with `Cache-Control: no-store`.

On production behind Cloudflare, also look for `cf-cache-status` samples. A first request can be `MISS`; repeated requests should eventually show `HIT` for cacheable routes.

---

## Common fixes

### `/api/articles` is not cacheable

Check:

```text
web/app/api/articles/route.ts
web/lib/cacheHeaders.ts
web/middleware.ts
web/next.config.ts
```

The route should return `ARTICLE_API_CACHE_HEADERS` on successful responses.

### A public page shows `no-store`

Check `web/middleware.ts` and make sure the route is not accidentally included in `isOperationalNoStoreRoute`.

### Sitemap or robots has the wrong policy

Check the long-cache rules in:

```text
web/middleware.ts
web/next.config.ts
```

They should use a 3600-second CDN policy.

### Static assets are missing Vercel CDN headers

Check the static asset entries in:

```text
web/next.config.ts
```

Static assets should send `Cache-Control`, `CDN-Cache-Control`, `Cloudflare-CDN-Cache-Control`, and `Vercel-CDN-Cache-Control` with `public, max-age=31536000, immutable`.

## Header visibility note

`Cloudflare-CDN-Cache-Control` and `Vercel-CDN-Cache-Control` are origin/CDN control headers. They may be consumed or hidden by the CDN layer and should not be required as visible browser response headers. The dashboard treats missing targeted CDN control headers as warnings when the visible cache policy marker and shared CDN/browser cache headers still show the route is cacheable.

For article detail pages, Cloudflare `HIT` is treated as the edge-cache source of truth. A browser-visible `private` or `no-store` header on an article page is still surfaced as a warning so it can be reviewed separately.

A visible `Cache-Control` header that includes `s-maxage` also counts as CDN cache evidence. Some platforms consume or hide targeted CDN headers, but `s-maxage` in the final `Cache-Control` response still proves the route is intentionally shared-cacheable.
