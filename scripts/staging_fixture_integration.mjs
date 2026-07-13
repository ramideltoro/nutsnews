#!/usr/bin/env node

import { runStagingFixtureCommand } from "./staging_fixtures.mjs";

if (process.env.RUN_STAGING_FIXTURE_INTEGRATION !== "1") {
  console.log("Staging fixture integration skipped; set RUN_STAGING_FIXTURE_INTEGRATION=1 to run it.");
  process.exit(0);
}

try {
  await runStagingFixtureCommand({
    argv: [process.argv[0], process.argv[1], "exercise", ...process.argv.slice(2)],
  });
  console.log("Staging synthetic fixture exercise succeeded.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Staging synthetic fixture integration failed.");
  process.exitCode = 1;
}
