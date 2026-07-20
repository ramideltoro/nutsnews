#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const webDir = fileURLToPath(new URL("../web/", import.meta.url));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const supabasePort = Number(process.env.WEB_PUBLIC_SMOKE_SUPABASE_PORT || 8905);
const mockExternalPort = Number(process.env.WEB_PUBLIC_SMOKE_EXTERNAL_PORT || 8906);
const webPort = Number(process.env.WEB_PUBLIC_SMOKE_WEB_PORT || 3021);
const supabaseUrl = `http://127.0.0.1:${supabasePort}`;
const mockExternalUrl = `http://127.0.0.1:${mockExternalPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;
const defaultPlaywrightConfig = process.env.WEB_PUBLIC_SMOKE_PLAYWRIGHT_CONFIG || "playwright.public-smoke.config.ts";

const categories = [
  "Community | Uplifting",
  "Animals | Community",
  "Science | Uplifting",
  "Wellness | Community",
  "Travel | Culture",
  "Culture | Achievement",
  "Achievement | Community",
  "Community | Wellness",
  "Animals | Wellness",
  "Science | Culture",
  "Travel | Uplifting",
  "Culture | Community",
];

const titles = [
  "Public smoke readers celebrate neighborhood gardens",
  "Public smoke therapy dogs visit a library",
  "Public smoke students build a solar bench",
  "Public smoke neighbors share a wellness walk",
  "Public smoke artists restore a train station",
  "Public smoke volunteers clean a river path",
  "Public smoke bakery funds a youth team",
  "Public smoke nurses open a calm room",
  "Public smoke shelter kittens find homes",
  "Public smoke telescope night welcomes families",
  "Public smoke cyclists deliver museum passes",
  "Public smoke choir gathers new friends",
];

const articles = titles.map((title, index) => {
  const idNumber = String(index + 1).padStart(2, "0");
  const published = new Date(Date.UTC(2026, 5, 28, 12, 0, 0) - index * 60 * 60 * 1000).toISOString();

  return {
    id: `public-smoke-article-${idNumber}`,
    source: `NutsNews Public Smoke ${idNumber}`,
    title,
    original_url: `https://mock.nutsnews.test/public-smoke/story-${idNumber}`,
    image_url: `${mockExternalUrl}/images/public-smoke-${idNumber}.png`,
    published_at: published,
    published_on_site_at: published,
    ai_summary:
      "This public reader smoke article uses stable offline data so critical reader flows can be tested without production services or secrets.",
    category: categories[index % categories.length],
    positivity_score: 9,
    snapshot_rank: index + 1,
  };
});

const articleSummaries = articles.slice(0, 8).map((article, index) => ({
  original_url: article.original_url,
  language_code: "fr",
  title:
    index === 0
      ? "Jardins de quartier pour le test public"
      : `Article public de test numero ${index + 1}`,
  summary:
    "Une version francaise de test raconte une nouvelle positive avec des voisins, de la communaute et des lecteurs heureux. Elle permet de verifier que le changement de langue charge toujours des articles utiles.",
}));

function json(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,apikey,content-type,prefer,range,x-client-info",
    "access-control-expose-headers": "content-range",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function options(response) {
  response.writeHead(204, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,apikey,content-type,prefer,range,x-client-info",
  });
  response.end();
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function stripInternalColumns(row) {
  const { snapshot_rank: _snapshotRank, ...article } = row;
  return article;
}

function applyRange(request, rows) {
  const rangeHeader = request.headers.range;

  if (!rangeHeader) {
    return rows;
  }

  const match = String(rangeHeader).match(/(\d+)-(\d+)/);

  if (!match) {
    return rows;
  }

  const start = Number(match[1]);
  const end = Number(match[2]);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return rows;
  }

  return rows.slice(start, end + 1);
}

function filterByCategory(url, rows) {
  const categoryFilter = url.searchParams.get("category");

  if (!categoryFilter) {
    return rows;
  }

  const normalized = categoryFilter
    .replace(/^ilike\./, "")
    .replace(/\*/g, "")
    .replace(/%/g, "")
    .toLowerCase();

  if (!normalized) {
    return rows;
  }

  return rows.filter((article) => article.category.toLowerCase().includes(normalized));
}

function createSupabaseMockServer() {
  return http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        options(response);
        return;
      }

      const url = new URL(request.url ?? "/", supabaseUrl);

      if (url.pathname === "/rest/v1/public_feed_snapshot" && request.method === "HEAD") {
        response.writeHead(200, { "content-range": `0-0/${articles.length}` });
        response.end();
        return;
      }

      if (url.pathname === "/rest/v1/public_feed_snapshot" && request.method === "GET") {
        const rows = applyRange(
          request,
          filterByCategory(
            url,
            articles.sort((left, right) => left.snapshot_rank - right.snapshot_rank),
          ).map(stripInternalColumns),
        );
        json(response, 200, rows, { "content-range": `0-${Math.max(rows.length - 1, 0)}/${articles.length}` });
        return;
      }

      if (url.pathname === "/rest/v1/articles" && request.method === "HEAD") {
        response.writeHead(200, { "content-range": `0-0/${articles.length}` });
        response.end();
        return;
      }

      if (url.pathname === "/rest/v1/articles" && request.method === "GET") {
        const idFilter = url.searchParams.get("id");
        const idMatch = idFilter?.match(/^eq\.(.+)$/);

        if (idMatch) {
          const article = articles.find((item) => item.id === idMatch[1]);

          if (!article) {
            json(response, 406, { message: "No rows found" });
            return;
          }

          const payload = stripInternalColumns(article);
          if (String(request.headers.accept ?? "").includes("application/vnd.pgrst.object+json")) {
            json(response, 200, payload);
          } else {
            json(response, 200, [payload]);
          }
          return;
        }

        if (url.searchParams.get("select")?.startsWith("id,")) {
          json(
            response,
            200,
            articles.map((article) => ({
              id: article.id,
              published_on_site_at: article.published_on_site_at,
              published_at: article.published_at,
            })),
          );
          return;
        }

        let rows = filterByCategory(url, articles);

        if (url.searchParams.has("or")) {
          rows = rows.slice(5);
        }

        const limit = Number(url.searchParams.get("limit") ?? "0");
        const rangedRows = applyRange(request, rows);
        const limitedRows = Number.isFinite(limit) && limit > 0 ? rangedRows.slice(0, limit) : rangedRows;
        const payload = limitedRows.map(stripInternalColumns);
        json(response, 200, payload, { "content-range": `0-${Math.max(payload.length - 1, 0)}/${rows.length}` });
        return;
      }

      if (url.pathname === "/rest/v1/article_summaries" && request.method === "HEAD") {
        response.writeHead(200, { "content-range": `0-0/${articleSummaries.length}` });
        response.end();
        return;
      }

      if (url.pathname === "/rest/v1/article_summaries" && request.method === "GET") {
        const languageFilter = url.searchParams.get("language_code") ?? "";
        const languageMatch = languageFilter.match(/^eq\.(.+)$/);
        const languageCode = languageMatch?.[1];
        const rows = languageCode
          ? articleSummaries.filter((summary) => summary.language_code === languageCode)
          : articleSummaries;
        json(response, 200, rows, { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
        return;
      }

      if (url.pathname === "/rest/v1/quota_usage_events" && request.method === "POST") {
        await readBody(request);
        json(response, 201, [{ id: 1, created_at: new Date().toISOString() }]);
        return;
      }

      if (url.pathname === "/rest/v1/rss_feeds" && request.method === "GET") {
        json(response, 200, [], { "content-range": "0-0/0" });
        return;
      }

      json(response, 404, { error: `Unhandled mock Supabase route ${request.method} ${url.pathname}` });
    } catch (error) {
      json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

function createExternalMockServer() {
  return http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        options(response);
        return;
      }

      const url = new URL(request.url ?? "/", mockExternalUrl);

      if (url.pathname.startsWith("/images/") && request.method === "GET") {
        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
          "base64",
        );
        response.writeHead(200, {
          "content-type": "image/png",
          "cache-control": "public, max-age=31536000, immutable",
        });
        response.end(png);
        return;
      }

      if (url.pathname === "/turnstile/v0/siteverify" && request.method === "POST") {
        await readBody(request);
        json(response, 200, { success: true, challenge_ts: new Date().toISOString(), hostname: "localhost" });
        return;
      }

      if (url.pathname === "/emails" && request.method === "POST") {
        await readBody(request);
        json(response, 200, { id: "public-smoke-email" });
        return;
      }

      json(response, 404, { error: `Unhandled mock external route ${request.method} ${url.pathname}` });
    } catch (error) {
      json(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

function listen(server, port, label) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      console.log(`${label} listening on http://127.0.0.1:${port}`);
      resolve();
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

function runPlaywright(playwrightConfig = defaultPlaywrightConfig, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, ["exec", "--", "playwright", "test", `--config=${playwrightConfig}`, ...extraArgs], {
      cwd: webDir,
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        WEB_PUBLIC_SMOKE_WEB_PORT: String(webPort),
        NUTSNEWS_RUNTIME_ENV: "staging",
        NUTSNEWS_SIDE_EFFECTS_MODE: "disabled",
        NUTSNEWS_DATA_ENVIRONMENT: "staging",
        NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "staging",
        NUTSNEWS_SUPABASE_PROJECT_REF: "public-smoke-fixture",
        NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "production-fixture",
        NUTSNEWS_PUBLIC_SUPABASE_URL: supabaseUrl,
        NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY: "public-smoke-anon-key",
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-smoke-anon-key",
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: "public-smoke-service-role-key",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "public-smoke-turnstile-site-key",
        TURNSTILE_SECRET_KEY: "public-smoke-turnstile-secret-key",
        TURNSTILE_VERIFY_URL: `${mockExternalUrl}/turnstile/v0/siteverify`,
        RESEND_API_KEY: "public-smoke-resend-key",
        RESEND_EMAILS_URL: `${mockExternalUrl}/emails`,
        CONTACT_TO_EMAIL: "rami@example.test",
        CONTACT_FROM_EMAIL: "NutsNews Public Smoke <noreply@example.test>",
        AUTH_SECRET: "public-smoke-auth-secret-not-for-production",
        NEXTAUTH_URL: webUrl,
        NEXT_PUBLIC_APP_ENV: "staging",
        NUTSNEWS_EDGE_FEED_SNAPSHOT_URL: mockExternalUrl,
      },
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Playwright public reader smoke exited with code ${code}`));
      }
    });
  });
}

async function run(playwrightConfig = defaultPlaywrightConfig, extraArgs = []) {
  const supabaseServer = createSupabaseMockServer();
  const externalServer = createExternalMockServer();

  try {
    await listen(supabaseServer, supabasePort, "Public smoke mock Supabase/PostgREST");
    await listen(externalServer, mockExternalPort, "Public smoke mock external services");
    await runPlaywright(playwrightConfig, extraArgs);
  } finally {
    await closeServer(supabaseServer);
    await closeServer(externalServer);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(defaultPlaywrightConfig, process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { run };
