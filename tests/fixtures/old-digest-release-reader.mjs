// Snapshot of the pre-#109 /readyz schema reader. It intentionally reads only
// the legacy marker, which makes this an executable expand/contract test.
export function readLegacySchemaVersion(row) {
  if (!row || typeof row.schema_version !== "string") {
    throw new Error("Legacy release schema marker is unavailable.");
  }
  return row.schema_version;
}
