# NutsNews About Page + Mobile Banner Update

This update contains full replacement source files for:

- `web/app/page.tsx`
- `web/app/about/page.tsx`
- `web/app/components/SiteFooter.tsx`

## What changed

- Keeps the NutsNews logo icon the same size and position in the home banner.
- Makes the `NutsNews` banner title smaller only on mobile so it stays on one line.
- Keeps the desktop banner title at the existing size.
- Keeps the subtitle on one line on mobile with slightly tighter mobile tracking.
- Completely rewrites the About page with a polished project story covering the purpose, product direction, automation, AI curation, infrastructure, observability, admin tooling, mobile experience, and iOS foundation.
- Adds the About page link to the fixed footer next to Contact and Privacy.

## Validation performed

From `web/`:

```bash
npx eslint app/page.tsx app/about/page.tsx app/components/SiteFooter.tsx
npx tsc --noEmit
```

Both commands completed successfully for the updated files / TypeScript project.

Note: the full existing lint command still reports unrelated pre-existing issues in `ArticleFeed.tsx` and `lib/adminArticleReviews.ts` that were not touched by this update.
