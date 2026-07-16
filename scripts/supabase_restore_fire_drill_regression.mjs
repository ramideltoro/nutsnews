#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");

const [backupWorkflow, backupScript, restoreScript, adminReadiness, packageJson] =
  await Promise.all([
    read(".github/workflows/supabase-backup.yml"),
    read("scripts/supabase_backup.mjs"),
    read("scripts/supabase_restore_fire_drill.mjs"),
    read("web/lib/adminProductionReadiness.ts"),
    read("web/package.json"),
  ]);

function requireText(text, fragment, message) {
  assert.ok(text.includes(fragment), message);
}

for (const fragment of [
  "SUPABASE_URL: ${{ vars.NUTSNEWS_PRODUCTION_SUPABASE_URL }}",
  "SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.NUTSNEWS_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY }}",
  "feed_health",
  "quota_usage_events",
  "runtime_feature_flags",
  "release_readiness",
  "supabase/setup-cli@v1",
  "sudo apt-get install --yes postgresql-client",
  "supabase start -x studio,imgproxy,logflare,vector",
  "supabase db reset --local",
  "node scripts/supabase_restore_fire_drill.mjs --backup-dir backups/supabase --local-supabase",
  "reports/supabase-restore/latest.md",
  "name: supabase-rest-backup",
  "name: supabase-restore-fire-drill-report",
  "supabase stop --no-backup",
]) {
  requireText(backupWorkflow, fragment, `Supabase backup workflow is missing ${fragment}.`);
}

for (const fragment of [
  "DEFAULT_BACKUP_TABLES",
  "feed_health",
  "quota_usage_events",
  "runtime_feature_flags",
  "release_readiness",
  "restoreFireDrillCommand",
  "sha256",
  "gzipByteSize",
]) {
  requireText(backupScript, fragment, `Supabase backup script is missing ${fragment}.`);
}

for (const fragment of [
  "DEFAULT_MAX_BACKUP_AGE_HOURS = 30",
  "DEFAULT_REQUIRED_NON_EMPTY_TABLES",
  "NUTSNEWS_RESTORE_FIRE_DRILL_ALLOW_REMOTE",
  "Refusing to run a restore fire drill against a non-local database URL.",
  "jsonb_populate_recordset",
  "supabase/restore_validation.sql",
  "reports/supabase-restore",
  "latest.md",
  "latest.json",
]) {
  requireText(restoreScript, fragment, `Restore fire drill script is missing ${fragment}.`);
}

for (const fragment of [
  "BACKUP_RESTORE_STALE_HOURS = 30",
  "BACKUP_RESTORE_WORKFLOW",
  ".github/workflows/supabase-backup.yml",
  "Backup restore fire drill",
  "restore report artifact",
  "ACTIONS_READ_TOKEN",
]) {
  requireText(adminReadiness, fragment, `Admin readiness backup signal is missing ${fragment}.`);
}

const parsedPackage = JSON.parse(packageJson);
assert.equal(
  parsedPackage.scripts?.["test:supabase-restore-fire-drill"],
  "node --test ../tests/supabase-restore-fire-drill.test.mjs",
  "web/package.json is missing test:supabase-restore-fire-drill.",
);

console.log("Supabase restore fire drill regression checks passed.");
