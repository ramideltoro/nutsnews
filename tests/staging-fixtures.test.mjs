import assert from "node:assert/strict";
import test from "node:test";

import {
  assertFixtureNamespace,
  cleanupExpiredStagingFixtures,
  createFixtureNamespace,
  createFixtureRecords,
  getFixtureExpiry,
  resetStagingFixture,
  seedStagingFixture,
} from "../scripts/staging_fixtures.mjs";

const namespace = "nutsnews-test-repeatable-fixture-123456";

test("synthetic fixture seed data is deterministic, namespaced, and has a bounded TTL", () => {
  const expiresAt = getFixtureExpiry({ now: 0, ttlMinutes: 60 });
  const first = createFixtureRecords(namespace, expiresAt);
  const second = createFixtureRecords(namespace, expiresAt);

  assert.deepEqual(first, second);
  assert.match(first.article.original_url, new RegExp(`^https://fixture\\.invalid/${namespace}/`));
  assert.match(first.feed.url, new RegExp(`^https://fixture\\.invalid/${namespace}/`));
  assert.match(first.user.email, /@fixture\.invalid$/);
  assert.equal(first.writeEvent.metadata.fixture_namespace, namespace);
  assert.equal(first.writeEvent.metadata.expires_at, expiresAt);
  assert.equal(first.translations.length, 2);
  assert.equal(first.writeEvent.metadata.synthetic, true);
});

test("fixture names must be isolated and fixture expiry cannot become unbounded", () => {
  assert.throws(() => assertFixtureNamespace("production-copy"), /nutsnews-test/);
  assert.throws(() => getFixtureExpiry({ ttlMinutes: 0 }), /between 1 and 120/);
  assert.throws(() => getFixtureExpiry({ ttlMinutes: 121 }), /between 1 and 120/);
  assert.equal(
    createFixtureNamespace(() => "ABCDEF12-3456-7890-abcd-ef1234567890", 123).startsWith("nutsnews-test-3f-"),
    true,
  );
});

test("seed and reset cover synthetic articles, translations, feeds, users, controlled writes, and TTL cleanup", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : null });
    if (String(url).endsWith("/auth/v1/admin/users") && init.method === "POST") {
      return new Response(JSON.stringify({ id: "11111111-1111-1111-1111-111111111111" }), { status: 201 });
    }
    return new Response("", { status: 201 });
  };
  const options = {
    url: "https://staging-fixture.test",
    serviceRoleKey: "synthetic-test-key",
    fetchImpl,
  };

  await seedStagingFixture(namespace, "2026-01-01T01:00:00.000Z", options);
  await resetStagingFixture(namespace, options);
  await cleanupExpiredStagingFixtures(options);

  const targets = calls.map(({ url }) => new URL(url).pathname);
  for (const target of [
    "/rest/v1/articles",
    "/rest/v1/article_summaries",
    "/rest/v1/rss_feeds",
    "/rest/v1/quota_usage_events",
    "/auth/v1/admin/users",
    "/rest/v1/staging_fixture_users",
    "/rest/v1/rpc/nutsnews_reset_staging_fixture",
    "/rest/v1/rpc/nutsnews_cleanup_expired_staging_fixtures",
  ]) {
    assert.ok(targets.includes(target), `missing fixture operation for ${target}`);
  }
  assert.ok(
    calls.some(({ body }) => body?.p_namespace === namespace),
    "fixture reset must be scoped to the unique namespace",
  );
});
