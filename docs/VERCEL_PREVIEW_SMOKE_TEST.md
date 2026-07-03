# Vercel Preview Smoke Test

This regression runs against the real Vercel Preview deployment created for a pull request.

## What it verifies

The Playwright smoke test opens the deployed preview URL and verifies:

1. The homepage renders article cards.
2. Apps, About, Contact, and Privacy pages load from the preview.
3. The footer Home button scrolls the homepage back to the top with animated movement.
4. Footer search for `dogs` returns at least one result.
5. The Settings menu opens and every theme can be applied and persisted.
6. The Language menu changes articles from English to French, Japanese, Swiss German, German, Greek, and back to English.

## How it runs

The workflow `.github/workflows/vercel-preview-smoke.yml` listens for `deployment_status` events. When Vercel reports a successful non-production `vercel.app` deployment, GitHub Actions runs:

```bash
cd web
PLAYWRIGHT_BASE_URL="https://your-vercel-preview-url.vercel.app" npm run test:e2e:preview
```

The same workflow can be started manually with `workflow_dispatch` by entering a preview URL.

## Immutable test policy

The preview smoke test, the immutable guard, and the offline public web E2E regression are locked. Future pull requests cannot modify them unless Rami explicitly approves the change by adding this exact phrase to the PR title or body:

```text
IMMUTABLE TEST CHANGE APPROVED BY RAMI
```

This is enforced by `.github/workflows/immutable-tests-guard.yml` and `scripts/immutable_preview_smoke_guard.mjs`.

## Protected Vercel preview deployments

If Vercel Deployment Protection or Vercel Authentication is enabled for preview deployments, GitHub Actions must send Vercel's automation bypass secret with the Playwright requests.

1. In Vercel, open the NutsNews project.
2. Go to Settings -> Deployment Protection.
3. Under Protection Bypass for Automation, create a secret for GitHub Actions / Playwright.
4. Add the same value to the GitHub repository secret named `VERCEL_AUTOMATION_BYPASS_SECRET`.

The Playwright config sends the secret as the `x-vercel-protection-bypass` header and sets `x-vercel-set-bypass-cookie: true` so browser follow-up requests can reach the protected deployment. Do not commit the secret.
