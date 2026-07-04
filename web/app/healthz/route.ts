export const dynamic = "force-static";
export const revalidate = 3600;

export function GET() {
  return Response.json(
    {
      ok: true,
      service: "nutsnews-web",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Cloudflare-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Vercel-CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "X-NutsNews-Cache-Policy": "public-healthz-cache-60s",
      },
    },
  );
}
