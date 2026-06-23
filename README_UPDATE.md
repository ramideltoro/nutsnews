# NutsNews Shorter Footer Update

This update makes the fixed footer shorter while keeping the same layout:

- Footer links centered on the first row.
- One-line copyright centered underneath.

Updated file:

- `web/app/components/SiteFooter.tsx`

## What changed

- Reduced footer vertical padding from `py-3` to `py-2`.
- Reduced row gap from `gap-2` to `gap-1`.
- Reduced nav pill padding from `p-1` to `p-0.5`.
- Reduced footer link vertical padding from `py-1` to `py-0.5`.
- Reduced copyright text from `text-[10px] leading-4` to `text-[9px] leading-3`.

## Validation performed

From `web/`:

```bash
npx eslint app/components/SiteFooter.tsx
npx tsc --noEmit
```

Both commands completed successfully.
