function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, received ${actual ?? "missing"}`);
  }
}

export function assertQualifiedReadinessBody(readiness, expected) {
  if (
    !readiness ||
    typeof readiness !== "object" ||
    readiness.ok !== true ||
    readiness.ready !== true ||
    readiness.service !== "nutsnews-web" ||
    readiness.code !== "ready"
  ) {
    throw new Error("Readiness endpoint did not return a qualified runtime response");
  }

  assertEqual(readiness.sourceCommit, expected.sourceCommit, "Readiness source commit");
  assertEqual(readiness.buildId, expected.buildId, "Readiness build ID");
  assertEqual(
    readiness.deploymentTarget,
    expected.deploymentTarget,
    "Readiness deployment target",
  );
  assertEqual(
    readiness.configGeneration,
    expected.configGeneration,
    "Readiness config generation",
  );
  assertEqual(
    readiness.databaseProviderMode,
    expected.databaseProviderMode,
    "Readiness database provider mode",
  );
}
