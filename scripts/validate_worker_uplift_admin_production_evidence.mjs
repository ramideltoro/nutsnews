#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateEvidence } from "./worker_uplift_admin_production_evidence.mjs";

const evidencePath = process.argv[2];
if (!evidencePath) {
  throw new Error("usage: validate_worker_uplift_admin_production_evidence.mjs <evidence.json>");
}

const evidence = JSON.parse(await readFile(resolve(evidencePath), "utf8"));
validateEvidence(evidence);
process.stdout.write("Worker-uplift authenticated admin evidence is valid.\n");
