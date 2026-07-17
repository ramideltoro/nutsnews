-- Issue #22: aggregate article engagement analytics without visitor tracking.
--
-- This stores daily counters only. It intentionally does not store reader IDs,
-- cookies, IP addresses, user agents, referrers, raw outbound URLs, or titles
-- from the browser event payload.

create table if not exists public.article_engagement_daily (
  event_date date not null default current_date,
  event_type text not null,
  article_id uuid not null default '00000000-0000-0000-0000-000000000000'::uuid,
  source text not null default 'unknown',
  category text not null default 'uncategorized',
  quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_engagement_daily_event_type_check
    check (event_type in ('outbound_click', 'category_interest')),
  constraint article_engagement_daily_source_check
    check (char_length(source) between 1 and 160 and source !~ '[[:cntrl:]]'),
  constraint article_engagement_daily_category_check
    check (char_length(category) between 1 and 96 and category !~ '[[:cntrl:]]'),
  constraint article_engagement_daily_quantity_check
    check (quantity >= 0),
  constraint article_engagement_daily_pkey
    primary key (event_date, event_type, article_id, source, category)
);

alter table public.article_engagement_daily enable row level security;

revoke all on public.article_engagement_daily from anon, authenticated;
grant select, insert, update on public.article_engagement_daily to service_role;

comment on table public.article_engagement_daily is
  'Daily aggregate article engagement counters. Privacy boundary: no visitor identifiers, raw URLs, referrers, IP addresses, user agents, cookies, or browser fingerprints.';

comment on column public.article_engagement_daily.article_id is
  'Published article ID for outbound_click rows. Category interest rows use the nil UUID sentinel so no per-reader path is stored.';

create index if not exists article_engagement_daily_latest_idx
  on public.article_engagement_daily (event_date desc, updated_at desc);

create index if not exists article_engagement_daily_source_category_idx
  on public.article_engagement_daily (source, category, event_date desc);

create or replace function public.record_article_engagement_event(
  p_event_type text,
  p_article_id uuid default null,
  p_source text default null,
  p_category text default null,
  p_quantity integer default 1
)
returns public.article_engagement_daily
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  nil_article_id constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  clean_event_type text := lower(btrim(coalesce(p_event_type, '')));
  clean_article_id uuid := coalesce(p_article_id, nil_article_id);
  clean_source text := left(
    regexp_replace(coalesce(nullif(btrim(p_source), ''), 'unknown'), '[[:cntrl:]]', '', 'g'),
    160
  );
  clean_category text := left(
    regexp_replace(coalesce(nullif(btrim(p_category), ''), 'uncategorized'), '[[:cntrl:]]', '', 'g'),
    96
  );
  clean_quantity integer := greatest(1, least(coalesce(p_quantity, 1), 10));
  recorded_row public.article_engagement_daily;
begin
  if clean_event_type not in ('outbound_click', 'category_interest') then
    raise exception 'Unsupported article engagement event type: %', p_event_type
      using errcode = '22023';
  end if;

  if clean_source = '' then
    clean_source := 'unknown';
  end if;

  if clean_category = '' or lower(clean_category) = 'all' then
    clean_category := 'uncategorized';
  end if;

  if clean_event_type = 'category_interest' then
    clean_article_id := nil_article_id;
  end if;

  insert into public.article_engagement_daily (
    event_date,
    event_type,
    article_id,
    source,
    category,
    quantity
  )
  values (
    current_date,
    clean_event_type,
    clean_article_id,
    clean_source,
    clean_category,
    clean_quantity
  )
  on conflict (event_date, event_type, article_id, source, category)
  do update set
    quantity = public.article_engagement_daily.quantity + excluded.quantity,
    updated_at = now()
  returning * into recorded_row;

  return recorded_row;
end;
$$;

revoke all on function public.record_article_engagement_event(text, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.record_article_engagement_event(text, uuid, text, text, integer)
  to service_role;

comment on function public.record_article_engagement_event(text, uuid, text, text, integer) is
  'Upserts one privacy-preserving aggregate engagement counter. Callers supply only event type, article ID, source, category, and bounded quantity.';

create or replace view public.article_engagement_source_category_summary as
select
  source,
  category,
  coalesce(sum(quantity) filter (where event_type = 'outbound_click'), 0)::integer as outbound_click_count,
  coalesce(sum(quantity) filter (where event_type = 'category_interest'), 0)::integer as category_interest_count,
  coalesce(sum(quantity), 0)::integer as total_engagement_count,
  min(event_date) as first_event_date,
  max(event_date) as latest_event_date,
  max(updated_at) as last_updated_at
from public.article_engagement_daily
group by source, category;

create or replace view public.article_engagement_article_summary as
select
  engagement.article_id,
  coalesce(nullif(btrim(articles.title), ''), 'Unknown article') as title,
  articles.original_url,
  engagement.source,
  engagement.category,
  coalesce(sum(engagement.quantity), 0)::integer as outbound_click_count,
  min(engagement.event_date) as first_event_date,
  max(engagement.event_date) as latest_event_date,
  max(engagement.updated_at) as last_updated_at
from public.article_engagement_daily engagement
left join public.articles articles
  on articles.id = engagement.article_id
where engagement.event_type = 'outbound_click'
  and engagement.article_id <> '00000000-0000-0000-0000-000000000000'::uuid
group by
  engagement.article_id,
  articles.title,
  articles.original_url,
  engagement.source,
  engagement.category;

revoke all on public.article_engagement_source_category_summary from anon, authenticated;
revoke all on public.article_engagement_article_summary from anon, authenticated;
grant select on public.article_engagement_source_category_summary to service_role;
grant select on public.article_engagement_article_summary to service_role;

select public.nutsnews_record_migration_head('20260717113000');
