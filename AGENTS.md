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

- MUST start from an up-to-date main branch unless the user explicitly directs work on the current branch or an existing PR branch.
- MUST create a feature branch for changes unless already on the user-requested branch.
- MUST NOT commit secrets, .env files, API keys, tokens, database dumps, or private credentials.
- MUST NOT print secret values in logs, docs, PR descriptions, or terminal summaries.
- MUST prefer the smallest safe change that solves the issue.
- MUST inspect existing project patterns before adding new files or dependencies.
- MUST NOT add production dependencies unless clearly needed.
- Update documentation in `ramideltoro/nutsnews-docs` when behavior, deployment steps, cache behavior, workers, automation, or environment variables change.
- MUST NOT add product, operations, deployment, cache, automation, or environment documentation to this application repository. Documentation-only updates belong in `ramideltoro/nutsnews-docs` so they do not trigger application deployments.
- Repository instruction updates to AGENTS.md are allowed in this repository when the user explicitly requests them.
- MUST preserve existing UI style unless the requested task explicitly changes it.
- For cache/CDN work, verify headers and document expected behavior.
- Avoid routing telemetry tunnels through middleware; prefer direct-to-provider telemetry unless a tunnel is explicitly required.
- Keep generated OG image routes cacheable and lightweight; avoid remote fetches and unsupported `ImageResponse` CSS.
- External uptime monitors such as Better Stack or UptimeRobot should hit `/healthz`, not public pages or article APIs.
- Prefer ISR and cached fetch/database helpers for public article pages when freshness allows.
- For GitHub Actions work, include regression checks when practical.
- For Vercel/Cloudflare deployment work, include safe dry-run or validation paths when practical.

## Mandatory Preflight

STOP before editing until this preflight is complete.

- MUST read this AGENTS.md and any nested AGENTS.md files that apply to the files being changed.
- MUST state which AGENTS.md files were read before making edits.
- MUST run `git status --short` before editing.
- MUST preserve user changes.
- MUST NOT overwrite, revert, reset, discard, or clean user work unless the user explicitly asks for that exact action.
- MUST identify the relevant files and areas before making changes.
- MUST inspect existing files before editing them.
- MUST treat uncommitted changes as user-owned unless Codex created them in the current task.

## Scope Rules

- MUST keep changes limited to the user's request.
- MUST NOT perform unrelated refactors, cleanup, formatting churn, dependency changes, or application-code edits.
- MUST explain investigation commands in simple terms when debugging or when commands may affect remote services.
- MUST use existing project patterns unless there is a clear, task-specific reason not to.
- MUST keep implementation changes in the owning repo. If a change crosses web, worker, and docs boundaries, make coordinated PRs instead of mixing unrelated ownership into one repository.

## Local validation expectations

The Next.js web app lives in `web/`.

Before opening or updating a PR, inspect `web/package.json` and run the relevant checks that exist there.

Common checks may include:

- cd web && npm install
- cd web && npm run lint
- cd web && npm run build
- cd web && npm test

Only run commands that exist in this repository.

## Test Rules

- MUST run the relevant project checks/tests before the final response.
- MUST inspect available scripts or documented commands before choosing checks.
- If this AGENTS.md requires all tests to pass, Codex MUST NOT claim the task is complete unless tests pass or a real environment, configuration, or sandbox blocker is documented.
- MUST clearly separate code failures from environment, configuration, dependency, network, credential, or sandbox failures.
- MUST include the exact commands run and their pass/fail result in the final response.
- MUST NOT say "tests pass" unless the tests were actually run and passed.
- If tests cannot be run, MUST explain exactly why and what remains unverified.
- For documentation-only AGENTS.md changes, MUST at minimum review `git diff` and confirm the updated instructions are internally consistent.

## GitHub workflow

For normal implementation tasks:

1. MUST confirm clean working tree or explicitly document existing user changes.
2. MUST checkout main unless the user explicitly directs work on the current branch or an existing PR branch.
3. MUST pull latest origin/main when network access and permissions allow.
4. MUST create a new branch unless already on the user-requested branch.
5. MUST make only the requested code/docs changes.
6. MUST run relevant local checks.
7. MUST commit with a clear message when a PR is required.
8. MUST push the branch when a PR is required.
9. MUST create a PR using `gh pr create` when a PR is required.
10. MUST watch PR checks using `gh pr checks` and `gh run watch` when practical.
11. If checks fail, MUST inspect logs, fix, push again, and repeat until checks pass or a real blocker is documented.
12. MUST NOT merge unless all required checks pass and the user explicitly asks to merge.
13. MUST NOT auto-merge unless the user explicitly requested auto-merge.

## PR Rules

- If the task requires a PR, or this AGENTS.md says to raise a PR, Codex MUST create the PR before the final response.
- MUST include the PR link in the final response when a PR is created.
- MUST NOT merge the PR unless the user explicitly asks.
- If a PR cannot be created, MUST explain the exact blocker and what remains.
- If the user explicitly asks not to create a PR, MUST follow the user's instruction and document that no PR was created.

## Final Response Contract

Codex MUST include all of the following before finishing:

- AGENTS.md files read.
- Summary of changes.
- Files changed.
- Tests/checks run with exact commands and pass/fail results.
- PR link, if required.
- Any blockers or unverified items.
- Final "AGENTS.md compliance checklist".

## Definition of Done

A task is NOT done until:

- Applicable AGENTS.md files were read and named.
- User changes were preserved.
- Requested code/doc changes were completed.
- Relevant checks/tests were run and reported.
- Required PR was created and linked.
- Any skipped REQUIRED step has an explicit blocker.

## Useful commands

- git status --short
- git branch --show-current
- gh pr checks --watch
- gh run list --limit 10

## User preference

The user prefers step-by-step terminal instructions, one step at a time, with commands that can be copied and pasted.
