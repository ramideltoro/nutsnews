import fs from "node:fs";

const cacheHeaders = fs.readFileSync("web/lib/cacheHeaders.ts", "utf8");
const nextConfig = fs.readFileSync("web/next.config.ts", "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const cloudflarePolicy =
  "public, max-age=3600, stale-while-revalidate=86400";

assert(
  cacheHeaders.includes(
    `PUBLIC_CLOUDFLARE_CDN_CACHE_CONTROL =\n  "${cloudflarePolicy}"`,
  ),
  "shared cache headers must define the 1-hour Cloudflare policy",
);

assert(
  cacheHeaders.includes(
    '"Cloudflare-CDN-Cache-Control": PUBLIC_CLOUDFLARE_CDN_CACHE_CONTROL',
  ),
  "article API responses must use the Cloudflare-specific policy",
);

assert(
  nextConfig.includes(
    `PUBLIC_CLOUDFLARE_CDN_CACHE_CONTROL =\n  "${cloudflarePolicy}"`,
  ),
  "Next.js public routes must define the 1-hour Cloudflare policy",
);

assert(
  nextConfig.includes(
    'value: cloudflareCdnCacheControl',
  ),
  "public routes must emit the independent Cloudflare cache header",
);

assert(
  cacheHeaders.includes(
    '"public, max-age=60, s-maxage=900, stale-while-revalidate=3600"',
  ),
  "browser/shared page cache must remain at the existing shorter policy",
);

assert(
  cacheHeaders.includes(
    '"public, s-maxage=900, stale-while-revalidate=3600"',
  ),
  "generic/Vercel CDN policy must remain at 15 minutes",
);

assert(
  !cloudflarePolicy.includes("s-maxage="),
  "Cloudflare-specific policy must avoid s-maxage so stale-while-revalidate remains usable",
);

console.log("Cloudflare 1-hour cache regression safeguards passed.");
