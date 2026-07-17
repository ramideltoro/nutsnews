-- Issue #95: add durable source trust tiers and publisher allowlist state.
--
-- Trust tiers classify RSS publishers independently from transient quality
-- metrics. Admin tier changes are audited, and disabled/blocked sources are
-- kept inactive so Worker shards cannot select them accidentally.

alter table public.rss_feeds
  add column if not exists source_trust_tier text not null default 'experimental';

alter table public.rss_feeds
  add column if not exists publisher_allowlist_status text not null default 'candidate';

update public.rss_feeds
set
  source_trust_tier = case
    when is_active = false then 'disabled'
    when is_positive_source = true then 'trusted'
    else 'experimental'
  end,
  publisher_allowlist_status = case
    when is_active = false then 'blocked'
    when is_positive_source = true then 'allowlisted'
    else 'candidate'
  end
where
  source_trust_tier = 'experimental'
  and publisher_allowlist_status = 'candidate';

alter table public.rss_feeds
  drop constraint if exists rss_feeds_source_trust_tier_check;

alter table public.rss_feeds
  add constraint rss_feeds_source_trust_tier_check
  check (source_trust_tier in ('trusted', 'watchlist', 'experimental', 'disabled'))
  not valid;

alter table public.rss_feeds
  validate constraint rss_feeds_source_trust_tier_check;

alter table public.rss_feeds
  drop constraint if exists rss_feeds_publisher_allowlist_status_check;

alter table public.rss_feeds
  add constraint rss_feeds_publisher_allowlist_status_check
  check (publisher_allowlist_status in ('allowlisted', 'candidate', 'blocked'))
  not valid;

alter table public.rss_feeds
  validate constraint rss_feeds_publisher_allowlist_status_check;

alter table public.rss_feeds
  drop constraint if exists rss_feeds_disabled_tier_inactive_check;

alter table public.rss_feeds
  add constraint rss_feeds_disabled_tier_inactive_check
  check (
    (source_trust_tier = 'disabled') = (publisher_allowlist_status = 'blocked')
    and (source_trust_tier <> 'disabled' or is_active = false)
  )
  not valid;

alter table public.rss_feeds
  validate constraint rss_feeds_disabled_tier_inactive_check;

create index if not exists rss_feeds_source_trust_tier_idx
  on public.rss_feeds (source_trust_tier, is_active, source);

create index if not exists rss_feeds_publisher_allowlist_status_idx
  on public.rss_feeds (publisher_allowlist_status, source);

comment on column public.rss_feeds.source_trust_tier is
  'Admin-managed source trust tier: trusted, watchlist, experimental, or disabled.';

comment on column public.rss_feeds.publisher_allowlist_status is
  'Admin-managed publisher allowlist state: allowlisted, candidate, or blocked.';

create or replace view public.feed_quality_scores as
with reviewed_source_counts as (
  select
    source,
    count(distinct original_url) as unique_reviewed_url_count
  from public.article_ai_reviews
  group by source
),
published_source_counts as (
  select
    source,
    count(distinct original_url) as unique_published_url_count
  from public.articles
  group by source
),
base as (
  select
    rf.id as feed_id,
    rf.source,
    rf.url as feed_url,
    coalesce(rf.is_active, true) as is_active,
    coalesce(rf.is_positive_source, false) as is_positive_source,
    coalesce(nullif(rf.source_trust_tier, ''), 'experimental') as source_trust_tier,
    coalesce(nullif(rf.publisher_allowlist_status, ''), 'candidate') as publisher_allowlist_status,

    fh.id as feed_health_id,
    fh.last_checked_at,
    fh.last_success_at,
    fh.last_failure_at,
    fh.last_status,
    fh.last_error_message,

    coalesce(fh.last_article_count, 0) as last_article_count,
    coalesce(fh.last_image_count, 0) as last_image_count,
    coalesce(fh.last_accepted_count, 0) as last_accepted_count,
    coalesce(fh.last_rejected_count, 0) as last_rejected_count,
    coalesce(fh.consecutive_failure_count, 0) as consecutive_failure_count,

    coalesce(fh.total_fetch_count, 0) as total_fetch_count,
    coalesce(fh.total_success_count, 0) as total_success_count,
    coalesce(fh.total_failure_count, 0) as total_failure_count,
    coalesce(fh.total_article_count, 0) as total_article_count,
    coalesce(fh.total_image_count, 0) as total_image_count,
    coalesce(fh.total_accepted_count, 0) as total_accepted_count,
    coalesce(fh.total_rejected_count, 0) as total_rejected_count,

    coalesce(rsc.unique_reviewed_url_count, 0) as unique_reviewed_url_count,
    coalesce(psc.unique_published_url_count, 0) as unique_published_url_count,
    coalesce(fh.updated_at, rf.created_at) as updated_at
  from public.rss_feeds rf
  left join public.feed_health fh
    on fh.feed_url = rf.url
  left join reviewed_source_counts rsc
    on rsc.source = rf.source
  left join published_source_counts psc
    on psc.source = rf.source
),
rates as (
  select
    base.*,
    case
      when total_fetch_count > 0 then round((total_success_count::numeric / total_fetch_count::numeric) * 100, 2)
      else 0
    end as success_rate_pct,
    case
      when total_article_count > 0 then round((total_image_count::numeric / total_article_count::numeric) * 100, 2)
      else 0
    end as thumbnail_rate_pct,
    case
      when total_accepted_count + total_rejected_count > 0 then round((total_accepted_count::numeric / (total_accepted_count + total_rejected_count)::numeric) * 100, 2)
      else 0
    end as accepted_rate_pct,
    case
      when total_fetch_count > 0 then round((total_failure_count::numeric / total_fetch_count::numeric) * 100, 2)
      else 0
    end as failure_rate_pct,
    case
      when total_article_count > 0 then round((greatest(total_article_count - unique_reviewed_url_count, 0)::numeric / total_article_count::numeric) * 100, 2)
      else 0
    end as duplicate_rate_pct
  from base
),
scored as (
  select
    rates.*,
    least(
      100,
      greatest(
        0,
        round(
          (success_rate_pct * 0.25) +
          (thumbnail_rate_pct * 0.25) +
          (accepted_rate_pct * 0.30) +
          ((100 - failure_rate_pct) * 0.10) +
          ((100 - duplicate_rate_pct) * 0.10) -
          case when not is_active then 10 else 0 end -
          case when total_fetch_count = 0 then 25 else 0 end -
          case when consecutive_failure_count >= 3 then 20 else 0 end
        )
      )
    )::integer as quality_score
  from rates
)
select
  feed_id,
  source,
  feed_url,
  is_active,
  is_positive_source,
  feed_health_id,
  last_checked_at,
  last_success_at,
  last_failure_at,
  last_status,
  last_error_message,
  last_article_count,
  last_image_count,
  last_accepted_count,
  last_rejected_count,
  consecutive_failure_count,
  total_fetch_count,
  total_success_count,
  total_failure_count,
  total_article_count,
  total_image_count,
  total_accepted_count,
  total_rejected_count,
  unique_reviewed_url_count,
  unique_published_url_count,
  success_rate_pct,
  thumbnail_rate_pct,
  accepted_rate_pct,
  failure_rate_pct,
  duplicate_rate_pct,
  quality_score,
  case
    when not is_active then 'inactive'
    when total_fetch_count = 0 then 'untracked'
    when quality_score >= 85 then 'excellent'
    when quality_score >= 70 then 'good'
    when quality_score >= 50 then 'review'
    else 'poor'
  end as quality_grade,
  case
    when not is_active then 'Feed is inactive and skipped by Worker shards.'
    when total_fetch_count = 0 then 'Feed has not been checked yet, so quality cannot be trusted.'
    when consecutive_failure_count >= 3 then 'Feed has repeated consecutive failures.'
    when success_rate_pct < 70 then 'Feed has a low fetch success rate.'
    when total_article_count >= 20 and thumbnail_rate_pct < 10 then 'Feed has poor thumbnail coverage.'
    when total_accepted_count + total_rejected_count >= 5 and accepted_rate_pct < 10 then 'Feed has a low accepted article rate.'
    when duplicate_rate_pct >= 50 then 'Feed appears to return many duplicate or already-seen articles.'
    when quality_score >= 85 then 'Excellent source quality across success, thumbnails, acceptance, failures, and duplicate signals.'
    when quality_score >= 70 then 'Good source quality and worth keeping active.'
    when quality_score >= 50 then 'Usable source, but review before expanding usage.'
    else 'Low source quality. Consider disabling or replacing this feed.'
  end as quality_reason,
  updated_at,
  source_trust_tier,
  publisher_allowlist_status,
  case
    when not is_active then 'disabled'
    when total_fetch_count = 0 then 'experimental'
    when consecutive_failure_count >= 3 then 'watchlist'
    when quality_score < 50 then 'watchlist'
    when quality_score >= 85 and total_accepted_count >= 3 then 'trusted'
    else 'experimental'
  end as recommended_trust_tier,
  case
    when not is_active then 'Feed is inactive; keep it disabled unless intentionally restored.'
    when total_fetch_count = 0 then 'Feed is new or unmeasured; keep it experimental until checks run.'
    when consecutive_failure_count >= 3 then 'Repeated failures recommend watchlist review or disabling.'
    when quality_score < 50 then 'Low quality score recommends watchlist review or disabling.'
    when quality_score >= 85 and total_accepted_count >= 3 then 'Strong quality and accepted output recommend trusted status.'
    else 'Keep experimental until quality history is stronger.'
  end as tier_recommendation_reason
from scored;

comment on view public.feed_quality_scores is
  'Ranks RSS feeds by quality and includes admin-managed source trust tier, publisher allowlist status, and recommended trust tier.';

create or replace function public.set_rss_feed_active_with_audit(
  p_actor_email text,
  p_feed_url text,
  p_is_active boolean
)
returns table (
  feed_id bigint,
  feed_source text,
  feed_url text,
  previous_is_active boolean,
  next_is_active boolean,
  audit_event_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_actor_email text := lower(trim(coalesce(p_actor_email, '')));
  feed_before public.rss_feeds%rowtype;
  feed_after public.rss_feeds%rowtype;
begin
  if normalized_actor_email = '' or position('@' in normalized_actor_email) <= 1 then
    raise exception 'actor_email is required for admin audit logging';
  end if;

  select *
    into feed_before
  from public.rss_feeds
  where url = p_feed_url
  for update;

  if not found then
    raise exception 'RSS feed not found';
  end if;

  update public.rss_feeds
  set
    is_active = p_is_active,
    source_trust_tier = case
      when p_is_active then case
        when feed_before.source_trust_tier = 'disabled' then 'experimental'
        else feed_before.source_trust_tier
      end
      else 'disabled'
    end,
    publisher_allowlist_status = case
      when p_is_active then case
        when feed_before.publisher_allowlist_status = 'blocked' then 'candidate'
        else feed_before.publisher_allowlist_status
      end
      else 'blocked'
    end
  where id = feed_before.id
  returning *
    into feed_after;

  insert into public.admin_audit_events (
    actor_email,
    action,
    target_type,
    target_id,
    target_label,
    before_values,
    after_values,
    metadata
  )
  values (
    normalized_actor_email,
    case when p_is_active then 'rss_feed.enable' else 'rss_feed.disable' end,
    'rss_feed',
    feed_after.id::text,
    feed_after.source,
    jsonb_build_object(
      'id', feed_before.id,
      'source', feed_before.source,
      'url', feed_before.url,
      'is_active', feed_before.is_active,
      'is_positive_source', feed_before.is_positive_source,
      'source_trust_tier', feed_before.source_trust_tier,
      'publisher_allowlist_status', feed_before.publisher_allowlist_status
    ),
    jsonb_build_object(
      'id', feed_after.id,
      'source', feed_after.source,
      'url', feed_after.url,
      'is_active', feed_after.is_active,
      'is_positive_source', feed_after.is_positive_source,
      'source_trust_tier', feed_after.source_trust_tier,
      'publisher_allowlist_status', feed_after.publisher_allowlist_status
    ),
    jsonb_build_object(
      'surface', 'admin_feed_management',
      'operation', 'set_is_active'
    )
  )
  returning id
    into audit_event_id;

  feed_id := feed_after.id;
  feed_source := feed_after.source;
  feed_url := feed_after.url;
  previous_is_active := feed_before.is_active;
  next_is_active := feed_after.is_active;

  return next;
end;
$$;

revoke all on function public.set_rss_feed_active_with_audit(text, text, boolean) from public, anon, authenticated;
grant execute on function public.set_rss_feed_active_with_audit(text, text, boolean) to service_role;

comment on function public.set_rss_feed_active_with_audit(text, text, boolean) is
  'Atomically updates rss_feeds.is_active, keeps trust tier state consistent, and appends the matching protected admin audit event.';

create or replace function public.set_rss_feed_trust_tier_with_audit(
  p_actor_email text,
  p_feed_url text,
  p_source_trust_tier text,
  p_publisher_allowlist_status text
)
returns table (
  feed_id bigint,
  feed_source text,
  feed_url text,
  previous_source_trust_tier text,
  next_source_trust_tier text,
  previous_publisher_allowlist_status text,
  next_publisher_allowlist_status text,
  previous_is_active boolean,
  next_is_active boolean,
  audit_event_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_actor_email text := lower(trim(coalesce(p_actor_email, '')));
  normalized_tier text := lower(trim(coalesce(p_source_trust_tier, '')));
  normalized_allowlist_status text := lower(trim(coalesce(p_publisher_allowlist_status, '')));
  feed_before public.rss_feeds%rowtype;
  feed_after public.rss_feeds%rowtype;
begin
  if normalized_actor_email = '' or position('@' in normalized_actor_email) <= 1 then
    raise exception 'actor_email is required for admin audit logging';
  end if;

  if normalized_tier not in ('trusted', 'watchlist', 'experimental', 'disabled') then
    raise exception 'invalid source trust tier';
  end if;

  if normalized_allowlist_status not in ('allowlisted', 'candidate', 'blocked') then
    raise exception 'invalid publisher allowlist status';
  end if;

  if normalized_tier = 'disabled' or normalized_allowlist_status = 'blocked' then
    normalized_tier := 'disabled';
    normalized_allowlist_status := 'blocked';
  end if;

  select *
    into feed_before
  from public.rss_feeds
  where url = p_feed_url
  for update;

  if not found then
    raise exception 'RSS feed not found';
  end if;

  update public.rss_feeds
  set
    source_trust_tier = normalized_tier,
    publisher_allowlist_status = normalized_allowlist_status,
    is_active = case when normalized_tier = 'disabled' then false else is_active end
  where id = feed_before.id
  returning *
    into feed_after;

  insert into public.admin_audit_events (
    actor_email,
    action,
    target_type,
    target_id,
    target_label,
    before_values,
    after_values,
    metadata
  )
  values (
    normalized_actor_email,
    'rss_feed.trust_tier_update',
    'rss_feed',
    feed_after.id::text,
    feed_after.source,
    jsonb_build_object(
      'id', feed_before.id,
      'source', feed_before.source,
      'url', feed_before.url,
      'is_active', feed_before.is_active,
      'is_positive_source', feed_before.is_positive_source,
      'source_trust_tier', feed_before.source_trust_tier,
      'publisher_allowlist_status', feed_before.publisher_allowlist_status
    ),
    jsonb_build_object(
      'id', feed_after.id,
      'source', feed_after.source,
      'url', feed_after.url,
      'is_active', feed_after.is_active,
      'is_positive_source', feed_after.is_positive_source,
      'source_trust_tier', feed_after.source_trust_tier,
      'publisher_allowlist_status', feed_after.publisher_allowlist_status
    ),
    jsonb_build_object(
      'surface', 'admin_feed_management',
      'operation', 'set_source_trust_tier'
    )
  )
  returning id
    into audit_event_id;

  feed_id := feed_after.id;
  feed_source := feed_after.source;
  feed_url := feed_after.url;
  previous_source_trust_tier := feed_before.source_trust_tier;
  next_source_trust_tier := feed_after.source_trust_tier;
  previous_publisher_allowlist_status := feed_before.publisher_allowlist_status;
  next_publisher_allowlist_status := feed_after.publisher_allowlist_status;
  previous_is_active := feed_before.is_active;
  next_is_active := feed_after.is_active;

  return next;
end;
$$;

revoke all on function public.set_rss_feed_trust_tier_with_audit(text, text, text, text) from public, anon, authenticated;
grant execute on function public.set_rss_feed_trust_tier_with_audit(text, text, text, text) to service_role;

comment on function public.set_rss_feed_trust_tier_with_audit(text, text, text, text) is
  'Atomically updates RSS source trust tier and publisher allowlist status, disables blocked sources, and appends a protected admin audit event.';

select public.nutsnews_record_migration_head('20260717093000');
