import { type SupabaseClient } from "@supabase/supabase-js";

import {
  AdminDatabaseAccessError,
  readAdminDatabase,
  type AdminDatabaseJsonObject,
  type AdminSupabaseDatabaseContext,
} from "@/lib/adminDatabase";
import { formatAdminDateTime } from "@/lib/adminTime";

const SOURCE_CATEGORY_SELECT_COLUMNS = [
  "source",
  "category",
  "outbound_click_count",
  "category_interest_count",
  "total_engagement_count",
  "first_event_date",
  "latest_event_date",
  "last_updated_at",
].join(",");

const ARTICLE_SELECT_COLUMNS = [
  "article_id",
  "title",
  "original_url",
  "source",
  "category",
  "outbound_click_count",
  "first_event_date",
  "latest_event_date",
  "last_updated_at",
].join(",");

export const ENGAGEMENT_SOURCE_CATEGORY_LIMIT = 100;
export const ENGAGEMENT_ARTICLE_LIMIT = 25;

type SourceCategoryDbRow = {
  source: string | null;
  category: string | null;
  outbound_click_count: number | string | null;
  category_interest_count: number | string | null;
  total_engagement_count: number | string | null;
  first_event_date: string | null;
  latest_event_date: string | null;
  last_updated_at: string | null;
};

type ArticleEngagementDbRow = {
  article_id: string | null;
  title: string | null;
  original_url: string | null;
  source: string | null;
  category: string | null;
  outbound_click_count: number | string | null;
  first_event_date: string | null;
  latest_event_date: string | null;
  last_updated_at: string | null;
};

type ArticleEngagementDatabaseSnapshot = {
  sourceCategoryRows: SourceCategoryDbRow[];
  sourceCategoryError: string | null;
  articleRows: ArticleEngagementDbRow[];
  articleError: string | null;
};

type ArticleEngagementDatabaseSnapshotRow =
  Partial<ArticleEngagementDatabaseSnapshot>;

type ArticleEngagementDatabaseResult = {
  rows?: ArticleEngagementDatabaseSnapshotRow[];
  rowCount?: number;
  generatedAt?: string;
};

export type ArticleEngagementSourceCategoryRow = {
  source: string;
  category: string;
  outboundClickCount: number;
  categoryInterestCount: number;
  totalEngagementCount: number;
  firstEventDate: string | null;
  latestEventDate: string | null;
  latestEventLabel: string;
  lastUpdatedAt: string | null;
};

export type ArticleEngagementRollupRow = {
  label: string;
  outboundClickCount: number;
  categoryInterestCount: number;
  totalEngagementCount: number;
  latestEventDate: string | null;
  latestEventLabel: string;
};

export type ArticleEngagementArticleRow = {
  articleId: string;
  title: string;
  originalUrl: string | null;
  source: string;
  category: string;
  outboundClickCount: number;
  latestEventDate: string | null;
  latestEventLabel: string;
};

export type ArticleEngagementSummary = {
  totalOutboundClicks: number;
  totalCategoryInterest: number;
  totalEngagement: number;
  sourceCount: number;
  categoryCount: number;
  topSource: string;
  topCategory: string;
  latestEventDate: string | null;
  latestEventLabel: string;
};

export type ArticleEngagementDashboardData = {
  isConfigured: boolean;
  errorMessage: string | null;
  articleErrorMessage: string | null;
  generatedAt: string;
  summary: ArticleEngagementSummary;
  sourceCategoryRows: ArticleEngagementSourceCategoryRow[];
  topSources: ArticleEngagementRollupRow[];
  topCategories: ArticleEngagementRollupRow[];
  topArticles: ArticleEngagementArticleRow[];
  sourceCategorySql: string;
  articleSql: string;
};

function toNumber(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function cleanLabel(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function latestDate(left: string | null, right: string | null) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return new Date(right).getTime() > new Date(left).getTime() ? right : left;
}

function emptySummary(): ArticleEngagementSummary {
  return {
    totalOutboundClicks: 0,
    totalCategoryInterest: 0,
    totalEngagement: 0,
    sourceCount: 0,
    categoryCount: 0,
    topSource: "No data yet",
    topCategory: "No data yet",
    latestEventDate: null,
    latestEventLabel: "No engagement recorded",
  };
}

function emptyDashboardData(
  errorMessage: string | null = null,
): ArticleEngagementDashboardData {
  return {
    isConfigured: !errorMessage,
    errorMessage,
    articleErrorMessage: null,
    generatedAt: new Date().toISOString(),
    summary: emptySummary(),
    sourceCategoryRows: [],
    topSources: [],
    topCategories: [],
    topArticles: [],
    sourceCategorySql: buildSourceCategorySql(),
    articleSql: buildArticleSql(),
  };
}

function buildSourceCategorySql() {
  return `select\n  source,\n  category,\n  outbound_click_count,\n  category_interest_count,\n  total_engagement_count,\n  first_event_date,\n  latest_event_date,\n  last_updated_at\nfrom public.article_engagement_source_category_summary\norder by total_engagement_count desc, latest_event_date desc nulls last\nlimit ${ENGAGEMENT_SOURCE_CATEGORY_LIMIT};`;
}

function buildArticleSql() {
  return `select\n  article_id,\n  title,\n  original_url,\n  source,\n  category,\n  outbound_click_count,\n  first_event_date,\n  latest_event_date,\n  last_updated_at\nfrom public.article_engagement_article_summary\norder by outbound_click_count desc, latest_event_date desc nulls last\nlimit ${ENGAGEMENT_ARTICLE_LIMIT};`;
}

async function loadSourceCategoryRows(client: SupabaseClient) {
  const { data, error } = await client
    .from("article_engagement_source_category_summary")
    .select(SOURCE_CATEGORY_SELECT_COLUMNS)
    .order("total_engagement_count", { ascending: false })
    .order("latest_event_date", { ascending: false, nullsFirst: false })
    .limit(ENGAGEMENT_SOURCE_CATEGORY_LIMIT);

  if (error) {
    return {
      sourceCategoryRows: [],
      sourceCategoryError: error.message,
    };
  }

  return {
    sourceCategoryRows: (data ?? []) as unknown as SourceCategoryDbRow[],
    sourceCategoryError: null,
  };
}

async function loadArticleRows(client: SupabaseClient) {
  const { data, error } = await client
    .from("article_engagement_article_summary")
    .select(ARTICLE_SELECT_COLUMNS)
    .order("outbound_click_count", { ascending: false })
    .order("latest_event_date", { ascending: false, nullsFirst: false })
    .limit(ENGAGEMENT_ARTICLE_LIMIT);

  if (error) {
    return {
      articleRows: [],
      articleError: error.message,
    };
  }

  return {
    articleRows: (data ?? []) as unknown as ArticleEngagementDbRow[],
    articleError: null,
  };
}

function mapSourceCategoryRow(
  row: SourceCategoryDbRow,
): ArticleEngagementSourceCategoryRow {
  const latestEventDate = row.last_updated_at ?? row.latest_event_date ?? null;

  return {
    source: cleanLabel(row.source, "unknown"),
    category: cleanLabel(row.category, "uncategorized"),
    outboundClickCount: toNumber(row.outbound_click_count),
    categoryInterestCount: toNumber(row.category_interest_count),
    totalEngagementCount: toNumber(row.total_engagement_count),
    firstEventDate: row.first_event_date ?? null,
    latestEventDate,
    latestEventLabel: formatAdminDateTime(latestEventDate, "No events"),
    lastUpdatedAt: row.last_updated_at ?? null,
  };
}

function mapArticleRow(row: ArticleEngagementDbRow): ArticleEngagementArticleRow {
  const latestEventDate = row.last_updated_at ?? row.latest_event_date ?? null;

  return {
    articleId: cleanLabel(row.article_id, "unknown"),
    title: cleanLabel(row.title, "Unknown article"),
    originalUrl: row.original_url ?? null,
    source: cleanLabel(row.source, "unknown"),
    category: cleanLabel(row.category, "uncategorized"),
    outboundClickCount: toNumber(row.outbound_click_count),
    latestEventDate,
    latestEventLabel: formatAdminDateTime(latestEventDate, "No events"),
  };
}

function rollUpRows(
  rows: ArticleEngagementSourceCategoryRow[],
  key: "source" | "category",
): ArticleEngagementRollupRow[] {
  const rollups = new Map<string, ArticleEngagementRollupRow>();

  for (const row of rows) {
    const label = row[key];
    const existing =
      rollups.get(label) ??
      {
        label,
        outboundClickCount: 0,
        categoryInterestCount: 0,
        totalEngagementCount: 0,
        latestEventDate: null,
        latestEventLabel: "No events",
      };

    existing.outboundClickCount += row.outboundClickCount;
    existing.categoryInterestCount += row.categoryInterestCount;
    existing.totalEngagementCount += row.totalEngagementCount;
    existing.latestEventDate = latestDate(existing.latestEventDate, row.latestEventDate);
    existing.latestEventLabel = formatAdminDateTime(
      existing.latestEventDate,
      "No events",
    );
    rollups.set(label, existing);
  }

  return Array.from(rollups.values()).sort((left, right) => {
    if (right.totalEngagementCount !== left.totalEngagementCount) {
      return right.totalEngagementCount - left.totalEngagementCount;
    }

    return left.label.localeCompare(right.label);
  });
}

function summarizeRows(
  rows: ArticleEngagementSourceCategoryRow[],
  topSources: ArticleEngagementRollupRow[],
  topCategories: ArticleEngagementRollupRow[],
): ArticleEngagementSummary {
  const latestEventDate = rows.reduce<string | null>(
    (latest, row) => latestDate(latest, row.latestEventDate),
    null,
  );
  const sourceCount = new Set(rows.map((row) => row.source)).size;
  const categoryCount = new Set(rows.map((row) => row.category)).size;
  const totalOutboundClicks = rows.reduce(
    (total, row) => total + row.outboundClickCount,
    0,
  );
  const totalCategoryInterest = rows.reduce(
    (total, row) => total + row.categoryInterestCount,
    0,
  );

  return {
    totalOutboundClicks,
    totalCategoryInterest,
    totalEngagement: totalOutboundClicks + totalCategoryInterest,
    sourceCount,
    categoryCount,
    topSource: topSources[0]?.label ?? "No data yet",
    topCategory: topCategories[0]?.label ?? "No data yet",
    latestEventDate,
    latestEventLabel: formatAdminDateTime(latestEventDate, "No engagement recorded"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredArrayField<T>(row: Record<string, unknown>, field: string): T[] {
  const value = row[field];

  if (!Array.isArray(value)) {
    throw new Error(
      `Admin article engagement operation returned an invalid ${field} array.`,
    );
  }

  return value as T[];
}

function optionalStringField(row: Record<string, unknown>, field: string) {
  const value = row[field];

  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeArticleEngagementDatabaseResult(
  result: ArticleEngagementDatabaseResult,
): ArticleEngagementDatabaseSnapshot {
  const row = result.rows?.[0];

  if (!isRecord(row)) {
    throw new Error("Admin article engagement operation returned no dashboard snapshot row.");
  }

  return {
    sourceCategoryRows: requiredArrayField<SourceCategoryDbRow>(
      row,
      "sourceCategoryRows",
    ),
    sourceCategoryError: optionalStringField(row, "sourceCategoryError"),
    articleRows: requiredArrayField<ArticleEngagementDbRow>(row, "articleRows"),
    articleError: optionalStringField(row, "articleError"),
  };
}

async function loadSupabaseArticleEngagementDatabaseSnapshot(
  context: AdminSupabaseDatabaseContext,
) {
  context.getConfig();
  const client = context.getClient();
  const [sourceCategoryResult, articleResult] = await Promise.all([
    loadSourceCategoryRows(client),
    loadArticleRows(client),
  ]);

  return {
    rows: [
      {
        sourceCategoryRows: sourceCategoryResult.sourceCategoryRows,
        sourceCategoryError: sourceCategoryResult.sourceCategoryError,
        articleRows: articleResult.articleRows,
        articleError: articleResult.articleError,
      } as unknown as AdminDatabaseJsonObject,
    ],
    rowCount: 1,
    generatedAt: new Date().toISOString(),
  };
}

async function loadArticleEngagementDatabaseSnapshot() {
  const result = await readAdminDatabase(
    "load-admin-article-engagement",
    {
      sourceCategoryLimit: ENGAGEMENT_SOURCE_CATEGORY_LIMIT,
      articleLimit: ENGAGEMENT_ARTICLE_LIMIT,
    },
    loadSupabaseArticleEngagementDatabaseSnapshot,
    { cache: "no-store" },
  );

  return normalizeArticleEngagementDatabaseResult(
    result as ArticleEngagementDatabaseResult,
  );
}

function articleEngagementDataAccessErrorMessage(error: unknown) {
  if (error instanceof AdminDatabaseAccessError) {
    return error.message;
  }

  if (
    error instanceof Error &&
    /server-side supabase access is not configured/i.test(error.message)
  ) {
    return "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.";
  }

  return error instanceof Error ? error.message : "Unknown article engagement load failure.";
}

export async function getAdminArticleEngagementDashboardData(): Promise<ArticleEngagementDashboardData> {
  let snapshot: ArticleEngagementDatabaseSnapshot;

  try {
    snapshot = await loadArticleEngagementDatabaseSnapshot();
  } catch (error) {
    return emptyDashboardData(articleEngagementDataAccessErrorMessage(error));
  }

  if (snapshot.sourceCategoryError) {
    return emptyDashboardData(snapshot.sourceCategoryError);
  }

  const sourceCategoryRows = snapshot.sourceCategoryRows.map(mapSourceCategoryRow);
  const topSources = rollUpRows(sourceCategoryRows, "source");
  const topCategories = rollUpRows(sourceCategoryRows, "category");
  const topArticles = snapshot.articleError
    ? []
    : snapshot.articleRows.map(mapArticleRow);

  return {
    isConfigured: true,
    errorMessage: null,
    articleErrorMessage: snapshot.articleError,
    generatedAt: new Date().toISOString(),
    summary: summarizeRows(sourceCategoryRows, topSources, topCategories),
    sourceCategoryRows,
    topSources,
    topCategories,
    topArticles,
    sourceCategorySql: buildSourceCategorySql(),
    articleSql: buildArticleSql(),
  };
}
