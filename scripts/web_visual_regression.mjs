#!/usr/bin/env node
import { run } from "./web_public_reader_smoke.mjs";

run("playwright.visual.config.ts", process.argv.slice(2)).catch((error) => {
  console.error(error);
  process.exit(1);
});
