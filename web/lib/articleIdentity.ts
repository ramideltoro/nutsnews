export type ArticleIdentityFields = {
  id?: string | null;
  original_url?: string | null;
  source?: string | null;
  title?: string | null;
  published_at?: string | null;
  published_on_site_at?: string | null;
};

function cleanIdentityValue(value?: string | null) {
  const cleaned = value?.trim();
  return cleaned || null;
}

export function getArticleIdentityKey(article: ArticleIdentityFields) {
  const id = cleanIdentityValue(article.id);

  if (id) {
    return `id:${id}`;
  }

  const originalUrl = cleanIdentityValue(article.original_url);

  if (originalUrl) {
    return `url:${originalUrl}`;
  }

  const title = cleanIdentityValue(article.title);
  const source = cleanIdentityValue(article.source);
  const publishedAt =
    cleanIdentityValue(article.published_on_site_at) ??
    cleanIdentityValue(article.published_at);

  if (title && (source || publishedAt)) {
    return `fallback:${source ?? ""}|${publishedAt ?? ""}|${title}`;
  }

  return null;
}

export function dedupeArticlesByIdentity<T extends ArticleIdentityFields>(
  articles: T[],
) {
  const seenArticleKeys = new Set<string>();
  const uniqueArticles: T[] = [];

  for (const article of articles) {
    const articleKey = getArticleIdentityKey(article);

    if (articleKey) {
      if (seenArticleKeys.has(articleKey)) {
        continue;
      }

      seenArticleKeys.add(articleKey);
    }

    uniqueArticles.push(article);
  }

  return uniqueArticles;
}
