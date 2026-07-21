#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const audit = resolve("scripts/main_ruleset_audit.mjs");

function validRuleset() {
  return [{
    name: "Require PRs and pre-merge gates on main",
    target: "branch",
    enforcement: "active",
    bypass_actors: [],
    conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      { type: "pull_request", parameters: { required_approving_review_count: 0 } },
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: [
            { context: "Release candidate", integration_id: 15368 },
            { context: "Pre-merge deployment gate", integration_id: 15368 },
          ],
        },
      },
    ],
  }];
}

function run(rulesets) {
  const dir = mkdtempSync(resolve(tmpdir(), "nutsnews-ruleset-audit-"));
  const path = resolve(dir, "rulesets.json");
  writeFileSync(path, `${JSON.stringify(rulesets)}\n`, "utf8");
  return () => execFileSync(process.execPath, [audit, "--rulesets-file", path], { encoding: "utf8", stdio: "pipe" });
}

assert.match(run(validRuleset())(), /Main ruleset audit passed/, "Valid main ruleset must pass.");

for (const [message, mutate] of [
  ["accurate ruleset name", (ruleset) => { ruleset[0].name = "No direct push to master"; }],
  ["active administrator enforcement", (ruleset) => { ruleset[0].enforcement = "evaluate"; }],
  ["main ref target", (ruleset) => { ruleset[0].conditions.ref_name.include = ["~DEFAULT_BRANCH"]; }],
  ["pull-request rule", (ruleset) => { ruleset[0].rules = ruleset[0].rules.filter((rule) => rule.type !== "pull_request"); }],
  ["Release candidate context", (ruleset) => { ruleset[0].rules[3].parameters.required_status_checks = ruleset[0].rules[3].parameters.required_status_checks.filter((check) => check.context !== "Release candidate"); }],
  ["Pre-merge deployment gate context", (ruleset) => { ruleset[0].rules[3].parameters.required_status_checks = ruleset[0].rules[3].parameters.required_status_checks.filter((check) => check.context !== "Pre-merge deployment gate"); }],
  ["Release candidate GitHub Actions integration", (ruleset) => { delete ruleset[0].rules[3].parameters.required_status_checks[0].integration_id; }],
  ["Pre-merge deployment gate GitHub Actions integration", (ruleset) => { delete ruleset[0].rules[3].parameters.required_status_checks[1].integration_id; }],
  ["administrator bypass", (ruleset) => { ruleset[0].bypass_actors = [{ actor_id: 1, actor_type: "RepositoryRole", bypass_mode: "always" }]; }],
  ["deletion protection", (ruleset) => { ruleset[0].rules = ruleset[0].rules.filter((rule) => rule.type !== "deletion"); }],
  ["non-fast-forward protection", (ruleset) => { ruleset[0].rules = ruleset[0].rules.filter((rule) => rule.type !== "non_fast_forward"); }],
  ["strict status policy", (ruleset) => { ruleset[0].rules[3].parameters.strict_required_status_checks_policy = false; }],
]) {
  const rulesets = validRuleset();
  mutate(rulesets);
  assert.throws(run(rulesets), undefined, `Audit must reject removed ${message}.`);
}

console.log("Main ruleset audit regression passed.");
