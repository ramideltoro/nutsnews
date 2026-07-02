# Security Hardening

Issue #106 adds a focused security pass for the NutsNews web app.

## What changed

This update adds:

- centralized browser security headers
- Content Security Policy
- no-store behavior for admin and operational routes
- noindex behavior for admin routes
- stronger admin route auth boundaries
- contact form origin, size, rate-limit, timeout, honeypot, and Turnstile controls
- a repeatable security header script in Web CI

## Security headers

Security headers live in `web/lib/securityHeaders.ts`.

They are applied from `web/middleware.ts`.

The baseline includes:

| Header | Purpose |
| --- | --- |
| `Content-Security-Policy` | Restricts scripts, styles, images, frames, connections, and form submissions. |
| `X-Frame-Options` | Blocks legacy framing and clickjacking attempts. |
| `X-Content-Type-Options` | Prevents MIME sniffing. |
| `Referrer-Policy` | Limits referrer leakage. |
| `Permissions-Policy` | Disables unused browser features such as camera, microphone, geolocation, payment, USB, and display capture. |
| `Strict-Transport-Security` | Requires HTTPS in production. |
| `Cross-Origin-Opener-Policy` | Uses `same-origin-allow-popups` so OAuth popups can keep working. |
| `Cross-Origin-Resource-Policy` | Protects same-origin resources. |

## CSP policy

The CSP is intentionally narrow while allowing NutsNews dependencies:

| Directive | Allowed use |
| --- | --- |
| `script-src` | App scripts, Google Analytics/Tag Manager, and Cloudflare Turnstile. |
| `style-src` | App styles and inline styles required by the current UI. |
| `img-src` | App images, data/blob images, and HTTPS publisher thumbnails. |
| `connect-src` | App APIs, Supabase, Sentry, Google Analytics, and Turnstile. |
| `frame-src` | Cloudflare Turnstile challenge frames only. |
| `frame-ancestors` | `none`, so NutsNews cannot be embedded by another site. |
| `object-src` | `none`. |
| `base-uri` | `self`. |
| `form-action` | `self`. |

Publisher thumbnails come from many original article sources, so `img-src` allows HTTPS images broadly. Script, frame, and connection sources stay limited to known services.

## Admin route protection

Protected admin pages live under `web/app/admin/(protected)`.

The protected layout checks:

1. the user has a session
2. the session has an email
3. the email is allowed by `ADMIN_EMAILS`

Admin pages are forced dynamic and disable revalidation. Middleware also sends no-store cache headers for `/admin` routes and adds `X-Robots-Tag: noindex, nofollow, noarchive`.

## Contact form protection

The contact API lives at `web/app/api/contact/route.ts`.

Controls include:

- JSON-only requests
- actual request body size limit
- email validation
- message length limits
- honeypot field
- same-origin checks with optional `NUTSNEWS_ALLOWED_CONTACT_ORIGINS`
- per-IP/per-email in-memory rate limiting
- Turnstile token length limit
- Turnstile server-side Siteverify call
- request timeout for Turnstile
- request timeout for Resend
- no-store response headers

Turnstile secrets stay server-side. The browser sends a token, and the server validates it before sending email.

## Validation

Run locally:

`cd web && npm run test:security-headers`

The same check runs in `.github/workflows/web-ci.yml` before build.
