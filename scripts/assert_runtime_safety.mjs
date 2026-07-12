#!/usr/bin/env node

import { RuntimeSafetyError, assertProductionOperation } from "../web/runtimeSafety.mjs";

const operation = String(process.argv[2] ?? "script-operation").trim() || "script-operation";

try {
  assertProductionOperation(operation);
} catch (error) {
  if (error instanceof RuntimeSafetyError) {
    console.error(`Refusing ${operation}: ${error.code}.`);
    process.exit(1);
  }
  throw error;
}
