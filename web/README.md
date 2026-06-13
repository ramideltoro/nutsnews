# NutsNews

**A calm, mobile-first positive news platform powered by automation, AI curation, serverless infrastructure, CDN caching, and centralized observability.**

NutsNews collects uplifting stories from trusted RSS feeds, filters out stressful topics, creates short cheerful summaries, and links readers back to the original publishers.

The project is designed to be simple to use, inexpensive to operate, easy to maintain, and scalable enough to grow from a small experiment into a fully automated positive-news platform.

---

## Project Snapshot

| Area | Highlight |
| --- | --- |
| Product | Mobile-first positive news feed |
| Mission | Give readers a calmer alternative to stressful news |
| Content model | RSS discovery, AI-assisted filtering, short summaries, source links |
| Frontend | Next.js website hosted on Vercel |
| Automation | Cloudflare Workers process RSS feeds |
| AI | OpenAI classifies, scores, and summarizes candidate articles |
| Database | Supabase Postgres stores articles and review history |
| CDN | Cloudflare caches public pages and API responses |
| Logging | Better Stack centralizes structured logs |
| Monitoring | Sentry tracks application errors; Better Stack tracks uptime |
| Cost model | Designed around free-tier cloud services, with the domain as the main fixed cost |

---

## The Story Behind NutsNews

Most news products are built around urgency. They compete for attention with conflict, fear, politics, money, and breaking events.

NutsNews takes a different direction.

The goal is to create a peaceful place where readers can quickly find stories that feel encouraging, warm, interesting, and human. Instead of replacing publishers, NutsNews helps readers discover positive stories and then sends them back to the original source.

A reader should be able to open NutsNews and immediately understand the feeling of the product:

> “Here is something good happening in the world.”

That product idea drives the technical design. The platform is built to automatically discover articles, filter them, summarize them, publish them, cache them, monitor them, and log what happened — all while staying inexpensive and easy to extend.

---

## Mission

NutsNews exists to make positive stories easier to find.

The platform focuses on stories about:

- Community
- Wellness
- Science
- Culture
- Animals
- Travel
- Lifestyle
- Nature
- Space
- Creativity
- Human achievement
- Inspiring people
- Helpful discoveries
- Remarkable moments

The goal is not to become a traditional newsroom. The goal is to become a fully automated positive-news discovery layer that helps readers find uplifting stories from around the web.

---

## What NutsNews Avoids

NutsNews intentionally avoids content that creates stress or conflict.

The platform is designed to filter out stories mainly focused on:

- Politics
- War
- Crime
- Tragedy
- Violence
- Fear
- Market panic
- Financial stress
- Election conflict
- Government conflict
- Outrage-driven news

This editorial direction keeps the product focused and gives the site a clear identity.

---

## Product Experience

NutsNews is designed for quick mobile reading.

Each story card gives the reader:

- A clear title
- A short cheerful summary
- A source label
- A published date
- Category badges
- A story thumbnail
- A link to the original publisher

The reading experience is intentionally simple. The homepage behaves like a calm feed of uplifting stories rather than a noisy news portal.

---

## Architecture Overview

NutsNews uses a serverless architecture. Each part of the system has a focused role.

```text
RSS Sources
    ↓
Cloudflare Worker Shards
    ↓
Local Filtering
    ↓
OpenAI Review
    ↓
Supabase Postgres
    ↓
Next.js Website on Vercel
    ↓
Cloudflare CDN
    ↓
Reader