import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProtectedTargetHeaders } from "../web/protectedTargetHeaders.mjs";

test("no protected-target env returns no extra headers", () => {
  const result = buildProtectedTargetHeaders({});
  assert.equal(result.extraHTTPHeaders, undefined);
  assert.equal(result.hasProtectedTargetHeaders, false);
});

test("Cloudflare Access service-token headers require complete pairs", () => {
  assert.throws(
    () => buildProtectedTargetHeaders({ CF_ACCESS_CLIENT_ID: "client-id" }),
    /provided together/,
  );
  assert.throws(
    () => buildProtectedTargetHeaders({ CF_ACCESS_CLIENT_SECRET: "client-secret" }),
    /provided together/,
  );
});

test("Cloudflare Access service-token headers can be required", () => {
  assert.throws(() => buildProtectedTargetHeaders({}, { requireCloudflareAccess: true }), /required/);
  assert.deepEqual(
    buildProtectedTargetHeaders(
      {
        CF_ACCESS_CLIENT_ID: "client-id",
        CF_ACCESS_CLIENT_SECRET: "client-secret",
      },
      { requireCloudflareAccess: true },
    ),
    {
      extraHTTPHeaders: {
        "CF-Access-Client-Id": "client-id",
        "CF-Access-Client-Secret": "client-secret",
      },
      hasProtectedTargetHeaders: true,
    },
  );
});

test("Vercel protection bypass headers support browser cookie setup", () => {
  assert.deepEqual(
    buildProtectedTargetHeaders(
      {
        VERCEL_AUTOMATION_BYPASS_SECRET: "vercel-secret",
      },
      { defaultVercelSetBypassCookie: true },
    ),
    {
      extraHTTPHeaders: {
        "x-vercel-protection-bypass": "vercel-secret",
        "x-vercel-set-bypass-cookie": "true",
      },
      hasProtectedTargetHeaders: true,
    },
  );
});

test("Vercel protection bypass cookie values fail closed", () => {
  assert.throws(
    () =>
      buildProtectedTargetHeaders({
        VERCEL_AUTOMATION_BYPASS_SECRET: "vercel-secret",
        VERCEL_SET_BYPASS_COOKIE: "invalid",
      }),
    /VERCEL_SET_BYPASS_COOKIE/,
  );
});
