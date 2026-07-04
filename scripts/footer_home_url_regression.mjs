import fs from "node:fs";

const source = fs.readFileSync("web/app/components/SiteFooter.tsx", "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const homeControlPattern =
  /href="\/"\s+data-testid="nutsnews-footer-home"/m;

assert(
  homeControlPattern.test(source),
  'footer home control must navigate to "/"',
);

assert(
  !/href="\/#top"\s+data-testid="nutsnews-footer-home"/m.test(source),
  'footer home control must not leave "#top" in the URL',
);

console.log("Footer home URL regression safeguards passed.");
