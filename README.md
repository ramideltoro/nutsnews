# NutsNews

**NutsNews is a calm, mobile-first positive news platform.**

It collects uplifting stories from trusted RSS feeds, filters and summarizes them with AI, and sends readers back to the original publishers.

The project is built to stay simple, inexpensive, observable, and easy to operate.

---

## What NutsNews Does

| Area | Summary |
| --- | --- |
| Reader app | Positive news feed with search, translations, and fast article cards |
| Ingestion | Cloudflare Worker shards collect and process RSS feeds |
| AI review | Local AI first, with optional OpenAI fallback |
| Database | Supabase stores articles, feeds, reviews, usage, and snapshots |
| Admin | Protected dashboards for articles, feeds, Workers, AI, and guardrails |
| Reliability | CDN caching, public feed snapshots, monitoring, backups, and E2E tests |
| Cost model | Designed around free-tier services and local AI where possible |

---

## Repository Map

This repo contains the public website/admin app, database config, website scripts, README, and license. Shared documentation lives in `ramideltoro/nutsnews-docs` so documentation-only updates do not trigger NutsNews web deployments.

Related repositories:

- ramideltoro/nutsnews-docs: Shared documentation for web, Worker, and iOS
- ramideltoro/nutsnews-worker: Cloudflare Worker ingestion, controller, local AI, and backend automation
- ramideltoro/nutsnews-ios: Native iOS app

---

## Documentation

Start with the shared docs index:

**[Open the NutsNews documentation map](https://github.com/ramideltoro/nutsnews-docs/blob/main/README.md)**

Common entry points:

| Need | Go to |
| --- | --- |
| Understand the product | [Project Overview](https://github.com/ramideltoro/nutsnews-docs/blob/main/PROJECT.md) |
| Understand the system | [Architecture](https://github.com/ramideltoro/nutsnews-docs/blob/main/ARCHITECTURE.md) |
| Run or maintain the app | [Operations](https://github.com/ramideltoro/nutsnews-docs/blob/main/OPERATIONS.md) |
| Deploy safely | [Deployment Checklist](https://github.com/ramideltoro/nutsnews-docs/blob/main/DEPLOYMENT_CHECKLIST.md) |
| Debug production issues | [Troubleshooting](https://github.com/ramideltoro/nutsnews-docs/blob/main/TROUBLESHOOTING.md) |
| Monitor free-tier risk | [Free-Tier Guardrails](https://github.com/ramideltoro/nutsnews-docs/blob/main/FREE_TIER_GUARDRAILS.md) |
| Use local AI | See `ramideltoro/nutsnews-worker` |
| Validate public web flows | [Web Offline E2E Test](https://github.com/ramideltoro/nutsnews-docs/blob/main/WEB_OFFLINE_E2E_REGRESSION_TEST.md) and [Vercel Preview Smoke Test](https://github.com/ramideltoro/nutsnews-docs/blob/main/VERCEL_PREVIEW_SMOKE_TEST.md) |
| Validate homepage performance | [Homepage Performance Budget](https://github.com/ramideltoro/nutsnews-docs/blob/main/HOMEPAGE_PERFORMANCE_BUDGET.md) |
| Monitor cache regressions | [Cloudflare Cache Observability](https://github.com/ramideltoro/nutsnews-docs/blob/main/CLOUDFLARE_CACHE_OBSERVABILITY.md) |
| Operate VPS failover visibility | [Failover Visibility Runbook](.github/deployment/failover-visibility-runbook.md) |
| Review security hardening | [Security Hardening](https://github.com/ramideltoro/nutsnews-docs/blob/main/SECURITY_HARDENING.md) |
| Validate Worker flows | See `ramideltoro/nutsnews-worker` |

---

## Main Dashboards

| Dashboard | Route |
| --- | --- |
| Admin home | `/admin` |
| Article reviews | `/admin/articles` |
| AI usage | `/admin/ai-usage` |
| Local AI | `/admin/local-ai` |
| Home server | `/admin/home-server` |
| Failover visibility | `/admin/failover` |
| Worker shards | `/admin/shards` |
| Feed health | `/admin/feed-health` |
| Feed management | `/admin/feeds` |
| Free-tier guardrails | `/admin/guardrails` |
| Edge snapshot | `/admin/edge-snapshot` |
| Cache observability | `/admin/cache` |

---

## Current Status

- Cloudflare cache observability for public cache headers, scheduled alerts, and the `/admin/cache` dashboard
- Security hardening for CSP, browser headers, admin no-store behavior, contact form controls, and CI validation

NutsNews includes:

- Mobile-first public feed
- Full archive search
- Multi-language article summaries
- Local AI review and summary support
- OpenAI fallback support
- Cloudflare Worker shard processing
- Supabase public feed snapshots
- Cloudflare KV edge feed snapshot fallback
- Protected admin dashboards
- CDN caching and image delivery controls
- Better Stack, Sentry, UptimeRobot, Grafana, Lighthouse, PageSpeed, homepage performance budgets, Cloudflare cache observability, and accessibility documentation
- Supabase backup and restore runbooks
- Offline mocked E2E tests for the web app and Worker, plus a live Vercel Preview smoke test for PR deployments
- Worker local-AI deployment lock documented in [Worker Local AI Lock](https://github.com/ramideltoro/nutsnews-docs/blob/main/NUTSNEWS_WORKER_LOCAL_AI_LOCK.md)

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).


## Translation quality

Issue #99 added multilingual quality checks, a daily translation coverage report, and `/admin/translations` dashboard visibility. See [Multilingual Quality and Fallbacks](https://github.com/ramideltoro/nutsnews-docs/blob/main/MULTILINGUAL_QUALITY_AND_FALLBACKS.md).
