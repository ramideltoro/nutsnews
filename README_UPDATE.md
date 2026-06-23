# NutsNews Name Story Update

This update adds one new section to the About page explaining the story behind the NutsNews name.

Updated file:

- `web/app/about/page.tsx`

## What changed

Added a new `The name` section after `Good news should be easier to find`.

The new section explains:

- The original idea was to use `GoodNews.com`.
- The `.com` domain was important.
- Good-news synonym domains were already taken.
- The name came from searching synonyms for `good`.
- `nuts` stood out because, in poker, it means the best possible hand.
- NutsNews became a fitting name for a site focused on the best kind of news.

No other page copy, layout, banner, footer, or workflow icon changes were made.

## Validation performed

From `web/`:

```bash
npx eslint app/about/page.tsx
npx tsc --noEmit
```

Both commands completed successfully.
