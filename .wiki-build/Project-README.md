<!-- Auto-generated from README.md. Do not edit this wiki page directly. -->

> Source: `README.md`  
> Last generated: 2026-06-27T18:57:09.981Z

# NutsNews

**A calm, mobile-first positive news platform powered by RSS automation, AI curation, serverless infrastructure, CDN caching, centralized observability, and private admin dashboards.**

NutsNews collects uplifting stories from trusted RSS feeds, filters out stressful topics, creates short cheerful summaries, and links readers back to the original publishers.

The project is designed to be simple to use, inexpensive to operate, easy to maintain, observable in production, and scalable enough to grow from a small experiment into a fully automated positive-news platform.

---

## Highlights

| Area | Summary |
| --- | --- |
| Product | Mobile-first positive news feed |
| Mission | Give readers a calmer alternative to stressful news |
| Frontend | Next.js app hosted on Vercel |
| Automation | Cloudflare Worker shards fetch and process RSS feeds |
| Controller | Controller Worker coordinates shard execution |
| Database | Supabase Postgres stores articles, feeds, review history, and operational data |
| AI | Home-server local AI with Ollama/qwen classifies, scores, and summarizes candidate stories, with OpenAI fallback |
| Admin | Google-protected admin dashboards for article review, source health, worker health, and internal operations |
| CDN | Cloudflare caches public reader routes and article API responses |
| Feed Snapshot | Supabase materialized public feed snapshot speeds homepage/API reads |
| Observability | Better Stack logs and uptime, UptimeRobot public uptime checks, Lighthouse CI web quality checks, PageSpeed Insights production audits, axe Playwright accessibility CI, Sentry errors, Grafana Cloud Prometheus backup monitoring, admin health dashboards |
| Dependency Maintenance | Repeatable npm audit, safe update, and build validation routine |
| Source Quality | Supabase feed quality scoring ranks RSS sources by useful output |
| Recovery | Automated Supabase backups to encrypted OneDrive plus documented restore runbook with validation SQL |
| Cost model | Built around free-tier cloud services, local AI support, and optional OpenAI fallback |

---

## Documentation

The full project documentation lives in [`docs/`](docs/).

| Document | Purpose |
| --- | --- |
| [Docs Index](NutsNews-Documentation) | Start here for all project docs |
| [Project Overview](Project-Overview) | Product story, mission, reader experience, and benefits |
| [Architecture](Architecture) | System design, major components, and data flow |
| [Operations](Operations) | Admin portal, deployment, maintenance, and operational workflows |
| [Admin Article Reviews](Admin-Article-Review-Dashboard) | Article review dashboard, filters, time sorting, rejection reasons, provider/model tracking, and investigation workflow |
| [Responsive Admin Dashboards](Responsive-Admin-Dashboards) | Mobile responsiveness layer for protected admin dashboards, tables, cards, headings, and touch controls |
| [Deployment Checklist](Deployment-Checklist) | Repeatable release checklist |
| [Home Server Local AI](Home-Server-Local-AI-Provider) | Current production home-server local AI setup with Cloudflare Tunnel, Ollama/qwen, Worker Secrets Store, monitoring, troubleshooting, and rollback |
| [Home Server Dashboard](Home-Server-Admin-Dashboard) | Protected `/admin/home-server` dashboard, `/stats` endpoint, instance metrics, Vercel env vars, deployment, and troubleshooting |
| [Grafana Backup Monitoring](Grafana-Cloud-Backup-Monitoring) | Grafana Cloud Explore, PromQL queries, dashboard panels, and alerts for home-server backup success, freshness, count, and next run |
| [NutsNews Supabase Backup Automation](NutsNews-Supabase-Backup-Automation) | Home-server Supabase backups to encrypted OneDrive, daily schedule, retention, on-demand commands, metrics, and restore notes |
| [Oracle Local AI Alternative](Oracle-Local-AI-Provider) | Earlier Oracle Free Tier local AI design and fallback option if Oracle capacity becomes available later |
| [Dependency Updates](Dependency-Update-Routine) | Repeatable npm audit, safe patch/minor update, and validation routine |
| [Controller and Shards](Controller-and-Shard-Operations) | Manual controller triggers, shard tests, Wrangler tail, and expected response fields |
| [Performance and Resiliency](Performance-and-Resiliency) | CDN, caching, Worker sharding, indexes, image delivery, failure handling, and cost controls |
| [Image Delivery](Image-Delivery) | Next Image optimization, responsive article thumbnails, cache TTL, placeholders, and raw-image fallback behavior |
| [Public Feed Snapshot](Public-Feed-Snapshot) | Materialized homepage/API feed snapshot, Worker refresh flow, fallback behavior, and validation checks |
| [Observability](Observability) | Better Stack, Sentry, dashboards, structured logs, and health checks |
| [UptimeRobot Onboarding](UptimeRobot-Onboarding) | Step-by-step public uptime, keyword, API, privacy/contact page, alert contact, and safe health-check monitor setup |
| [Lighthouse CI Onboarding](Google-Lighthouse-CI-Onboarding) | Step-by-step GitHub Actions setup for Google Lighthouse CI checks from the `web/` app, including thresholds, secrets, validation, and safe audited URLs |
| [PageSpeed Insights](PageSpeed-Insights-for-NutsNews) | Production mobile/desktop PageSpeed audits after major UI changes, including npm scripts, reports, thresholds, and manual GitHub workflow |
| [axe Playwright Accessibility CI](axe-Accessibility-CI-with-Playwright) | Step-by-step GitHub Actions setup for automated axe accessibility checks from Playwright, including safe public-page routes, serious/critical thresholds, reports, and WAVE manual review guidance |
| [RSS Source Quality](RSS-Source-Quality-Scoring) | Quality score formula, Supabase ranking query, admin dashboard behavior, and feed promotion/disable rules |
| [Supabase Restore Procedure](Supabase-Restore-Procedure) | Backup locations, restore order, SQL import commands, validation queries, and restore-test checklist |
| [Troubleshooting Guide](Troubleshooting-Guide) | Diagnose common production problems from one document |

---

## Repository Structure

```text
nutsnews/
├── web/          # Next.js public site and admin portal
├── worker/       # Cloudflare Worker RSS ingestion engine
├── controller/   # Cloudflare Worker shard controller
├── local-ai-service/ # Home-server/Ollama local AI review endpoint
├── supabase/     # Supabase migrations, restore validation SQL, and database configuration
├── docs/         # GitHub documentation
├── scripts/      # Project utility scripts
├── README.md     # Short project entry point
└── LICENSE       # MIT license
```

---

## Quick Links

| Area | Link |
| --- | --- |
| Public site | https://www.nutsnews.com |
| Admin portal | `/admin` |
| Article review dashboard | `/admin/articles` |
| AI usage dashboard | `/admin/ai-usage` |
| Local AI dashboard | `/admin/local-ai` |
| Home server dashboard | `/admin/home-server` |
| Grafana backup monitoring | [docs/GRAFANA_BACKUP_MONITORING.md](Grafana-Cloud-Backup-Monitoring) |
| UptimeRobot onboarding | [docs/UPTIMEROBOT_ONBOARDING.md](UptimeRobot-Onboarding) |
| PageSpeed Insights | [docs/PAGESPEED_INSIGHTS.md](PageSpeed-Insights-for-NutsNews) |
| axe accessibility CI | [docs/AXE_PLAYWRIGHT_ACCESSIBILITY_CI.md](axe-Accessibility-CI-with-Playwright) |
| NutsNews DB backups | [docs/NUTSNEWS_DB_BACKUPS.md](NutsNews-Supabase-Backup-Automation) |
| Worker health dashboard | `/admin/shards` |
| Feed health dashboard | `/admin/feed-health` |
| Feed management dashboard | `/admin/feeds` |
| Dependency update guide | [docs/DEPENDENCY_UPDATES.md](Dependency-Update-Routine) |
| RSS source quality guide | [docs/RSS_SOURCE_QUALITY.md](RSS-Source-Quality-Scoring) |
| Public feed snapshot guide | [docs/PUBLIC_FEED_SNAPSHOT.md](Public-Feed-Snapshot) |
| Supabase restore runbook | [docs/SUPABASE_RESTORE.md](Supabase-Restore-Procedure) |
| Troubleshooting | [docs/TROUBLESHOOTING.md](Troubleshooting-Guide) |

---

## Current Status

NutsNews currently includes:

* Mobile-first public article feed with automatic scroll loading
* RSS-based content discovery
* AI assisted article filtering and summaries
* Home-server local AI provider support with qwen/Ollama, Cloudflare Tunnel, and optional OpenAI fallback
* Thumbnail quality controls
* Supabase article, feed, review, AI usage, Worker run, and feed health tables
* Cloudflare Worker sharding
* Controller Worker orchestration
* Supabase public feed snapshot for faster homepage/API reads
* Optimized article image delivery with responsive Next Image thumbnails, AVIF/WebP support, and safe raw-image fallback
* Cloudflare CDN caching for public reader routes
* Lighthouse CI quality checks, PageSpeed Insights production audits, and axe Playwright accessibility regression checks
* Better Stack uptime monitoring and centralized logs
* UptimeRobot public website, homepage keyword, article API, privacy page, and contact page monitoring documentation
* Grafana Cloud Prometheus backup monitoring for the home server
* Automated NutsNews Supabase backups to encrypted OneDrive from the home server
* Sentry error monitoring
* Google-protected admin portal
* Responsive admin dashboard shell for mobile-friendly protected dashboard pages
* Article review dashboard for accepted/rejected story decisions with AI provider/model visibility
* AI usage dashboard
* Local AI dashboard for home-server/Ollama model activity, fallback usage, latency, and recent decisions
* Home server dashboard for CPU, memory, disk, uptime, critical service status, Ollama models, and local AI runtime configuration
* Worker shard health dashboard
* RSS feed health and feed management dashboards
* RSS source quality scoring with 0-100 feed rankings
* Repeatable dependency update routine with npm audit/outdated reports and safe patch/minor updates
* Dependabot npm monitoring for web, Worker, and controller projects
* Database indexes for feed/API and article review dashboard performance
* GitHub documentation in `docs/`
* Production troubleshooting guide for issue #30
* Controller and shard operations guide for issue #37
* Worker article recovery improvements for no-thumbnail retries and image hydration
* Truncated failed-feed error previews for cleaner Worker and controller responses
* Supabase restore runbook, restore validation SQL, and restore verification helper script
* NutsNews Supabase backup automation docs for encrypted OneDrive backups, daily schedule, retention, on-demand helper commands, and Grafana metrics
* MIT license

---

## License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for details.
