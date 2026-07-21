# AGENTS.md

## Purpose
This repo is for NutsNews app work. Keep changes here unless the task explicitly requires coordinated edits in another NutsNews repo.

## Repo Boundaries
- `ramideltoro/nutsnews`: app work.
- `ramideltoro/nutsnews-infra`: VPS, GitOps, and ops.
- `ramideltoro/nutsnews-docs`: shared docs and runbooks.
- `ramideltoro/nutsnews-worker`: queues, workers, and integration tasks.
- `ramideltoro/nutsnews-ios`: mobile/iOS tasks.
- `ramideltoro/nutsnews-backend`: backend server/runtime work.

## Operating Mode
- Work autonomously. Make reasonable assumptions and keep moving.
- Ask for input only when blocked by required approval, credentials/MFA, destructive action, external service failure, or ambiguity where a reasonable assumption would be risky.
- Continue until the task is done or a real blocker is reached.
- Keep responses, plans, and status updates concise. Prefer summaries and compact command output over full logs.
- For NutsNews work, follow the nearest repo-local `AGENTS.md` first.
- Start new work in a fresh Codex thread when the interface supports it.
- Keep this file simple; add repo-specific instructions only when they are stable and necessary.

## Access And Automation
- API credentials live at `/Users/ramideltoro/NutsNews-Files/credentials.env`. Use them for appropriate automation, including Supabase, Grafana Cloud, GitHub, and similar services.
- Do not print, commit, or paste secrets.
- Use `ssh nutsnews-vps` for read-only VPS verification when needed.
- Use `ssh -i ~/.ssh/servercheap_65_75_201_18 rami@65.75.201.18` for backend verification when needed.
- Use `chrome-devtools` MCP only for browser verification. Do not use the ChatGPT Chrome plugin.

## Git And Issues
- Start each task on a fresh branch before making changes.
- When working through GitHub issues, handle one issue at a time unless coordination is necessary.
- If an issue is blocked, add a GitHub issue comment with the blocker, evidence, commands run, and next suggested step.
- If you find a new issue that should be handled, create a GitHub issue immediately with concise reproduction/context.
- Do not revert user changes unless explicitly asked.

## Validation
- Run the smallest useful validation first; expand as needed based on risk.
- Use bounded waits for long-running checks. Capture IDs/URLs, wait 60 seconds before polling again, and repeat until success or a real blocker.
- For code work, the definition of done is: PR opened, checks pass, merged to main, main checks pass, deployment monitored, and the final post-merge pipeline stage succeeds.
- Stop before that only when blocked, and record the blocker where future Codex work can resume.
