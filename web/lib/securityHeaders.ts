export type SecurityHeaderOptions = {
  isDevelopment?: boolean;
};

function buildDirective(name: string, values: string[]) {
  return `${name} ${values.join(" ")}`;
}

export function buildContentSecurityPolicy(options: SecurityHeaderOptions = {}) {
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://challenges.cloudflare.com",
  ];

  const connectSources = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://analytics.google.com",
    "https://*.ingest.sentry.io",
    "https://*.ingest.us.sentry.io",
    "https://sentry.io",
    "https://challenges.cloudflare.com",
  ];

  if (options.isDevelopment) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push("http://localhost:*", "ws://localhost:*");
  }

  const directives = [
    buildDirective("default-src", ["'self'"]),
    buildDirective("base-uri", ["'self'"]),
    buildDirective("object-src", ["'none'"]),
    buildDirective("frame-ancestors", ["'none'"]),
    buildDirective("form-action", ["'self'"]),
    buildDirective("script-src", scriptSources),
    buildDirective("style-src", ["'self'", "'unsafe-inline'"]),
    buildDirective("img-src", ["'self'", "data:", "blob:", "https:"]),
    buildDirective("font-src", ["'self'", "data:"]),
    buildDirective("connect-src", connectSources),
    buildDirective("frame-src", ["https://challenges.cloudflare.com"]),
    buildDirective("worker-src", ["'self'", "blob:"]),
    buildDirective("manifest-src", ["'self'"]),
    buildDirective("media-src", ["'self'", "https:"]),
  ];

  if (!options.isDevelopment) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function getSecurityHeaders(options: SecurityHeaderOptions = {}) {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildContentSecurityPolicy(options),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), browsing-topics=(), fullscreen=(self)",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "on",
    "X-NutsNews-Security-Policy": "issue-106",
  };

  if (!options.isDevelopment) {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  }

  return headers;
}
