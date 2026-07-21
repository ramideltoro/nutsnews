#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repository = process.env.GITHUB_REPOSITORY || "ramideltoro/nutsnews";
const token = process.env.NUTSNEWS_RULESET_AUDIT_TOKEN || "";
const fixtureIndex = process.argv.indexOf("--rulesets-file");
const fixturePath = fixtureIndex === -1 ? "" : process.argv[fixtureIndex + 1] || "";
const requiredStatusCheckContexts = ["Merge Gate"];
const forbiddenStatusCheckContexts = ["Pre-merge deployment gate", "Release candidate"];

function rule(ruleset, type) {
  return (ruleset.rules || []).find((candidate) => candidate.type === type);
}

function validate(rulesets) {
  assert.ok(Array.isArray(rulesets), "GitHub rulesets response must be an array.");
  const mainRulesets = rulesets.filter(
    (ruleset) =>
      ruleset.target === "branch" &&
      ruleset.conditions?.ref_name?.include?.includes("refs/heads/main"),
  );

  assert.equal(mainRulesets.length, 1, "Expected exactly one ruleset targeting refs/heads/main.");
  const main = mainRulesets[0];
  assert.equal(main.name, "Require PRs and Merge Gate on main", "Main ruleset name is inaccurate.");
  assert.equal(main.enforcement, "active", "Main ruleset must be actively enforced for administrators.");
  assert.deepEqual(main.bypass_actors || [], [], "Main ruleset must not allow bypass actors.");
  assert.ok(rule(main, "deletion"), "Main ruleset must prevent branch deletion.");
  assert.ok(rule(main, "non_fast_forward"), "Main ruleset must prevent non-fast-forward updates.");

  const pullRequest = rule(main, "pull_request");
  assert.ok(pullRequest, "Main ruleset must require pull requests.");
  assert.equal(
    pullRequest.parameters?.required_approving_review_count,
    0,
    "Solo-maintainer main protection must require a PR without an impossible external approval loop.",
  );

  const statusChecks = rule(main, "required_status_checks");
  assert.ok(statusChecks, "Main ruleset must require status checks.");
  assert.equal(
    statusChecks.parameters?.strict_required_status_checks_policy,
    true,
    "Main ruleset must require an up-to-date branch before merge.",
  );
  const required = statusChecks.parameters?.required_status_checks || [];
  for (const context of requiredStatusCheckContexts) {
    const matches = required.filter((check) => check.context === context);
    assert.equal(matches.length, 1, `Main ruleset must require exactly one ${context} context.`);
    assert.equal(
      typeof matches[0].integration_id,
      "number",
      `${context} must be pinned to its GitHub Actions integration.`,
    );
  }
  for (const context of forbiddenStatusCheckContexts) {
    const matches = required.filter((check) => check.context === context);
    assert.equal(matches.length, 0, `Main ruleset must not require ${context}.`);
  }

  return main;
}

async function loadRulesets() {
  if (fixturePath) {
    return JSON.parse(await readFile(fixturePath, "utf8"));
  }

  if (!token) {
    throw new Error(
      "NUTSNEWS_RULESET_AUDIT_TOKEN is required. Configure a repository secret using a fine-grained token limited to this repository with Administration: read, then run Main ruleset audit.",
    );
  }

  const response = await fetch(`https://api.github.com/repos/${repository}/rulesets`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub ruleset audit returned HTTP ${response.status}.`);
  }
  return response.json();
}

const main = validate(await loadRulesets());
console.log(`Main ruleset audit passed for ${repository}: ${main.name}.`);
