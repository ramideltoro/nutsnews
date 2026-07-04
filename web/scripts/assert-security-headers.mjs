import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label} is missing: ${needle}`);
  }
}

const securityHeaders = read("lib/securityHeaders.ts");
const middleware = read("middleware.ts");
const contactRoute = read("app/api/contact/route.ts");
const packageJson = JSON.parse(read("package.json"));
const workflowPath = path.join(root, "../.github/workflows/web-ci.yml");
const workflow = fs.existsSync(workflowPath)
  ? fs.readFileSync(workflowPath, "utf8")
  : "";

for (const header of [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Strict-Transport-Security",
  "Cross-Origin-Opener-Policy",
]) {
  assertIncludes(securityHeaders, header, "securityHeaders.ts");
}

for (const directive of [
  "default-src",
  "script-src",
  "style-src",
  "img-src",
  "connect-src",
  "frame-src",
  "frame-ancestors",
  "object-src",
  "base-uri",
  "form-action",
]) {
  assertIncludes(securityHeaders, directive, "Content Security Policy");
}

for (const routeToken of [
  "isAdminRoute",
  "bypass-admin-cache",
  "X-Robots-Tag",
]) {
  assertIncludes(middleware, routeToken, "middleware.ts");
}

for (const contactToken of [
  "TURNSTILE_SECRET_KEY",
  "verifyTurnstileToken",
  "RATE_LIMIT_MAX_REQUESTS",
  "isAllowedOrigin",
  "MAX_REQUEST_BYTES",
  "MAX_TURNSTILE_TOKEN_LENGTH",
  "Retry-After",
]) {
  assertIncludes(contactRoute, contactToken, "contact route");
}

if (packageJson.scripts?.["test:security-headers"] !== "node scripts/assert-security-headers.mjs") {
  throw new Error("package.json is missing test:security-headers script");
}

if (workflow && !workflow.includes("npm run test:security-headers")) {
  throw new Error("web-ci.yml does not run npm run test:security-headers");
}

console.log("Security header checks passed.");
