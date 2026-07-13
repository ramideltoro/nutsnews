import { getServerSupabase } from "@/lib/supabase";
import {
  DEFAULT_LANGUAGE_CODE,
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

function getSupabaseConfig() {
  return getServerSupabase();
}

function summaryKey(originalUrl: string, languageCode: string) {
  return `${languageCode}::${originalUrl}`;
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

export async function getTranslationQualityDashboardData(): Promise<TranslationQualityDashboardData> {
  const auditLimit = clampNumber(process.env.TRANSLATION_QUALITY_AUDIT_LIMIT, DEFAULT_AUDIT_LIMIT, 1, 500);
  const supabase = getSupabaseConfig();

  const { data: articleData, error: articleError } = await supabase
    .from("public_feed_snapshot")
    .select("id,source,title,original_url,ai_summary,category,published_on_site_at,snapshot_rank")
    .order("snapshot_rank", { ascending: true })
    .limit(auditLimit);

  if (articleError) {
    throw new Error(`Failed to load public feed snapshot for translation quality: ${articleError.message}`);
  }

  const articles = (articleData ?? []) as ArticleRow[];
  const originalUrls = articles.map((article) => article.original_url).filter(Boolean);
  let summaries: SummaryRow[] = [];

  if (originalUrls.length > 0) {
    const { data: summaryData, error: summaryError } = await supabase
      .from("article_summaries")
      .select("original_url,language_code,title,summary,updated_at,generated_by,model")
      .in("original_url", originalUrls)
      .in("language_code", TARGET_LANGUAGES)
      .limit(SUMMARY_LOOKUP_LIMIT);

    if (summaryError) {
      throw new Error(`Failed to load translated summary rows: ${summaryError.message}`);
    }

    summaries = (summaryData ?? []) as SummaryRow[];
  }

  const summariesByKey = new Map(
    summaries.map((summary) => [summaryKey(summary.original_url, summary.language_code), summary]),
  );

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
