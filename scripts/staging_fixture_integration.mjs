#!/usr/bin/env node

import { randomUUID } from "node:crypto";

import {
  RuntimeSafetyError,
  assertSyntheticFixtureMutation,
} from "../web/runtimeSafety.mjs";

if (process.env.RUN_STAGING_FIXTURE_INTEGRATION !== "1") {
  console.log("Staging fixture integration skipped; set RUN_STAGING_FIXTURE_INTEGRATION=1 to run it.");
  process.exit(0);
}

const namespace = `nutsnews-test-${Date.now().toString(36)}-${randomUUID().replaceAll("-", "")}`;
const url = String(
  process.env.NUTSNEWS_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.NUTSNEWS_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "",
).replace(/\/+$/, "");
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const fixtureTtl = new Date(Date.now() + 60 * 60 * 1000).toISOString();

try {
  assertSyntheticFixtureMutation(namespace);
} catch (error) {
  if (error instanceof RuntimeSafetyError) {
    console.error(`Refusing staging fixture integration: ${error.code}.`);
    process.exit(1);
  }
  throw error;
}

if (!url || !serviceRoleKey) {
  console.error("Staging fixture integration requires staging Supabase URL and service-role credentials.");
  process.exit(1);
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

let fixtureId = null;
let operationFailure = null;
let cleanupFailure = null;

try {
  const createResponse = await fetch(`${url}/rest/v1/quota_usage_events`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      event_type: "staging_fixture",
      event_source: "issue_117",
      provider: "synthetic",
      quantity: 1,
      metadata: {
        fixture_namespace: namespace,
        expires_at: fixtureTtl,
      },
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Synthetic fixture write returned HTTP ${createResponse.status}.`);
  }

  const created = await createResponse.json();
  fixtureId = Array.isArray(created) ? created[0]?.id : null;
  if (!fixtureId) {
    throw new Error("Synthetic fixture write did not return an identifier.");
  }

  console.log("Staging synthetic fixture write succeeded.");
} catch (error) {
  operationFailure = error;
} finally {
  if (fixtureId !== null) {
    try {
      const cleanupResponse = await fetch(
        `${url}/rest/v1/quota_usage_events?id=eq.${encodeURIComponent(String(fixtureId))}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!cleanupResponse.ok) {
        throw new Error(`Synthetic fixture cleanup returned HTTP ${cleanupResponse.status}.`);
      }
      console.log("Staging synthetic fixture cleanup succeeded.");
    } catch (error) {
      cleanupFailure = error;
    }
  }
}

if (operationFailure) {
  console.error("Staging synthetic fixture integration failed.");
}
if (cleanupFailure) {
  console.error("Staging synthetic fixture cleanup failed and requires manual follow-up.");
}
if (operationFailure || cleanupFailure) {
  process.exit(1);
}
