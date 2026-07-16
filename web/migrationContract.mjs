// Issue #109. Keep this value equal to the latest filename in
// supabase/migrations/. scripts/migration_contract.mjs makes CI reject any
// mismatch, so an image cannot qualify against a stale migration head.
export const MIGRATION_HEAD = "20260716170000";

// This remains intentionally separate from MIGRATION_HEAD until the recorded
// last-known-good digest has left the rollback window. It is the marker read
// by pre-#109 app digests.
export const LEGACY_COMPATIBLE_SCHEMA_VERSION = "20260712170000";
