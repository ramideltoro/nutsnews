import assert from "node:assert/strict";
import { test } from "node:test";

import {
  configuredVercelProductionRuntimeTargets,
  configuredVpsDirectProductionTarget,
  configuredVpsPrimaryProductionTarget,
  defaultFailoverControllerConfig,
  failoverControllerEnv,
  productionTopologyEnv,
  readFailoverControllerConfig,
} from "../scripts/production_topology.mjs";

test("VPS production defaults to the canonical primary hostname", () => {
  assert.equal(configuredVpsPrimaryProductionTarget({}), "https://www.nutsnews.com/");
  assert.equal(
    configuredVpsPrimaryProductionTarget({
      [productionTopologyEnv.vpsProductionUrl]: "https://vps.nutsnews.com/",
    }),
    "https://vps.nutsnews.com/",
  );
  assert.equal(configuredVpsDirectProductionTarget({}), "https://vps.nutsnews.com/");
});

test("Vercel production defaults to the generated secondary deployment URL", () => {
  const targets = configuredVercelProductionRuntimeTargets(
    {},
    { deploymentUrl: "https://nutsnews-prod-candidate.vercel.app/" },
  );
  assert.deepEqual(targets.secondaryTargets, ["https://nutsnews-prod-candidate.vercel.app/"]);
  assert.deepEqual(targets.failoverAliases, []);
  assert.deepEqual(targets.targets, ["https://nutsnews-prod-candidate.vercel.app/"]);
  assert.equal(targets.verifyFailoverAliases, false);
});

test("Vercel secondary targets reject canonical production hostnames unless using failover aliases", () => {
  assert.throws(
    () =>
      configuredVercelProductionRuntimeTargets(
        {
          [productionTopologyEnv.vercelSecondaryProductionUrls]: "https://www.nutsnews.com/",
        },
        { deploymentUrl: "https://nutsnews-prod-candidate.vercel.app/" },
      ),
    /must not include canonical production domains/,
  );

  const targets = configuredVercelProductionRuntimeTargets(
    {
      [productionTopologyEnv.verifyVercelFailoverAliases]: "true",
      [productionTopologyEnv.vercelFailoverProductionAliases]: "https://www.nutsnews.com/,https://nutsnews.com/",
    },
    { deploymentUrl: "https://nutsnews-prod-candidate.vercel.app/" },
  );
  assert.deepEqual(targets.secondaryTargets, ["https://nutsnews-prod-candidate.vercel.app/"]);
  assert.deepEqual(targets.failoverAliases, ["https://www.nutsnews.com/", "https://nutsnews.com/"]);
  assert.deepEqual(targets.targets, [
    "https://nutsnews-prod-candidate.vercel.app/",
    "https://www.nutsnews.com/",
    "https://nutsnews.com/",
  ]);
});

test("failover controller config names preserve the rollout contract", () => {
  assert.deepEqual(readFailoverControllerConfig({}), defaultFailoverControllerConfig);
  assert.deepEqual(
    readFailoverControllerConfig({
      [failoverControllerEnv.healthCheckIntervalSeconds]: "15",
      [failoverControllerEnv.consecutiveVpsFailuresBeforeDnsFailover]: "3",
      [failoverControllerEnv.failbackDnsStateGate]: "current_dns_state_is_vercel_fallback_and_vps_ready",
    }),
    defaultFailoverControllerConfig,
  );
  assert.equal(failoverControllerEnv.healthCheckIntervalSeconds, "NUTSNEWS_FAILOVER_HEALTH_CHECK_INTERVAL_SECONDS");
  assert.equal(failoverControllerEnv.consecutiveVpsFailuresBeforeDnsFailover, "NUTSNEWS_FAILOVER_CONSECUTIVE_VPS_FAILURES");
  assert.equal(failoverControllerEnv.failbackDnsStateGate, "NUTSNEWS_FAILBACK_DNS_STATE_GATE");
});
