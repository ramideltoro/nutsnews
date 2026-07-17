-- NutsNews RSS source policy helpers.
--
-- Google News RSS is discovery-only, not a primary publishing source.
-- Keep direct publisher feeds active; keep news.google.com rows inactive.

-- Acceptance check for issue #5. This must return zero.
select count(*) as active_google_feeds
from public.rss_feeds
where is_active = true
  and url ilike '%news.google.com%';

-- Review active source hosts. Active rows should point at direct publisher feeds.
select
  source,
  url
from public.rss_feeds
where is_active = true
order by source asc, url asc;

-- Controlled remediation if a Google News RSS row is accidentally enabled.
update public.rss_feeds
set is_active = false
where is_active = true
  and url ilike '%news.google.com%'
returning id, source, url, is_active;
