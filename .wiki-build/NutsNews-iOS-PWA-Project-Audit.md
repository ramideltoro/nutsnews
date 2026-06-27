<!-- Auto-generated from reports/ios-pwa-project-4-audit.md. Do not edit this wiki page directly. -->

> Source: `reports/ios-pwa-project-4-audit.md`  
> Last generated: 2026-06-27T18:57:09.981Z

# NutsNews iOS PWA Project Audit

Project: https://github.com/users/ramideltoro/projects/4/views/1

Generated: 2026-06-15T21:32:57Z

---

## Project Issues

### 1. #49 - Define iOS PWA launch scope and acceptance criteria
Ï
- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/49
- Labels: priority:high, area:pwa, platform:ios-pwa, type:task

#### Body

## Goal
Define exactly what the first NutsNews iOS PWA launch needs to include.

## Tasks
- [ ] Define MVP PWA scope
- [ ] Decide what is required for launch vs backlog
- [ ] Define supported devices
- [ ] Define install flow
- [ ] Define QA checklist
- [ ] Define success metrics

## Acceptance criteria
- [ ] PWA launch requirements are clear
- [ ] Out-of-scope items are listed
- [ ] QA checklist exists
- [ ] Release can be tracked from this milestone

---

### 2. #50 - Add web app manifest for NutsNews PWA

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/50
- Labels: type:feature, area:web, priority:high, area:pwa, platform:ios-pwa

#### Body

## Goal
Add a production-ready web app manifest.

## Tasks
- [ ] Create or update manifest file
- [ ] Set app name to NutsNews
- [ ] Set short name
- [ ] Set start URL
- [ ] Set display mode
- [ ] Set theme color
- [ ] Set background color
- [ ] Register manifest in Next.js metadata/head

## Acceptance criteria
- [ ] Browser detects manifest
- [ ] iOS add-to-home-screen uses NutsNews branding
- [ ] Lighthouse PWA audit detects the manifest

---

### 3. #51 - Create iOS app icons and maskable icons

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/51
- Labels: priority:high, area:pwa, area:design, platform:ios-pwa, type:task

#### Body

## Goal
Create all icons needed for a polished installable app experience.

## Tasks
- [ ] Create 180x180 Apple touch icon
- [ ] Create 192x192 icon
- [ ] Create 512x512 icon
- [ ] Create maskable icon if needed
- [ ] Confirm icon uses NutsNews nut/amber theme
- [ ] Add icons to public assets
- [ ] Reference icons from manifest and metadata

## Acceptance criteria
- [ ] Home screen icon looks correct on iPhone
- [ ] Icon is not blurry
- [ ] Icon has correct safe padding
- [ ] Icon matches NutsNews brand

---

### 4. #52 - Add iOS Apple mobile web app meta tags

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/52
- Labels: area:web, priority:high, area:pwa, area:ios, platform:ios-pwa, type:task

#### Body

## Goal
Add iOS-specific metadata so NutsNews behaves like an app when launched from the home screen.

## Tasks
- [ ] Add apple-mobile-web-app-capable
- [ ] Add apple-mobile-web-app-title
- [ ] Add apple-mobile-web-app-status-bar-style
- [ ] Add apple-touch-icon links
- [ ] Confirm metadata does not break SEO
- [ ] Confirm metadata works with Next.js app router

## Acceptance criteria
- [ ] NutsNews opens from home screen with app-style behavior
- [ ] Status bar looks good with dark/amber theme
- [ ] App title displays correctly

---

### 5. #53 - Create iOS splash screens and startup image strategy

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/53
- Labels: priority:medium, area:pwa, area:ios, area:design, platform:ios-pwa, type:task

#### Body

## Goal
Decide and implement the iOS splash/startup experience.

## Tasks
- [ ] Decide whether static startup images are needed
- [ ] Create splash assets if required
- [ ] Match splash color to NutsNews dark/amber theme
- [ ] Test on iPhone sizes
- [ ] Document any iOS limitations

## Acceptance criteria
- [ ] App launch looks polished
- [ ] No white flash if avoidable
- [ ] Startup screen matches brand

---

### 6. #54 - Add offline fallback page

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/54
- Labels: type:feature, area:web, priority:high, area:pwa, platform:ios-pwa

#### Body

## Goal
Show a friendly NutsNews offline page when the user is offline.

## Tasks
- [ ] Create offline route/page
- [ ] Match existing dark/amber theme
- [ ] Explain that new stories need internet
- [ ] Link back to home
- [ ] Add service worker routing to offline fallback

## Acceptance criteria
- [ ] Offline users see a branded fallback
- [ ] No ugly browser error page
- [ ] Offline page works after app install

---

### 7. #55 - Add service worker app shell caching

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/55
- Labels: type:feature, area:web, area:performance, priority:high, area:pwa, platform:ios-pwa

#### Body

## Goal
Cache the app shell so the installed PWA loads quickly and has basic offline support.

## Tasks
- [ ] Add service worker
- [ ] Cache app shell assets
- [ ] Cache offline fallback page
- [ ] Avoid caching admin routes
- [ ] Avoid caching auth routes
- [ ] Avoid stale article data problems
- [ ] Document cache strategy

## Acceptance criteria
- [ ] Installed app shell opens quickly
- [ ] Offline fallback works
- [ ] Admin/auth routes are not cached incorrectly
- [ ] Public feed still respects freshness expectations

---

### 8. #56 - Add install instructions for iPhone users

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/56
- Labels: type:feature, area:web, priority:high, area:pwa, area:ios, platform:ios-pwa

#### Body

## Goal
Guide users through installing NutsNews on iPhone.

## Tasks
- [ ] Add install/help page or install card
- [ ] Explain Safari share button flow
- [ ] Explain Add to Home Screen
- [ ] Include screenshots later if needed
- [ ] Keep copy short and friendly
- [ ] Hide or soften install prompt when already installed if possible

## Acceptance criteria
- [ ] iPhone user can follow instructions
- [ ] Install flow is easy to understand
- [ ] Page matches NutsNews style

---

### 9. #57 - Improve mobile app shell layout for installed mode

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/57
- Labels: area:web, priority:high, area:pwa, area:ios, area:design, platform:ios-pwa, type:task

#### Body

## Goal
Make NutsNews feel more like a real app when launched from the iOS home screen.

## Tasks
- [ ] Review spacing in standalone display mode
- [ ] Handle safe area insets
- [ ] Confirm sticky/footer behavior
- [ ] Confirm scroll behavior
- [ ] Confirm no browser-only UI assumptions
- [ ] Confirm article cards feel native on iPhone

## Acceptance criteria
- [ ] Installed PWA feels polished
- [ ] No content is hidden behind notch/home indicator
- [ ] Feed scroll feels smooth

---

### 10. #58 - Add iOS safe-area CSS support

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/58
- Labels: area:web, priority:medium, area:pwa, area:ios, platform:ios-pwa, type:task

#### Body

## Goal
Make the UI work correctly around iPhone notch, Dynamic Island, and home indicator areas.

## Tasks
- [ ] Add env(safe-area-inset-top) support where needed
- [ ] Add env(safe-area-inset-bottom) support where needed
- [ ] Test footer and sticky UI
- [ ] Test portrait orientation
- [ ] Test landscape orientation if supported

## Acceptance criteria
- [ ] No important UI is clipped
- [ ] App looks good on modern iPhones
- [ ] App remains usable in installed mode

---

### 11. #59 - Add PWA install detection and app-mode polish

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/59
- Labels: type:feature, area:web, priority:medium, area:pwa, platform:ios-pwa

#### Body

## Goal
Detect when NutsNews is running as an installed PWA and adjust UI messaging.

## Tasks
- [ ] Detect standalone display mode where supported
- [ ] Avoid showing install instructions inside installed app
- [ ] Optionally add subtle installed-app polish
- [ ] Document limitations

## Acceptance criteria
- [ ] Install prompts are not annoying
- [ ] Installed experience feels intentional

---

### 12. #60 - Add Web Share support for article cards

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/60
- Labels: type:feature, area:web, priority:medium, area:pwa, platform:ios-pwa

#### Body

## Goal
Let users share uplifting stories using the native iOS share sheet where available.

## Tasks
- [ ] Add share action to article cards or article pages
- [ ] Use Web Share API when available
- [ ] Fallback to copy link
- [ ] Track share event if analytics is available
- [ ] Keep UI clean and mobile friendly

## Acceptance criteria
- [ ] Share works on iPhone Safari/PWA
- [ ] Fallback works on unsupported browsers
- [ ] Article URLs are correct

---

### 13. #61 - Evaluate iOS web push notifications

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/61
- Labels: priority:low, area:pwa, area:ios, platform:ios-pwa, type:task

#### Body

## Goal
Decide whether NutsNews should support push notifications for new uplifting stories.

## Tasks
- [ ] Review iOS PWA push support requirements
- [ ] Decide if notifications are part of MVP
- [ ] Define opt-in copy
- [ ] Define notification frequency
- [ ] Consider user trust and calm-news positioning
- [ ] Create follow-up implementation issue if needed

## Acceptance criteria
- [ ] Clear yes/no decision for MVP
- [ ] If yes, implementation plan exists
- [ ] If no, backlog item exists

---

### 14. #62 - Add installed PWA analytics events

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/62
- Labels: area:observability, priority:medium, area:pwa, platform:ios-pwa, type:task

#### Body

## Goal
Understand whether users install and use the PWA.

## Tasks
- [ ] Track visits to install page
- [ ] Track install CTA clicks where possible
- [ ] Track standalone/app-mode sessions where possible
- [ ] Track article reads from installed app
- [ ] Keep analytics privacy-friendly

## Acceptance criteria
- [ ] Basic PWA usage can be measured
- [ ] Data helps decide next mobile investments

---

### 15. #63 - Add Sentry context for PWA mode

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/63
- Labels: area:observability, priority:medium, area:pwa, platform:ios-pwa, type:task

#### Body

## Goal
Make PWA-specific bugs easier to debug.

## Tasks
- [ ] Add standalone/app-mode context where possible
- [ ] Add browser/device context
- [ ] Confirm errors from installed mode reach Sentry
- [ ] Document known iOS limitations

## Acceptance criteria
- [ ] PWA errors can be distinguished from normal browser errors
- [ ] Debugging installed app issues is easier

---

### 16. #64 - Validate CDN and cache behavior for PWA assets

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/64
- Labels: area:web, area:performance, priority:high, area:pwa, platform:ios-pwa, type:qa

#### Body

## Goal
Make sure PWA assets are cached correctly without breaking updates.

## Tasks
- [ ] Check manifest cache headers
- [ ] Check icon cache headers
- [ ] Check service worker cache headers
- [ ] Check offline page cache behavior
- [ ] Confirm new deploys update safely
- [ ] Confirm Cloudflare does not cache admin/auth routes

## Acceptance criteria
- [ ] PWA assets load quickly
- [ ] Updates are not stuck forever
- [ ] Public app shell caching is safe

---

### 17. #65 - Run Lighthouse PWA audit

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/65
- Labels: area:web, area:performance, priority:high, area:pwa, platform:ios-pwa, type:qa

#### Body

## Goal
Use Lighthouse to catch missing PWA requirements and performance regressions.

## Tasks
- [ ] Run Lighthouse mobile audit
- [ ] Review PWA category
- [ ] Review performance category
- [ ] Fix critical PWA misses
- [ ] Save results or summary in the issue

## Acceptance criteria
- [ ] PWA audit passes key checks
- [ ] Performance remains acceptable
- [ ] Any remaining limitations are documented

---

### 18. #66 - Test install flow on real iPhone

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/66
- Labels: priority:high, area:pwa, area:ios, platform:ios-pwa, type:qa

#### Body

## Goal
Confirm NutsNews can be installed and used from a real iPhone home screen.

## Tasks
- [ ] Open site in Safari
- [ ] Use Share button
- [ ] Add to Home Screen
- [ ] Launch from icon
- [ ] Check app title
- [ ] Check icon
- [ ] Check status bar
- [ ] Check feed scrolling
- [ ] Check article links
- [ ] Check offline fallback

## Acceptance criteria
- [ ] Install works on iPhone
- [ ] App launches correctly
- [ ] Feed and article links work
- [ ] Offline behavior is acceptable

---

### 19. #67 - Test installed PWA on iPad

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/67
- Labels: priority:medium, area:pwa, area:ios, platform:ios-pwa, type:qa

#### Body

## Goal
Confirm the installed PWA works well on iPad.

## Tasks
- [ ] Install from Safari on iPad
- [ ] Test portrait layout
- [ ] Test landscape layout
- [ ] Check card width and spacing
- [ ] Check scrolling
- [ ] Check share links
- [ ] Check offline fallback

## Acceptance criteria
- [ ] iPad layout is usable
- [ ] No major spacing or overflow issues
- [ ] Installed app launches correctly

---

### 20. #68 - Create PWA QA checklist

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/68
- Labels: type:docs, priority:medium, area:pwa, area:documentation, platform:ios-pwa

#### Body

## Goal
Create a repeatable checklist for testing the iOS PWA before each release.

## Tasks
- [ ] Add QA checklist to docs
- [ ] Include install flow
- [ ] Include app shell
- [ ] Include offline
- [ ] Include cache update behavior
- [ ] Include iPhone/iPad checks
- [ ] Include rollback notes

## Acceptance criteria
- [ ] QA can be repeated before future releases
- [ ] Checklist is linked from README or docs index

---

### 21. #69 - Document iOS PWA implementation and operations

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/69
- Labels: type:docs, priority:medium, area:pwa, area:documentation, platform:ios-pwa

#### Body

## Goal
Document how the NutsNews iOS PWA works and how to maintain it.

## Tasks
- [ ] Document manifest
- [ ] Document icons
- [ ] Document service worker
- [ ] Document cache strategy
- [ ] Document iOS install flow
- [ ] Document troubleshooting
- [ ] Update README/docs index

## Acceptance criteria
- [ ] Future maintenance is clear
- [ ] Operators know how to test the PWA
- [ ] Troubleshooting steps exist

---

### 22. #70 - Decide whether to build native wrapper later

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/70
- Labels: priority:low, area:pwa, area:ios, platform:ios-pwa, type:task

#### Body

## Goal
Decide whether NutsNews should stay PWA-only or eventually use a wrapper like Capacitor for App Store release.

## Tasks
- [ ] Compare PWA-only vs native wrapper
- [ ] List App Store pros and cons
- [ ] List maintenance cost
- [ ] Decide if wrapper is needed after PWA MVP
- [ ] Create future issue if needed

## Acceptance criteria
- [ ] Clear decision recorded
- [ ] No native work blocks PWA launch

---

### 23. #71 - Prepare PWA release announcement and feedback loop

- State: OPEN
- URL: https://github.com/ramideltoro/nutsnews/issues/71
- Labels: priority:low, area:pwa, area:documentation, platform:ios-pwa, type:task

#### Body

## Goal
Prepare a simple launch message and feedback path for the iOS PWA.

## Tasks
- [ ] Write short announcement copy
- [ ] Explain how to install on iPhone
- [ ] Add feedback route or contact path
- [ ] Track common issues
- [ ] Decide launch date after QA

## Acceptance criteria
- [ ] Users know how to install
- [ ] Feedback can be collected
- [ ] Launch messaging is ready

---


## Coverage Checklist

Use this checklist to confirm the board covers the full iOS PWA implementation:

- [ ] PWA manifest
- [ ] iOS app icons
- [ ] Apple mobile web app meta tags
- [ ] Splash/startup strategy
- [ ] Offline fallback page
- [ ] Service worker/app shell caching
- [ ] Service worker update/version strategy
- [ ] Service worker rollback/safety plan
- [ ] iPhone install instructions
- [ ] Homepage install CTA
- [ ] Installed-mode detection
- [ ] iPhone safe-area support
- [ ] iPhone real-device QA
- [ ] iPad real-device QA
- [ ] Web Share support
- [ ] PWA analytics
- [ ] Sentry PWA context
- [ ] CDN/cache validation
- [ ] Lighthouse PWA audit
- [ ] Privacy policy link/page
- [ ] Production PWA smoke test script
- [ ] PWA documentation
- [ ] Final launch checklist
