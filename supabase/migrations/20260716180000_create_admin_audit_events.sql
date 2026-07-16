-- Issue #112: sensitive admin actions need a durable, protected audit trail.

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_email text not null check (
    actor_email = lower(actor_email)
    and position('@' in actor_email) > 1
    and length(actor_email) <= 320
  ),
  action text not null check (action ~ '^[a-z0-9_.:-]{3,96}$'),
  target_type text not null check (target_type ~ '^[a-z0-9_.:-]{3,96}$'),
  target_id text,
  target_label text,
  before_values jsonb not null default '{}'::jsonb check (jsonb_typeof(before_values) = 'object'),
  after_values jsonb not null default '{}'::jsonb check (jsonb_typeof(after_values) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index if not exists admin_audit_events_created_at_idx
  on public.admin_audit_events (created_at desc);

create index if not exists admin_audit_events_action_created_at_idx
  on public.admin_audit_events (action, created_at desc);

create index if not exists admin_audit_events_target_idx
  on public.admin_audit_events (target_type, target_id, created_at desc);

alter table public.admin_audit_events enable row level security;

revoke all on table public.admin_audit_events from anon, authenticated;
grant select, insert on table public.admin_audit_events to service_role;

comment on table public.admin_audit_events is
  'Protected append-only admin audit events for sensitive operational changes. Read and write only from server-side service-role admin code.';

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
  set is_active = p_is_active
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
      'is_positive_source', feed_before.is_positive_source
    ),
    jsonb_build_object(
      'id', feed_after.id,
      'source', feed_after.source,
      'url', feed_after.url,
      'is_active', feed_after.is_active,
      'is_positive_source', feed_after.is_positive_source
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
  'Atomically updates rss_feeds.is_active and appends the matching protected admin audit event.';

select public.nutsnews_record_migration_head('20260716180000');
