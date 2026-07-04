# AGENTS.md

## Project

This is the NutsNews web repository.

- Production site: https://nutsnews.com
- Main web application repository: https://github.com/ramideltoro/nutsnews
- Worker/automation repository: https://github.com/ramideltoro/nutsnews-worker
- Shared documentation repository: https://github.com/ramideltoro/nutsnews-docs
- Primary branch: main
- Hosting: Vercel
- CDN/DNS/security: Cloudflare
- Database: Supabase Postgres
- Workers: Cloudflare Workers live in `ramideltoro/nutsnews-worker`

## Repository map

- `ramideltoro/nutsnews`: production web application, Next.js admin/public UI, Vercel hosting, app routes, cache policy, PageSpeed tooling, and web-facing guardrails.
- `ramideltoro/nutsnews-worker`: worker/controller jobs, Cloudflare Worker code, queue/scheduled automation, worker-side cache/KV behavior, and feed-processing automation.
- `ramideltoro/nutsnews-docs`: shared operational documentation, runbooks, deployment notes, environment-variable inventory, cache behavior, and cross-repo architecture notes.
- Keep implementation changes in the owning repo. If a change crosses web, worker, and docs boundaries, make coordinated PRs instead of mixing unrelated ownership into one repository.

## Working rules

- Always start from an up-to-date main branch.
- Always create a feature branch for changes.
- Never commit secrets, .env files, API keys, tokens, database dumps, or private credentials.
- Never print secret values in logs, docs, PR descriptions, or terminal summaries.
- Prefer the smallest safe code change that solves the issue.
- Inspect existing project patterns before adding new files or dependencies.
- Do not add production dependencies unless clearly needed.
- Update documentation in `ramideltoro/nutsnews-docs` when behavior, deployment steps, cache behavior, workers, automation, or environment variables change.
- Do not add product, operations, deployment, cache, automation, or environment documentation to this application repository. Documentation-only updates belong in `ramideltoro/nutsnews-docs` so they do not trigger application deployments.
- Preserve existing UI style unless the requested task explicitly changes it.
- For cache/CDN work, verify headers and document expected behavior.
- Avoid routing telemetry tunnels through middleware; prefer direct-to-provider telemetry unless a tunnel is explicitly required.
- Keep generated OG image routes cacheable and lightweight; avoid remote fetches and unsupported `ImageResponse` CSS.
- External uptime monitors such as Better Stack or UptimeRobot should hit `/healthz`, not public pages or article APIs.
- Prefer ISR and cached fetch/database helpers for public article pages when freshness allows.
- For GitHub Actions work, include regression checks when practical.
- For Vercel/Cloudflare deployment work, include safe dry-run or validation paths when practical.

## Local validation expectations

The Next.js web app lives in `web/`.

Before opening or updating a PR, inspect `web/package.json` and run the relevant checks that exist there.

Common checks may include:

- cd web && npm install
- cd web && npm run lint
- cd web && npm run build
- cd web && npm test

Only run commands that exist in this repository.

## GitHub workflow

For normal implementation tasks:

1. Confirm clean working tree.
2. Checkout main.
3. Pull latest origin/main.
4. Create a new branch.
5. Make the code/docs changes.
6. Run relevant local checks.
7. Commit with a clear message.
8. Push the branch.
9. Create a PR using gh pr create.
10. Watch PR checks using gh pr checks and gh run watch.
11. If checks fail, inspect logs, fix, push again, and repeat.
12. Do not merge unless all required checks pass.
13. Prefer asking before merging unless the user explicitly requested auto-merge.

## Useful commands

- git status --short
- git branch --show-current
- gh pr checks --watch
- gh run list --limit 10

## User preference

The user prefers step-by-step terminal instructions, one step at a time, with commands that can be copied and pasted.
