# Homepage Performance Budget

NutsNews is mobile-first and image-heavy, so homepage speed needs explicit limits. This page defines the current budgets, the CI checks, and the common fixes to use before raising a limit.

---

## Budget Targets

These targets apply to the public homepage route:

```text
/
```

| Area | Target | Warn | Hard limit | Checked by |
| --- | ---: | ---: | ---: | --- |
| Largest Contentful Paint | 2.5 s | 3.0 s | 4.0 s | Lighthouse CI and PageSpeed Insights |
| Initial JavaScript, gzip | 180 KB | 220 KB | 260 KB | Homepage budget script |
| Initial CSS, gzip | 30 KB | 45 KB | 60 KB | Homepage budget script |
| Homepage static images, raw | 250 KB | 350 KB | 400 KB | Homepage budget script |
| Runtime image transfer | 200 KB | 300 KB | 400 KB | Lighthouse CI and PageSpeed Insights |
| Total initial transfer, gzip | 360 KB | 450 KB | 550 KB | Homepage budget script |

Hard limits fail CI. Warning limits create GitHub Actions annotations and should be fixed before the next UI change pushes them into failure territory.

The budget source of truth is:

```text
web/performance-budget.json
```

The Lighthouse resource budget is:

```text
web/lighthouse-budget.json
```

---

## CI Workflow

The homepage budget workflow runs on pull requests and pushes that touch the web app:

```text
.github/workflows/homepage-performance-budget.yml
```

It does four things:

1. Builds the Next.js app.
2. Reads the generated `.next` manifests for the homepage route.
3. Writes a Markdown and JSON report to `web/reports/performance-budget`.
4. Uploads the report as a GitHub Actions artifact.

Run the same check locally:

```bash
cd web
npm run build
npm run analyze:homepage
```

Create a warning-only report while investigating:

```bash
cd web
npm run analyze:homepage:warn
```

---

## Budget Change Review

Budget changes should be rare. They need an intentional PR review because raising a budget can hide a real regression.

If a PR changes either budget file, include this marker in the PR title or body after reviewing the reason:

```text
[performance-budget-reviewed]
```

Use that marker only when the increase is justified, documented, and safer than reducing the bundle or image weight.

---

## Common Fixes Before Raising Budgets

### JavaScript

Prefer these fixes first:

- Keep the homepage mostly server-rendered.
- Avoid adding new client components unless they are needed for interaction.
- Move non-critical behavior behind dynamic imports.
- Avoid adding broad UI/helper libraries for small homepage interactions.
- Reuse existing components instead of introducing a second implementation.

### CSS

Prefer these fixes first:

- Remove unused homepage classes when a layout is replaced.
- Keep animation and theme styles scoped to the components that use them.
- Avoid duplicate responsive rules for the same card layout.
- Prefer one shared card system over multiple visual variants.

### Images

Prefer these fixes first:

- Compress static homepage images before committing them.
- Keep only the true first-screen image marked as priority.
- Use `next/image` sizes that match the rendered card width.
- Do not increase image quality unless the visual difference is obvious on a phone.
- Avoid adding large decorative images to the initial viewport.

### LCP

Prefer these fixes first:

- Keep the first visible card simple and stable.
- Avoid layout shifts in the masthead and first article card.
- Keep the initial homepage data request cache-friendly.
- Do not block the first paint on analytics, animations, or optional UI.
- Check mobile Lighthouse output before trusting desktop-only results.

---

## Reports

CI uploads these files when the workflow runs:

```text
web/reports/performance-budget/homepage-performance-budget.md
web/reports/performance-budget/homepage-performance-budget.json
```

The Markdown report is the easiest one to read. The JSON report is better for automation or comparing two runs.
