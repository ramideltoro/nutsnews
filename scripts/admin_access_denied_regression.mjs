#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    throw new Error(`${label} is missing required contract text: ${needle}`);
  }
}

const page = read("web/app/admin/(public)/access-denied/page.tsx");
const nextConfig = read("web/next.config.ts");
const middleware = read("web/middleware.ts");
const auth = read("web/auth.ts");
const packageJson = JSON.parse(read("web/package.json"));

for (const required of [
  'title: "Admin Sign-in | NutsNews"',
  'export const dynamic = "force-dynamic"',
  "export const revalidate = 0",
  "searchParams?: Promise",
  "SAFE_ERROR_MESSAGES",
  "AccessDenied",
  "Configuration",
  "OAuthSignin",
  "OAuthCallbackError",
  "OAuthAccountNotLinked",
  "Verification",
  "SessionRequired",
  'href="/admin/login"',
  "Back to admin sign-in",
  "Please try signing in again",
]) {
  assertIncludes(page, required, "access-denied page");
}

for (const forbidden of [
  "{error}",
  "{errorParam}",
  "searchParams.error}",
  "JSON.stringify",
]) {
  if (page.includes(forbidden)) {
    throw new Error(`access-denied page must not expose raw query data: ${forbidden}`);
  }
}

assertIncludes(auth, 'error: "/admin/access-denied"', "Auth.js error route");
assertIncludes(nextConfig, 'source: "/admin/:path*"', "admin cache boundary");
assertIncludes(nextConfig, 'headers: noStoreHeaders("bypass-admin-cache")', "admin no-store headers");
assertIncludes(middleware, 'matcher: ["/admin/:path*"]', "admin middleware matcher");
assertIncludes(middleware, 'response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive")', "admin discovery boundary");

if (packageJson.scripts?.["test:admin-access-denied"] !== "node ../scripts/admin_access_denied_regression.mjs") {
  throw new Error("web/package.json is missing test:admin-access-denied");
}

console.log("Admin access-denied route regression contract passed.");
