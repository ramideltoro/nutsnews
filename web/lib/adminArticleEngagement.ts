import { formatAdminDateTime } from "@/lib/adminTime";
import { getServerSupabase, getServerSupabaseConfig } from "@/lib/supabase";

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

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

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

function getSupabaseConfig(): SupabaseConfig | null {
  try {
    return getServerSupabaseConfig();
  } catch {
    return null;
  }
}

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
  return `select\n  article_id,\n  title,\n  source,\n  category,\n  outbound_click_count,\n  latest_event_date,\n  last_updated_at\nfrom public.article_engagement_article_summary\norder by outbound_click_count desc, latest_event_date desc nulls last\nlimit ${ENGAGEMENT_ARTICLE_LIMIT};`;
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

export async function getAdminArticleEngagementDashboardData(): Promise<ArticleEngagementDashboardData> {
  const config = getSupabaseConfig();

  if (!config) {
    return emptyDashboardData(
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
  }

  const client = getServerSupabase();
  const [sourceCategoryResult, articleResult] = await Promise.all([
    client
      .from("article_engagement_source_category_summary")
      .select(SOURCE_CATEGORY_SELECT_COLUMNS)
      .order("total_engagement_count", { ascending: false })
      .order("latest_event_date", { ascending: false, nullsFirst: false })
      .limit(ENGAGEMENT_SOURCE_CATEGORY_LIMIT),
    client
      .from("article_engagement_article_summary")
      .select(ARTICLE_SELECT_COLUMNS)
      .order("outbound_click_count", { ascending: false })
      .order("latest_event_date", { ascending: false, nullsFirst: false })
      .limit(ENGAGEMENT_ARTICLE_LIMIT),
  ]);

  if (sourceCategoryResult.error) {
    return emptyDashboardData(sourceCategoryResult.error.message);
  }

  const sourceCategoryRows = (
    (sourceCategoryResult.data ?? []) as unknown as SourceCategoryDbRow[]
  ).map(mapSourceCategoryRow);
  const topSources = rollUpRows(sourceCategoryRows, "source");
  const topCategories = rollUpRows(sourceCategoryRows, "category");
  const topArticles = articleResult.error
    ? []
    : ((articleResult.data ?? []) as unknown as ArticleEngagementDbRow[]).map(
        mapArticleRow,
      );

  return {
    isConfigured: true,
    errorMessage: null,
    articleErrorMessage: articleResult.error?.message ?? null,
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
