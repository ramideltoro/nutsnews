import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(source, fragment, label) {
  assert.match(
    source,
    new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `${label} must include ${fragment}`,
  );
}

const migration = read("supabase/migrations/20260716180000_create_admin_audit_events.sql");
const auditLib = read("web/lib/adminAuditLog.ts");
const auditPage = read("web/app/admin/(protected)/audit/page.tsx");
const feedsPage = read("web/app/admin/(protected)/feeds/page.tsx");
const feedManagement = read("web/lib/adminFeedManagement.ts");
const adminHome = read("web/app/admin/(protected)/page.tsx");
const packageJson = JSON.parse(read("web/package.json"));

for (const fragment of [
  "create table if not exists public.admin_audit_events",
  "actor_email text not null",
  "before_values jsonb not null",
  "after_values jsonb not null",
  "metadata jsonb not null",
  "alter table public.admin_audit_events enable row level security",
  "revoke all on table public.admin_audit_events from anon, authenticated",
  "grant select, insert on table public.admin_audit_events to service_role",
  "create or replace function public.set_rss_feed_active_with_audit",
  "for update",
  "insert into public.admin_audit_events",
  "revoke all on function public.set_rss_feed_active_with_audit(text, text, boolean) from public, anon, authenticated",
  "grant execute on function public.set_rss_feed_active_with_audit(text, text, boolean) to service_role",
  "select public.nutsnews_record_migration_head('20260716180000')",
]) {
  assertIncludes(migration, fragment, "admin audit migration");
}

for (const fragment of [
  "cache: \"no-store\"",
  "/rest/v1/admin_audit_events",
  "NUTSNEWS_ADMIN_AUDIT_RETENTION_DAYS",
  "MAX_AUDIT_EVENTS",
  "actorEmail",
  "beforeValues",
  "afterValues",
]) {
  assertIncludes(auditLib, fragment, "admin audit library");
}

for (const fragment of [
  "export const dynamic = \"force-dynamic\"",
  "export const runtime = \"nodejs\"",
  "getAdminAuditLogData",
  "Audit Log",
  "before/after values",
]) {
  assertIncludes(auditPage, fragment, "admin audit page");
}

for (const fragment of [
  "const session = await auth()",
  "isAllowedAdminEmail(actorEmail)",
  "actorEmail",
  "setAdminRssFeedActiveStatus",
  "revalidatePath(\"/admin/audit\")",
]) {
  assertIncludes(feedsPage, fragment, "feed management server action");
}

for (const fragment of [
  "/rest/v1/rpc/set_rss_feed_active_with_audit",
  "p_actor_email",
  "p_feed_url",
  "p_is_active",
  "audit_event_id",
]) {
  assertIncludes(feedManagement, fragment, "feed management mutation path");
}

assertIncludes(adminHome, "href=\"/admin/audit\"", "admin home");
assertIncludes(adminHome, "Audit Log", "admin home");

assert.equal(
  packageJson.scripts?.["test:admin-audit-log"],
  "node ../scripts/admin_audit_log_regression.mjs",
  "web/package.json is missing test:admin-audit-log",
);

console.log("Admin audit log regression checks passed.");
