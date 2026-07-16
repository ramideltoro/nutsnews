#!/usr/bin/env node

import assert from "node:assert/strict";

import { getLocalSupabaseStatus, runLocalSupabaseSql } from "./supabase_local.mjs";

const namespace = process.argv.find((arg) => arg.startsWith("--namespace="))?.split("=", 2)[1] ??
  `nutsnews-test-rls-${Date.now().toString(36)}`;

if (!/^nutsnews-test-[a-z0-9][a-z0-9-]{5,96}$/.test(namespace)) {
  throw new Error("RLS fixture namespace must be a synthetic nutsnews-test-* namespace.");
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function restRequest(status, key, path, { method = "GET", body } = {}) {
  const response = await fetch(`${status.apiUrl}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    json,
  };
}

function pathWithQuery(path, query) {
  const params = new URLSearchParams(query);
  return `${path}?${params.toString()}`;
}

function assertDeniedRead(response, message) {
  if (!response.ok) return;
  if (Array.isArray(response.json) && response.json.length === 0) return;
  assert.fail(message);
}

function assertDeniedWrite(response, message) {
  assert.equal(response.ok, false, message);
}

function seedFixture(status) {
  const prefix = `https://fixture.invalid/${namespace}`;
  const publishedUrl = `${prefix}/published`;
  const draftUrl = `${prefix}/draft`;
  const noImageUrl = `${prefix}/no-image`;

  const sql = `
    select public.nutsnews_reset_staging_fixture(${sqlLiteral(namespace)});

    insert into public.staging_fixture_runs (namespace, expires_at)
    values (${sqlLiteral(namespace)}, now() + interval '1 hour')
    on conflict (namespace) do update
    set expires_at = excluded.expires_at;

    insert into public.articles (
      source,
      title,
      original_url,
      image_url,
      published_at,
      original_excerpt,
      ai_summary,
      category,
      positivity_score,
      status
    )
    values
      (
        'rls-regression',
        'Published RLS fixture',
        ${sqlLiteral(publishedUrl)},
        ${sqlLiteral(`${prefix}/image.jpg`)},
        now(),
        'Published fixture excerpt',
        'Published fixture summary',
        'testing',
        90,
        'published'
      ),
      (
        'rls-regression',
        'Draft RLS fixture',
        ${sqlLiteral(draftUrl)},
        ${sqlLiteral(`${prefix}/draft-image.jpg`)},
        now(),
        'Draft fixture excerpt',
        'Draft fixture summary',
        'testing',
        10,
        'draft'
      ),
      (
        'rls-regression',
        'No-image RLS fixture',
        ${sqlLiteral(noImageUrl)},
        null,
        now(),
        'No-image fixture excerpt',
        'No-image fixture summary',
        'testing',
        50,
        'published'
      );

    insert into public.article_summaries (
      original_url,
      language_code,
      source_language_code,
      title,
      summary,
      generated_by,
      model
    )
    values
      (${sqlLiteral(publishedUrl)}, 'fr', 'en', 'Résumé publié', 'Résumé public autorisé.', 'rls-regression', 'fixture'),
      (${sqlLiteral(draftUrl)}, 'fr', 'en', 'Résumé brouillon', 'Résumé brouillon interdit.', 'rls-regression', 'fixture'),
      (${sqlLiteral(noImageUrl)}, 'fr', 'en', 'Résumé sans image', 'Résumé sans image interdit.', 'rls-regression', 'fixture');

    refresh materialized view public.public_feed_snapshot;
  `;

  runLocalSupabaseSql(status.databaseUrl, sql);

  return {
    draftUrl,
    noImageUrl,
    prefix,
    publishedUrl,
  };
}

function cleanupFixture(status) {
  runLocalSupabaseSql(status.databaseUrl, `select public.nutsnews_reset_staging_fixture(${sqlLiteral(namespace)});`);
}

const status = getLocalSupabaseStatus({ requireAnonKey: true });
const fixture = seedFixture(status);

try {
  const articleQuery = pathWithQuery("/rest/v1/articles", {
    select: "original_url,title,status,image_url,ai_summary",
    original_url: `like.${fixture.prefix}*`,
    order: "original_url.asc",
  });
  const anonArticles = await restRequest(status, status.anonKey, articleQuery);
  assert.equal(anonArticles.ok, true, "Anonymous readers must be able to query allowed public article rows.");
  assert.deepEqual(
    anonArticles.json.map((row) => row.original_url),
    [fixture.noImageUrl, fixture.publishedUrl],
    "Anonymous article reads must expose only published rows and hide draft rows.",
  );

  const summaryQuery = pathWithQuery("/rest/v1/article_summaries", {
    select: "original_url,language_code,title,summary",
    original_url: `like.${fixture.prefix}*`,
    order: "original_url.asc",
  });
  const anonSummaries = await restRequest(status, status.anonKey, summaryQuery);
  assert.equal(anonSummaries.ok, true, "Anonymous readers must be able to query allowed public summaries.");
  assert.deepEqual(
    anonSummaries.json.map((row) => row.original_url),
    [fixture.publishedUrl],
    "Anonymous summary reads must expose only summaries attached to published articles with images.",
  );

  const publicFeed = await restRequest(
    status,
    status.anonKey,
    pathWithQuery("/rest/v1/public_feed_snapshot", {
      select: "original_url,title",
      original_url: `like.${fixture.prefix}*`,
      order: "original_url.asc",
    }),
  );
  assert.equal(publicFeed.ok, true, "Anonymous readers must be able to query the public feed snapshot.");
  assert.deepEqual(
    publicFeed.json.map((row) => row.original_url),
    [fixture.publishedUrl],
    "The public feed snapshot must not expose draft rows or published rows without images.",
  );

  const mutation = await restRequest(status, status.anonKey, "/rest/v1/articles", {
    method: "POST",
    body: {
      source: "rls-regression",
      title: "Anonymous mutation must fail",
      original_url: `${fixture.prefix}/anon-mutation`,
      status: "published",
    },
  });
  assertDeniedWrite(mutation, "Anonymous users must not be able to insert article rows.");

  const featureFlags = await restRequest(
    status,
    status.anonKey,
    pathWithQuery("/rest/v1/runtime_feature_flags", { select: "key,enabled" }),
  );
  assertDeniedRead(featureFlags, "Anonymous users must not read runtime feature flags.");

  const stagingFixtures = await restRequest(
    status,
    status.anonKey,
    pathWithQuery("/rest/v1/staging_fixture_runs", { select: "namespace,expires_at" }),
  );
  assertDeniedRead(stagingFixtures, "Anonymous users must not read staging fixture namespaces.");

  const serviceFlags = await restRequest(
    status,
    status.serviceRoleKey,
    pathWithQuery("/rest/v1/runtime_feature_flags", { select: "key,enabled", order: "key.asc" }),
  );
  assert.equal(serviceFlags.ok, true, "Service-role access must remain available for approved server-side paths.");
  assert.ok(
    serviceFlags.json.some((row) => row.key === "reader_archive_search"),
    "Service-role feature flag reads must include approved runtime flags.",
  );

  const publicContract = await restRequest(status, status.anonKey, "/rest/v1/rpc/nutsnews_migration_schema_contract", {
    method: "POST",
    body: {},
  });
  assert.equal(publicContract.ok, true, "Anonymous schema-contract readiness RPC must remain readable.");

  const deniedReset = await restRequest(status, status.anonKey, "/rest/v1/rpc/nutsnews_reset_staging_fixture", {
    method: "POST",
    body: { p_namespace: namespace },
  });
  assertDeniedWrite(deniedReset, "Anonymous users must not execute privileged staging-fixture reset RPCs.");
} finally {
  cleanupFixture(status);
}

console.log(`Supabase RLS regression passed for synthetic namespace ${namespace}.`);
