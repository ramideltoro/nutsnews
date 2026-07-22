import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const routePath = resolve(
  import.meta.dirname,
  "../web/app/api/auth/[...nextauth]/route.ts",
);

test("GET and POST OAuth paths both enforce the callback identity guard", async () => {
  const source = await readFile(routePath, "utf8");

  for (const method of ["GET", "POST"]) {
    assert.match(
      source,
      new RegExp(
        `export async function ${method}\\(request: NextRequest\\) \\{[\\s\\S]*?allowOAuthCallbacks\\(request\\)[\\s\\S]*?handlers\\.${method}\\(request\\)`,
      ),
      `${method} must guard before delegating to Auth.js`,
    );
  }

  assert.match(source, /Cache-Control": "no-store"/);
  assert.match(source, /X-NutsNews-Auth-Error/);
  assert.match(source, /status: 503/);
  assert.match(source, /code: error\.code/);
  assert.match(source, /logWarn\(\s*"admin\.oauth_callback\.blocked"/);
  assert.match(source, /request\.headers\.get\("x-forwarded-host"\)/);
  assert.match(source, /request\.headers\.get\("host"\)/);
  assert.match(source, /requestUrl\.host/);
  assert.match(source, /request\.headers\.get\("x-forwarded-proto"\)/);
  assert.match(source, /requestUrl\.protocol\.slice\(0, -1\)/);
});
