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
- Documentation-only changes are the only exception to the feature-branch requirement: work from the latest repository default branch, commit the documentation update, push directly to the default branch, and report the commit SHA.
- MUST NOT commit secrets, .env files, API keys, tokens, database dumps, or private credentials.
- MUST NOT print secret values in logs, docs, PR descriptions, or terminal summaries.
- MUST prefer the smallest safe change that solves the issue.
- MUST inspect existing project patterns before adding new files or dependencies.
- MUST NOT add production dependencies unless clearly needed.
- MUST update documentation in `ramideltoro/nutsnews-docs` for ANY NutsNews work. There is no "no docs needed" exception.
- MUST NOT add product, operations, deployment, cache, automation, or environment documentation to this application repository. Documentation-only updates belong in `ramideltoro/nutsnews-docs` so they do not trigger application deployments.
- Documentation-only updates do not require a pull request. This direct-push rule applies only to documentation-only changes.
- Application code, runtime behavior, CI workflow, test, dependency, secret/configuration, deployment, cache, Worker, database, and infrastructure changes still require the normal branch and PR flow unless the user explicitly says otherwise.
- If branch protection blocks a documentation-only direct push, STOP and report the blocker instead of opening a PR automatically.
- Repository instruction updates to AGENTS.md are allowed in this repository when the user explicitly requests them.
- MUST preserve existing UI style unless the requested task explicitly changes it.
- For cache/CDN work, verify headers and document expected behavior.
- Avoid routing telemetry tunnels through middleware; prefer direct-to-provider telemetry unless a tunnel is explicitly required.
- Keep generated OG image routes cacheable and lightweight; avoid remote fetches and unsupported `ImageResponse` CSS.
- External uptime monitors such as Better Stack or UptimeRobot MUST hit `/healthz`, not public pages or article APIs.
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

## Documentation Requirements

- For ANY work done on NutsNews, Codex MUST update documentation in `ramideltoro/nutsnews-docs`.
- This applies to code, configuration, tests, scripts, UI, APIs, database behavior, infrastructure, Cloudflare, admin tools, caching, security, performance, bug fixes, documentation-only process changes, and repository instruction changes.
- There is no "no docs needed" exception. At minimum, every change MUST create or update a documentation entry summarizing what changed and why it happened.
- Codex MUST inspect the `ramideltoro/nutsnews-docs` structure and place the update in the most appropriate existing location.
- If no appropriate docs page exists, Codex MUST create a clearly named change note or changelog entry that follows the existing docs repo style.
- Documentation updates for product, operations, deployment, cache, automation, architecture, runbooks, environment variables, billing, limits, metrics, security, and cross-repo behavior MUST go in `ramideltoro/nutsnews-docs` unless the user explicitly requests instruction-only updates in this repository.
- Documentation updates MUST be specific, not generic.
- Documentation MUST explain what changed, why it changed, who is affected, how behavior is different, and any setup, environment variables, permissions, migrations, limits, or operational steps.
- Documentation MUST include risks, mitigations, and rollback notes when applicable.
- Documentation MUST include links to related PRs or issues when available.
- Every docs update MUST include Simple Summary, Intermediate Summary, and Expert Summary sections.
- Codex MUST NOT claim documentation is complete unless the relevant `ramideltoro/nutsnews-docs` update exists.

## Release Notes Requirements

Every PR MUST include release notes with all three REQUIRED audience levels:

- Simple Summary: MUST explain the change like speaking to a 5-year-old. Use plain language and one short paragraph.
- Intermediate Summary: MUST explain what changed, who it affects, how behavior is different, and what to watch for.
- Expert Summary: MUST include technical details, files/systems touched, data flow, configuration/environment changes, edge cases, risks, rollback notes, and test coverage.

Release notes MUST be specific to the actual change. Codex MUST NOT use generic filler or repeat the same wording across the three audience levels.

## Graphs And Details

- When a change affects workflows, data flow, caching, metrics, background jobs, APIs, auth, infrastructure, deployment, billing, limits, or operations, Codex MUST include a Mermaid diagram in the PR description or release notes.
- When a change affects workflows, request flow, data flow, caching, Cloudflare, metrics, auth, background jobs, APIs, database behavior, deployment, or infrastructure, Codex MUST include a Mermaid diagram in the `ramideltoro/nutsnews-docs` update.
- Mermaid diagrams MUST use flowcharts or sequence diagrams where helpful.
- The diagram MUST show before/after behavior or the important request, data, operational, or control path.
- If a graph would not add value, Codex MUST explicitly say why in the PR description.
- A graph is not REQUIRED for instruction-only, typo-only, or narrowly scoped copy changes when there is no workflow, data flow, or operational path to clarify, but the PR MUST say why it was omitted.

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

For documentation-only changes:

1. MUST confirm clean working tree or explicitly document existing user changes.
2. MUST checkout the repository default branch.
3. MUST pull the latest default branch when network access and permissions allow.
4. MUST make only the requested documentation changes.
5. MUST run lightweight docs/instruction validation that already exists.
6. MUST commit directly on the default branch.
7. MUST push directly to the default branch.
8. MUST report the pushed commit SHA in the final response.
9. MUST NOT open a PR unless the user explicitly asks for one.
10. If branch protection blocks the push, MUST stop and report the blocker.

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

- Documentation-only changes do not require a PR. Push documentation-only commits directly to the repository default branch and report the commit SHA.
- If the task requires a PR, or this AGENTS.md says to raise a PR, Codex MUST create the PR before the final response.
- For NutsNews work, Codex MUST create or update the application repository PR as required by this AGENTS.md.
- For NutsNews work, Codex MUST create or update a documentation repository PR in `ramideltoro/nutsnews-docs` for the documentation change.
- Codex MUST link the application PR and documentation PR to each other when both PRs exist and permissions allow.
- Every PR MUST include release notes with Simple Summary, Intermediate Summary, and Expert Summary.
- Every PR MUST include tests/checks run with exact commands and pass/fail results.
- MUST include the PR link in the final response when a PR is created.
- MUST NOT merge the PR unless the user explicitly asks.
- If a PR cannot be created, MUST explain the exact blocker and what remains.
- If the user explicitly asks not to create a PR, MUST follow the user's instruction and document that no PR was created.

## PR Description Contract

Every PR description MUST include all of the following:

- Simple Summary.
- Intermediate Summary.
- Expert Summary.
- User/admin impact.
- Documentation updated, with `ramideltoro/nutsnews-docs` links, PR links, or file paths.
- Release notes containing the three required audience levels.
- Tests/checks run with exact commands and pass/fail results.
- Risks and mitigations.
- Rollback plan.
- Mermaid graph when applicable, or an explicit explanation of why a graph would not add value.
- Related application PR and documentation PR links when both PRs exist.

Codex MUST update the PR description before the final response if any required section is missing, stale, or contradicted by the final implementation.

## Final Response Contract

Codex MUST include all of the following before finishing:

- AGENTS.md files read.
- NutsNews docs repo files updated.
- Summary of changes.
- Files changed.
- Documentation update summary.
- Release notes added.
- Tests/checks run with exact commands and pass/fail results.
- Application PR link, if created or required.
- Documentation PR link, if created or required.
- Documentation-only direct-push commit SHA, if no PR was required.
- Any blockers or unverified items.
- Final "AGENTS.md compliance checklist".

## Definition of Done

A task is NOT done until:

- Applicable AGENTS.md files were read and named.
- User changes were preserved.
- Requested code/doc changes were completed.
- Documentation was updated in `ramideltoro/nutsnews-docs`.
- Release notes were included with Simple Summary, Intermediate Summary, and Expert Summary.
- Required Mermaid diagrams were included when applicable.
- Required PR summary sections were completed, including user/admin impact, documentation status, release notes, tests/checks, risks, rollback, and graph status.
- Relevant checks/tests were run and reported.
- Required application PR and documentation PR were created and linked, or documentation-only changes were pushed directly to the default branch and the commit SHA was reported.
- Any skipped REQUIRED step has an explicit blocker.

## Useful commands

- git status --short
- git branch --show-current
- gh pr checks --watch
- gh run list --limit 10

## User preference

The user prefers step-by-step terminal instructions, one step at a time, with commands that can be copied and pasted.
