#!/usr/bin/env node
import fs from "node:fs";

const guard = fs.readFileSync("scripts/immutable_all_tests_guard.mjs", "utf8");

for (const token of [
  "New tests are allowed",
  "existsAtBase(filePath)",
  "isTestLikePath",
  'normalized.startsWith("tests/")',
  "check|assert|validate",
  "All-tests immutable guard notice",
  "Manual APPROVED lines are no longer required",
]) {
  if (!guard.includes(token)) {
    throw new Error(`Immutable all-tests guard regression missing token: ${token}`);
  }
}

for (const forbiddenToken of [
  'line.trim() === "APPROVED"',
  "IMMUTABLE TEST CHANGE APPROVED BY RAMI",
  "process.exit(1)",
]) {
  if (guard.includes(forbiddenToken)) {
    throw new Error(`All-tests guard must not require manual approval token: ${forbiddenToken}`);
  }
}

console.log("Immutable all-tests guard regression passed.");
