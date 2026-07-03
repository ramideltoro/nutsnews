import { readFileSync } from "node:fs";

const text = readFileSync("AGENTS.md", "utf8");

const requiredPhrases = [
  "Tests Are Untouchable",
  "APPROVED",
  "Every Change Needs a Test",
  "PRs Must Include Three Summaries and Release Notes",
  "Never Merge Pull Requests",
  "Do Not Ask for Frequent Confirmation",
  "Show Commands in Real Time",
  "avoidable cron failures",
  "avoidable Worker failures",
  "Never Compromise Professionalism"
];

const missing = requiredPhrases.filter((phrase) => !text.includes(phrase));

if (missing.length > 0) {
  console.error("AGENTS.md is missing required policy text:");
  for (const phrase of missing) {
    console.error(`- ${phrase}`);
  }
  process.exit(1);
}

console.log("AGENTS.md policy check passed.");
