<!-- Auto-generated from docs/NUTSNEWS_FEED_VISIBILITY_FADE_FIX.md. Do not edit this wiki page directly. -->

> Source: `docs/NUTSNEWS_FEED_VISIBILITY_FADE_FIX.md`  
> Last generated: 2026-06-27T18:57:09.981Z

# NutsNews Feed Visibility Fade Fix

This patch fixes an issue where the home page banner could appear while the article feed stayed hidden after the page fade animation update.

## What changed

- Removed the page-wrapper fade animation from `.modern-home-shell` and `.public-themed-page`.
- Restored the prior safe theme/home-button CSS baseline so the article feed is never hidden by the global animation.
- Kept the existing theme system, home button, settings button, hero styling, cards, and public page theme styling unchanged.

## Files updated

- `web/app/globals.css`
