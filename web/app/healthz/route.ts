export const dynamic = "force-static";
export const revalidate = 3600;

function identityValue(fallback: string, ...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = value?.trim();

    if (normalized && /^[A-Za-z0-9._:@/-]+$/.test(normalized)) {
      return normalized.slice(0, 128);
    }
  }

  return fallback;
}

const sourceCommit = identityValue(
  "unknown",
  process.env.NUTSNEWS_SOURCE_COMMIT,
  process.env.NEXT_PUBLIC_NUTSNEWS_SOURCE_COMMIT,
  process.env.VERCEL_GIT_COMMIT_SHA,
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
);

const buildId = identityValue(
  sourceCommit,
  process.env.NUTSNEWS_BUILD_ID,
  process.env.NEXT_PUBLIC_NUTSNEWS_BUILD_ID,
);

const deploymentTarget = identityValue(
  process.env.VERCEL === "1" ? "vercel" : "unknown",
  process.env.NUTSNEWS_DEPLOYMENT_TARGET,
  process.env.VERCEL_ENV ? `vercel-${process.env.VERCEL_ENV}` : undefined,
);

export function GET() {
  return Response.json(
    {
      ok: true,
      service: "nutsnews-web",
      sourceCommit,
      buildId,
      deploymentTarget,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Cloudflare-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "X-NutsNews-Cache-Policy": "public-healthz-cache-60s",
        "X-NutsNews-Source-Commit": sourceCommit,
        "X-NutsNews-Build-Id": buildId,
        "X-NutsNews-Deployment-Target": deploymentTarget,
      },
    },
  );
}
