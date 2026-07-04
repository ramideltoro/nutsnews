#!/usr/bin/env node
import fs from "node:fs";

const guard = fs.readFileSync("scripts/immutable_all_tests_guard.mjs", "utf8");

for (const token of [
  'line.trim() === "APPROVED"',
  "New tests are allowed",
  "existsAtBase(filePath)",
  "isTestLikePath",
  'normalized.startsWith("tests/")',
  "check|assert|validate",
  "All-tests immutable guard failed",
]) {
  if (!guard.includes(token)) {
    throw new Error(`Immutable all-tests guard regression missing token: ${token}`);
  }
}

if (guard.includes("IMMUTABLE TEST CHANGE APPROVED BY RAMI")) {
  throw new Error("New all-tests guard must use the exact standalone APPROVED rule.");
}

console.log("Immutable all-tests guard regression passed.");
