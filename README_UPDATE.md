# NutsNews Footer One-Line Copyright Update

This update changes the footer layout so the footer links stay centered on the first row and the copyright text appears below the links as one centered line.

Updated file:

- `web/app/components/SiteFooter.tsx`

## What changed

- Footer navigation remains: `About`, `Contact`, `Privacy`.
- Copyright moved under the footer links.
- Copyright now displays as one line:
  - `© 2026 Rami Del Toro · All Rights Reserved.`
- The Rami Del Toro link remains clickable.

## Validation performed

From `web/`:

```bash
npx eslint app/components/SiteFooter.tsx
npx tsc --noEmit
```

Both commands completed successfully.
