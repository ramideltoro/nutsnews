import { type SupabaseClient } from "@supabase/supabase-js";

import {
  AdminDatabaseAccessError,
  readAdminDatabase,
  type AdminDatabaseJsonObject,
  type AdminSupabaseDatabaseContext,
} from "@/lib/adminDatabase";
import {
  DEFAULT_LANGUAGE_CODE,
  normalizeLanguageCodeValue,
  normalizeLanguageCode,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
} from "@/lib/languages";
import {
  validateTranslatedSummary,
  type TranslationQualityWarning,
} from "@/lib/translationQuality";

const DEFAULT_AUDIT_LIMIT = 60;
const SUMMARY_LOOKUP_LIMIT = 20000;

const TARGET_LANGUAGES = SUPPORTED_LANGUAGES.map((language) => language.code).filter(
  (languageCode): languageCode is Exclude<LanguageCode, "en"> =>
    languageCode !== DEFAULT_LANGUAGE_CODE,
);
const TARGET_LANGUAGE_SET = new Set<string>(TARGET_LANGUAGES);
const PUBLIC_FEED_SNAPSHOT_SELECT_COLUMNS =
  "id,source,title,original_url,ai_summary,category,published_on_site_at,snapshot_rank";
const TRANSLATED_SUMMARY_SELECT_COLUMNS =
  "original_url,language_code,title,summary,updated_at,generated_by,model";

type ArticleRow = {
  id: string;
  source: string | null;
  title: string | null;
  original_url: string;
  ai_summary: string | null;
  category: string | null;
  published_on_site_at: string | null;
  snapshot_rank?: number | null;
};

type SummaryRow = {
  original_url: string;
  language_code: string;
  title: string | null;
  summary: string | null;
  updated_at: string | null;
  generated_by: string | null;
  model: string | null;
};

type TranslationQualityDatabaseSnapshot = {
  articleRows: ArticleRow[];
  summaryRows: SummaryRow[];
};

type TranslationQualityDatabaseSnapshotRow =
  Partial<TranslationQualityDatabaseSnapshot>;

type TranslationQualityDatabaseResult = {
  rows?: TranslationQualityDatabaseSnapshotRow[];
  rowCount?: number;
  generatedAt?: string;
};

export type TranslationQualityIssueRow = {
  severity: "missing" | "critical" | "warning";
  languageCode: string;
  articleTitle: string;
  source: string;
  originalUrl: string;
  issueCode: string;
  message: string;
  provider: string;
  model: string;
  updatedAt: string;
};

export type TranslationLanguageSummary = {
  languageCode: string;
  label: string;
  expectedCount: number;
  availableCount: number;
  missingCount: number;
  warningCount: number;
  criticalCount: number;
  coveragePercent: number;
};

export type TranslationQualityDashboardData = {
  isConfigured: boolean;
  errorMessage: string | null;
  generatedAt: string;
  auditLimit: number;
  source: "public_feed_snapshot";
  articleCount: number;
  expectedTranslationCount: number;
  availableTranslationCount: number;
  missingTranslationCount: number;
  qualityWarningCount: number;
  criticalIssueCount: number;
  fallbackPolicy: string;
  overallStatus: "pass" | "warn" | "fail";
  languageSummaries: TranslationLanguageSummary[];
  issueRows: TranslationQualityIssueRow[];
};

function clampNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? "");

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function summaryKey(originalUrl: string, languageCode: string) {
  return `${languageCode}::${originalUrl}`;
}

function emptyDashboardData(
  auditLimit: number,
  errorMessage: string | null = null,
): TranslationQualityDashboardData {
  return {
    isConfigured: !errorMessage,
    errorMessage,
    generatedAt: new Date().toISOString(),
    auditLimit,
    source: "public_feed_snapshot",
    articleCount: 0,
    expectedTranslationCount: 0,
    availableTranslationCount: 0,
    missingTranslationCount: 0,
    qualityWarningCount: 0,
    criticalIssueCount: errorMessage ? 1 : 0,
    fallbackPolicy:
      "Missing or critically invalid translations fall back to the canonical English title and summary. Public feed responses must not fail because article_summaries rows are missing or questionable.",
    overallStatus: errorMessage ? "fail" : "pass",
    languageSummaries: TARGET_LANGUAGES.map((languageCode) => ({
      languageCode,
      label:
        SUPPORTED_LANGUAGES.find((language) => language.code === languageCode)
          ?.nativeLabel ?? languageCode,
      expectedCount: 0,
      availableCount: 0,
      missingCount: 0,
      warningCount: 0,
      criticalCount: 0,
      coveragePercent: 1,
    })),
    issueRows: [],
  };
}

function formatProvider(row?: SummaryRow) {
  return row?.generated_by || "n/a";
}

function formatModel(row?: SummaryRow) {
  return row?.model || "n/a";
}

function formatUpdatedAt(row?: SummaryRow) {
  return row?.updated_at || "n/a";
}

function warningToIssueRow({
  warning,
  languageCode,
  article,
  summary,
}: {
  warning: TranslationQualityWarning;
  languageCode: string;
  article: ArticleRow;
  summary?: SummaryRow;
}): TranslationQualityIssueRow {
  return {
    severity: warning.severity,
    languageCode,
    articleTitle: article.title || "Untitled article",
    source: article.source || "Unknown source",
    originalUrl: article.original_url,
    issueCode: warning.code,
    message: warning.message,
    provider: formatProvider(summary),
    model: formatModel(summary),
    updatedAt: formatUpdatedAt(summary),
  };
}

async function loadSupabaseArticleRows(client: SupabaseClient, auditLimit: number) {
  const { data, error } = await client
    .from("public_feed_snapshot")
    .select(PUBLIC_FEED_SNAPSHOT_SELECT_COLUMNS)
    .order("snapshot_rank", { ascending: true })
    .limit(auditLimit);

  if (error) {
    throw new Error(
      `Failed to load public feed snapshot for translation quality: ${error.message}`,
    );
  }

  return (data ?? []) as unknown as ArticleRow[];
}

async function loadSupabaseSummaryRows(
  client: SupabaseClient,
  originalUrls: string[],
) {
  if (originalUrls.length > 0) {
    const { data, error } = await client
      .from("article_summaries")
      .select(TRANSLATED_SUMMARY_SELECT_COLUMNS)
      .in("original_url", originalUrls)
      .limit(SUMMARY_LOOKUP_LIMIT);

    if (error) {
      throw new Error(`Failed to load translated summary rows: ${error.message}`);
    }

    return (data ?? []) as unknown as SummaryRow[];
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredArrayField<T>(row: Record<string, unknown>, field: string): T[] {
  const value = row[field];

  if (!Array.isArray(value)) {
    throw new Error(
      `Admin translation quality operation returned an invalid ${field} array.`,
    );
  }

  return value as T[];
}

function normalizeTranslationQualityDatabaseResult(
  result: TranslationQualityDatabaseResult,
): TranslationQualityDatabaseSnapshot {
  const row = result.rows?.[0];

  if (!isRecord(row)) {
    throw new Error(
      "Admin translation quality operation returned no dashboard snapshot row.",
    );
  }

  return {
    articleRows: requiredArrayField<ArticleRow>(row, "articleRows"),
    summaryRows: requiredArrayField<SummaryRow>(row, "summaryRows"),
  };
}

async function loadSupabaseTranslationQualityDatabaseSnapshot(
  context: AdminSupabaseDatabaseContext,
  auditLimit: number,
) {
  context.getConfig();
  const client = context.getClient();
  const articleRows = await loadSupabaseArticleRows(client, auditLimit);
  const originalUrls = articleRows
    .map((article) => article.original_url)
    .filter(Boolean);
  const summaryRows = await loadSupabaseSummaryRows(client, originalUrls);

  return {
    rows: [
      {
        articleRows,
        summaryRows,
      } as unknown as AdminDatabaseJsonObject,
    ],
    rowCount: 1,
    generatedAt: new Date().toISOString(),
  };
}

async function loadTranslationQualityDatabaseSnapshot(auditLimit: number) {
  const result = await readAdminDatabase(
    "load-admin-translation-quality",
    {
      auditLimit,
      summaryLookupLimit: SUMMARY_LOOKUP_LIMIT,
      targetLanguageCodes: TARGET_LANGUAGES,
    },
    (context) =>
      loadSupabaseTranslationQualityDatabaseSnapshot(context, auditLimit),
    { cache: "no-store" },
  );

  return normalizeTranslationQualityDatabaseResult(
    result as TranslationQualityDatabaseResult,
  );
}

function targetLanguageCodeForSummary(row: SummaryRow) {
  if (TARGET_LANGUAGE_SET.has(row.language_code)) {
    return row.language_code;
  }

  const normalizedLanguageCode = normalizeLanguageCodeValue(row.language_code);

  return TARGET_LANGUAGE_SET.has(normalizedLanguageCode)
    ? normalizedLanguageCode
    : null;
}

function buildSummariesByKey(summaries: SummaryRow[]) {
  const summariesByKey = new Map(
    summaries
      .map((summary) => {
        const languageCode = targetLanguageCodeForSummary(summary);

        if (!languageCode) {
          return null;
        }

        return [summaryKey(summary.original_url, languageCode), summary] as const;
      })
      .filter((entry): entry is readonly [string, SummaryRow] => Boolean(entry)),
  );

  return summariesByKey;
}

function translationQualityDataAccessErrorMessage(error: unknown) {
  if (error instanceof AdminDatabaseAccessError) {
    return error.message;
  }

  if (
    error instanceof Error &&
    /server-side supabase access is not configured/i.test(error.message)
  ) {
    return "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.";
  }

  return error instanceof Error
    ? error.message
    : "Unable to load translation quality dashboard data.";
}

function buildTranslationQualityDashboardData({
  articles,
  summaries,
  auditLimit,
}: {
  articles: ArticleRow[];
  summaries: SummaryRow[];
  auditLimit: number;
}): TranslationQualityDashboardData {
  const summariesByKey = buildSummariesByKey(summaries);
  const languageSummaries: TranslationLanguageSummary[] = TARGET_LANGUAGES.map((languageCode) => {
    const label = SUPPORTED_LANGUAGES.find((language) => language.code === languageCode)?.nativeLabel ?? languageCode;
    let availableCount = 0;
    let missingCount = 0;
    let warningCount = 0;
    let criticalCount = 0;

    for (const article of articles) {
      const summary = summariesByKey.get(summaryKey(article.original_url, languageCode));

      if (!summary) {
        missingCount += 1;
        continue;
      }

      availableCount += 1;
      const result = validateTranslatedSummary(
        {
          language_code: summary.language_code,
          title: summary.title,
          summary: summary.summary,
          sourceTitle: article.title,
          sourceSummary: article.ai_summary,
        },
        normalizeLanguageCode(languageCode),
      );

      warningCount += result.warnings.filter((warning) => warning.severity === "warning").length;
      criticalCount += result.warnings.filter((warning) => warning.severity === "critical").length;
    }

    return {
      languageCode,
      label,
      expectedCount: articles.length,
      availableCount,
      missingCount,
      warningCount,
      criticalCount,
      coveragePercent: articles.length > 0 ? availableCount / articles.length : 1,
    };
  });

  const issueRows: TranslationQualityIssueRow[] = [];

  for (const article of articles) {
    for (const languageCode of TARGET_LANGUAGES) {
      const summary = summariesByKey.get(summaryKey(article.original_url, languageCode));

      if (!summary) {
        issueRows.push({
          severity: "missing",
          languageCode,
          articleTitle: article.title || "Untitled article",
          source: article.source || "Unknown source",
          originalUrl: article.original_url,
          issueCode: "missing_translation",
          message: `No ${languageCode} row exists in article_summaries. Public feed falls back to English for this card.`,
          provider: "n/a",
          model: "n/a",
          updatedAt: "n/a",
        });
        continue;
      }

      const result = validateTranslatedSummary(
        {
          language_code: summary.language_code,
          title: summary.title,
          summary: summary.summary,
          sourceTitle: article.title,
          sourceSummary: article.ai_summary,
        },
        normalizeLanguageCode(languageCode),
      );

      for (const warning of result.warnings) {
        issueRows.push(
          warningToIssueRow({
            warning,
            languageCode,
            article,
            summary,
          }),
        );
      }
    }
  }

  issueRows.sort((left, right) => {
    const severityRank = { critical: 0, missing: 1, warning: 2 } as const;
    const leftRank = severityRank[left.severity];
    const rightRank = severityRank[right.severity];

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.articleTitle.localeCompare(right.articleTitle);
  });

  const expectedTranslationCount = articles.length * TARGET_LANGUAGES.length;
  const availableTranslationCount = languageSummaries.reduce((sum, item) => sum + item.availableCount, 0);
  const missingTranslationCount = languageSummaries.reduce((sum, item) => sum + item.missingCount, 0);
  const qualityWarningCount = languageSummaries.reduce((sum, item) => sum + item.warningCount, 0);
  const criticalIssueCount = languageSummaries.reduce((sum, item) => sum + item.criticalCount, 0);
  const overallStatus = criticalIssueCount > 0 ? "fail" : missingTranslationCount > 0 || qualityWarningCount > 0 ? "warn" : "pass";

  return {
    isConfigured: true,
    errorMessage: null,
    generatedAt: new Date().toISOString(),
    auditLimit,
    source: "public_feed_snapshot",
    articleCount: articles.length,
    expectedTranslationCount,
    availableTranslationCount,
    missingTranslationCount,
    qualityWarningCount,
    criticalIssueCount,
    fallbackPolicy: "Missing or critically invalid translations fall back to the canonical English title and summary. Public feed responses must not fail because article_summaries rows are missing or questionable.",
    overallStatus,
    languageSummaries,
    issueRows: issueRows.slice(0, 80),
  };
}

export async function getTranslationQualityDashboardData(): Promise<TranslationQualityDashboardData> {
  const auditLimit = clampNumber(
    process.env.TRANSLATION_QUALITY_AUDIT_LIMIT,
    DEFAULT_AUDIT_LIMIT,
    1,
    500,
  );

  try {
    const snapshot = await loadTranslationQualityDatabaseSnapshot(auditLimit);

    return buildTranslationQualityDashboardData({
      articles: snapshot.articleRows,
      summaries: snapshot.summaryRows,
      auditLimit,
    });
  } catch (error) {
    return emptyDashboardData(
      auditLimit,
      translationQualityDataAccessErrorMessage(error),
    );
  }
}
