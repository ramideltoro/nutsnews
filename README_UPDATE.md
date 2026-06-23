# NutsNews About Workflow Icons Update

This update replaces the two-letter abbreviations in the About page workflow circles with inline SVG icons.

Updated file:

- `web/app/about/page.tsx`

## What changed

In the `A careful pipeline behind a simple feed` section:

- Discover now uses an RSS / broadcast icon.
- Filter now uses a filtering / narrowing icon.
- Summarize now uses a document summary icon.
- Send readers onward now uses an external-link icon.

No copy, layout, footer, banner, or icon positioning changes were made.

## Validation performed

From `web/`:

```bash
npx eslint app/about/page.tsx
npx tsc --noEmit
```

Both commands completed successfully.
