alter table if exists public.rss_feeds
  drop constraint if exists rss_feeds_google_news_discovery_only_check;

alter table public.rss_feeds
  add constraint rss_feeds_google_news_discovery_only_check
  check (
    is_active = false
    or position('news.google.com' in lower(url)) = 0
  ) not valid;

alter table public.rss_feeds
  validate constraint rss_feeds_google_news_discovery_only_check;

comment on constraint rss_feeds_google_news_discovery_only_check on public.rss_feeds is
  'Google News RSS URLs may be stored for discovery only, but they must not be active primary publishing feeds.';

select public.nutsnews_record_migration_head('20260717032000');
