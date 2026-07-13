#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";

import {
  RuntimeSafetyError,
  assertSyntheticFixtureMutation,
} from "../web/runtimeSafety.mjs";
import { getLocalSupabaseStatus } from "./supabase_local.mjs";

const NAMESPACE_PATTERN = /^nutsnews-test-[a-z0-9][a-z0-9-]{5,96}$/;
const DEFAULT_TTL_MINUTES = 60;
const MIN_TTL_MINUTES = 1;
const MAX_TTL_MINUTES = 120;

function configuredSupabaseUrl(env) {
  return String(
    env.NUTSNEWS_SUPABASE_URL ??
      env.SUPABASE_URL ??
      env.NUTSNEWS_PUBLIC_SUPABASE_URL ??
      env.NEXT_PUBLIC_SUPABASE_URL ??
      "",
  ).replace(/\/+$/, "");
}

function configuredServiceRoleKey(env) {
  return String(env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
}

export function createFixtureNamespace(random = randomUUID, now = Date.now()) {
  return `nutsnews-test-${now.toString(36)}-${random().replaceAll("-", "").toLowerCase()}`;
}

export function assertFixtureNamespace(namespace) {
  if (!NAMESPACE_PATTERN.test(String(namespace ?? ""))) {
    throw new Error("Fixture namespace must be a unique nutsnews-test-* value.");
  }
  return namespace;
}

export function getFixtureExpiry({ now = Date.now(), ttlMinutes = DEFAULT_TTL_MINUTES } = {}) {
  const ttl = Number(ttlMinutes);
  if (!Number.isInteger(ttl) || ttl < MIN_TTL_MINUTES || ttl > MAX_TTL_MINUTES) {
    throw new Error(`Fixture TTL must be an integer between ${MIN_TTL_MINUTES} and ${MAX_TTL_MINUTES} minutes.`);
  }
  return new Date(now + ttl * 60_000).toISOString();
}

/**
 * Produce only synthetic, deterministic records. fixture.invalid guarantees
 * that a fixture cannot silently point at an external publisher or a dump.
 */
export function createFixtureRecords(namespace, expiresAt) {
  assertFixtureNamespace(namespace);
  const fixturePath = `https://fixture.invalid/${namespace}`;
  const articleUrl = `${fixturePath}/articles/seed`;
  const feedUrl = `${fixturePath}/feeds/seed.xml`;
  const userEmail = `fixture-${createHash("sha256").update(namespace).digest("hex").slice(0, 32)}@fixture.invalid`;
  const source = `Synthetic fixture ${namespace}`;

  return Object.freeze({
    run: { namespace, expires_at: expiresAt },
    article: {
      source,
      title: `Synthetic article for ${namespace}`,
      original_url: articleUrl,
      image_url: `${fixturePath}/images/seed.png`,
      published_at: "2026-01-01T00:00:00.000Z",
      published_on_site_at: "2026-01-01T00:00:00.000Z",
      original_excerpt: "Synthetic staging fixture only.",
      ai_summary: "A deterministic synthetic article used only to qualify the staging write path.",
      category: "Synthetic",
      positivity_score: 10,
      status: "published",
    },
    translations: [
      {
        original_url: articleUrl,
        language_code: "fr",
        source_language_code: "en",
        title: `Article synthétique ${namespace}`,
        summary: "Traduction synthétique déterministe réservée aux tests de staging.",
        generated_by: "fixture",
        model: "fixture-v1",
      },
      {
        original_url: articleUrl,
        language_code: "ja",
        source_language_code: "en",
        title: `合成記事 ${namespace}`,
        summary: "ステージング専用の決定的な合成翻訳です。",
        generated_by: "fixture",
        model: "fixture-v1",
      },
    ],
    feed: {
      source,
      url: feedUrl,
      is_positive_source: true,
      is_active: true,
    },
    writeEvent: {
      event_type: "staging_fixture",
      event_source: "issue_109",
      provider: "synthetic",
      quantity: 1,
      metadata: { fixture_namespace: namespace, expires_at: expiresAt, synthetic: true },
    },
    user: {
      email: userEmail,
      password: "synthetic-fixture-password-20260713000000",
      email_confirm: true,
      user_metadata: { fixture_namespace: namespace, expires_at: expiresAt, synthetic: true },
    },
  });
}

function createClient({ url, serviceRoleKey, fetchImpl = fetch }) {
  if (!url || !serviceRoleKey) {
    throw new Error("Staging fixture commands require isolated staging Supabase credentials.");
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function request(path, { method = "POST", body, prefer = "return=minimal" } = {}) {
    const response = await fetchImpl(`${url}${path}`, {
      method,
      headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      throw new Error(`Synthetic staging fixture request failed with HTTP ${response.status}.`);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  return Object.freeze({ request });
}

export async function resetStagingFixture(namespace, options) {
  assertFixtureNamespace(namespace);
  const client = createClient(options);
  return client.request("/rest/v1/rpc/nutsnews_reset_staging_fixture", {
    body: { p_namespace: namespace },
    prefer: "return=representation",
  });
}

export async function cleanupExpiredStagingFixtures(options) {
  const client = createClient(options);
  return client.request("/rest/v1/rpc/nutsnews_cleanup_expired_staging_fixtures", {
    body: {},
    prefer: "return=representation",
  });
}

async function deleteAuthUser(userId, options) {
  if (!userId) return;
  const client = createClient(options);
  await client.request(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    prefer: "",
  });
}

export async function seedStagingFixture(namespace, expiresAt, options) {
  assertFixtureNamespace(namespace);
  const records = createFixtureRecords(namespace, expiresAt);
  const client = createClient(options);
  let createdUserId = null;

  await cleanupExpiredStagingFixtures(options);
  await resetStagingFixture(namespace, options);

  try {
    await client.request("/rest/v1/staging_fixture_runs", { body: records.run });
    await client.request("/rest/v1/articles", { body: records.article });
    await client.request("/rest/v1/article_summaries", { body: records.translations });
    await client.request("/rest/v1/rss_feeds", { body: records.feed });
    await client.request("/rest/v1/quota_usage_events", { body: records.writeEvent });

    const createdUser = await client.request("/auth/v1/admin/users", {
      body: records.user,
      prefer: "return=representation",
    });
    createdUserId = createdUser?.id ?? createdUser?.user?.id ?? null;
    if (typeof createdUserId !== "string") {
      throw new Error("Synthetic staging fixture user did not return an identifier.");
    }

    await client.request("/rest/v1/staging_fixture_users", {
      body: { namespace, user_id: createdUserId },
    });
  } catch (error) {
    try {
      await deleteAuthUser(createdUserId, options);
      await resetStagingFixture(namespace, options);
    } catch {
      // The caller reports cleanup failure independently from the original failure.
    }
    throw error;
  }

  return records;
}

function parseCommand(argv) {
  const values = argv.slice(2);
  const command = values[0] ?? "exercise";
  const namespaceIndex = values.indexOf("--namespace");
  const ttlIndex = values.indexOf("--ttl-minutes");
  return {
    command,
    local: values.includes("--local"),
    namespace: namespaceIndex >= 0 ? values[namespaceIndex + 1] : "",
    ttlMinutes: ttlIndex >= 0 ? values[ttlIndex + 1] : DEFAULT_TTL_MINUTES,
  };
}

function fixtureOptionsFromEnvironment(env, local) {
  if (local) {
    const status = getLocalSupabaseStatus();
    return { url: status.apiUrl, serviceRoleKey: status.serviceRoleKey };
  }
  return { url: configuredSupabaseUrl(env), serviceRoleKey: configuredServiceRoleKey(env) };
}

export async function runStagingFixtureCommand({ argv = process.argv, env = process.env } = {}) {
  const parsed = parseCommand(argv);
  if (!new Set(["seed", "reset", "exercise", "cleanup"]).has(parsed.command)) {
    throw new Error("Fixture command must be seed, reset, exercise, or cleanup.");
  }

  const namespace = parsed.namespace || createFixtureNamespace();
  const expiresAt = getFixtureExpiry({ ttlMinutes: parsed.ttlMinutes });
  assertSyntheticFixtureMutation(namespace, env);
  const options = fixtureOptionsFromEnvironment(env, parsed.local);

  if (parsed.command === "reset") {
    await resetStagingFixture(namespace, options);
    return { command: "reset", namespace };
  }
  if (parsed.command === "cleanup") {
    await cleanupExpiredStagingFixtures(options);
    return { command: "cleanup", namespace };
  }

  let operationFailure = null;
  let cleanupFailure = null;
  try {
    await seedStagingFixture(namespace, expiresAt, options);
  } catch (error) {
    operationFailure = error;
  } finally {
    if (parsed.command === "exercise") {
      try {
        await resetStagingFixture(namespace, options);
      } catch (error) {
        cleanupFailure = error;
      }
    }
  }

  if (operationFailure) {
    throw new Error("Staging synthetic fixture operation failed.");
  }
  if (cleanupFailure) {
    throw new Error("Staging synthetic fixture cleanup failed and requires manual follow-up.");
  }

  return { command: parsed.command, namespace };
}

const invokedDirectly = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (invokedDirectly) {
  try {
    const result = await runStagingFixtureCommand();
    console.log(`Staging synthetic fixture ${result.command} succeeded.`);
  } catch (error) {
    if (error instanceof RuntimeSafetyError) {
      console.error(`Refusing staging fixture command: ${error.code}.`);
    } else {
      console.error(error instanceof Error ? error.message : "Staging synthetic fixture command failed.");
    }
    process.exitCode = 1;
  }
}
