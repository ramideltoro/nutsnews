#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const articleUrl = "https://mock.nutsnews.test/release-gate/community-garden";
const article = {
  id: "translation-release-gate-article",
  source: "NutsNews Release Gate Fixture",
  title: "Release gate community garden story",
  original_url: articleUrl,
  ai_summary:
    "Neighbors restore a community garden and share a calm public space with families, students, and local volunteers.",
  category: "Community | Uplifting",
  published_on_site_at: "2026-07-20T12:00:00+00:00",
  snapshot_rank: 1,
};

const completeSummaries = [
  {
    original_url: articleUrl,
    language_code: "fr",
    title: "Jardin communautaire pour la sortie",
    summary:
      "La communaute restaure un jardin local avec les voisins et les familles. Les benevoles partagent un espace calme pour les enfants, les etudiants et les lecteurs.",
  },
  {
    original_url: articleUrl,
    language_code: "ja",
    title: "リリース確認用の地域庭園",
    summary:
      "地域の人々が庭園を整え、家族や学生やボランティアが安心して集まれる場所を作ります。この前向きな記事は翻訳ゲートの確認に使われます。",
  },
  {
    original_url: articleUrl,
    language_code: "de-CH",
    title: "Gemeinschaftsgarten fuer die Freigabe",
    summary:
      "Die Nachbarschaft pflegt den Gemeinschaftsgarten und teilt einen ruhigen Ort mit Familien und Studierenden. Der Beitrag prueft die Uebersetzung sicher.",
  },
  {
    original_url: articleUrl,
    language_code: "de",
    title: "Gemeinschaftsgarten fuer die Freigabe",
    summary:
      "Die Nachbarschaft pflegt den Gemeinschaftsgarten und teilt einen ruhigen Ort mit Familien und Studierenden. Der Beitrag prueft die Uebersetzung sicher.",
  },
  {
    original_url: articleUrl,
    language_code: "el",
    title: "Κοινοτικός κήπος για έλεγχο",
    summary:
      "Οι γείτονες φροντίζουν έναν κοινοτικό κήπο και μοιράζονται έναν ήρεμο χώρο με οικογένειες, μαθητές και εθελοντές για μια θετική ιστορία.",
  },
];

function json(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,apikey,content-type,prefer,range,x-client-info",
    "access-control-expose-headers": "content-range",
    "content-type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function createSupabaseFixtureServer(summaries) {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,HEAD,OPTIONS",
        "access-control-allow-headers": "authorization,apikey,content-type,prefer,range,x-client-info",
      });
      response.end();
      return;
    }

    if (url.pathname === "/rest/v1/public_feed_snapshot") {
      json(response, 200, [article], { "content-range": "0-0/1" });
      return;
    }

    if (url.pathname === "/rest/v1/article_summaries") {
      json(response, 200, summaries, { "content-range": `0-${Math.max(summaries.length - 1, 0)}/${summaries.length}` });
      return;
    }

    json(response, 404, { error: `Unhandled fixture route ${request.method} ${url.pathname}` });
  });
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      assert(address && typeof address === "object", "Fixture server must expose a TCP address.");
      resolveListen(address.port);
    });
  });
}

function close(server) {
  return new Promise((resolveClose) => {
    server.close(() => resolveClose());
  });
}

function runChild(env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, ["scripts/audit_article_translations.mjs"], {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      resolveRun({ code, output: `${stdout}\n${stderr}` });
    });
  });
}

async function runAuditCase({ label, summaries, expectedCode, overrides = {}, expectedOutput }) {
  const server = createSupabaseFixtureServer(summaries);
  const port = await listen(server);
  const supabaseUrl = `http://127.0.0.1:${port}`;

  try {
    const result = await runChild({
      ...process.env,
      NUTSNEWS_RUNTIME_ENV: "staging",
      NUTSNEWS_SIDE_EFFECTS_MODE: "disabled",
      NUTSNEWS_DATA_ENVIRONMENT: "staging",
      NUTSNEWS_SUPABASE_CREDENTIALS_ENV: "staging",
      NUTSNEWS_SUPABASE_PROJECT_REF: "ci-staging-fixture",
      NUTSNEWS_PRODUCTION_SUPABASE_PROJECT_REF: "ci-production-fixture",
      NUTSNEWS_PUBLIC_SUPABASE_URL: supabaseUrl,
      NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY: "ci-public-anon-key",
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: "ci-service-role-key",
      LANGUAGE_CODES: "fr,ja,de-CH,de,el",
      AUDIT_LIMIT: "1",
      AUDIT_SOURCE: "public_feed_snapshot",
      SUMMARY_LOOKUP_LIMIT: "20",
      TRANSLATION_QUALITY_FAIL_ON_CRITICAL: "true",
      TRANSLATION_QUALITY_FAIL_ON_MISSING: "true",
      TRANSLATION_QUALITY_MIN_COVERAGE: "100",
      ...overrides,
    });

    assert.equal(result.code, expectedCode, `${label} exited with unexpected status.\n${result.output}`);

    if (expectedOutput) {
      assert.match(result.output, expectedOutput, `${label} did not print expected output.\n${result.output}`);
    }

    return result.output;
  } finally {
    await close(server);
  }
}

await runAuditCase({
  label: "complete translations pass",
  summaries: completeSummaries,
  expectedCode: 0,
  expectedOutput: /Coverage: 100%/,
});

await runAuditCase({
  label: "missing translations fail",
  summaries: completeSummaries.filter((summary) => summary.language_code !== "el"),
  expectedCode: 1,
  expectedOutput: /Missing translation rows found: 1/,
});

await runAuditCase({
  label: "critical translations fail",
  summaries: completeSummaries.map((summary) =>
    summary.language_code === "fr"
      ? {
          ...summary,
          title: article.title,
        }
      : summary,
  ),
  expectedCode: 1,
  expectedOutput: /Critical translation quality issues found: 1/,
});

await runAuditCase({
  label: "coverage threshold fails",
  summaries: completeSummaries.filter((summary) => summary.language_code !== "el"),
  expectedCode: 1,
  overrides: {
    TRANSLATION_QUALITY_FAIL_ON_MISSING: "false",
  },
  expectedOutput: /Translation coverage 80\.00% is below required 100\.00%/,
});

console.log("Translation release gate regression checks passed.");
