-- Issue #109: keep the legacy release_readiness marker intact during the
-- expand/contract window. Older app digests read only that marker; newer
-- digests additionally require this migration-head and catalog-fingerprint
-- contract before they report ready.

create table if not exists public.migration_schema_contract (
  singleton boolean primary key default true check (singleton),
  migration_head text not null check (migration_head ~ '^[0-9]{14}$'),
  schema_fingerprint text not null check (schema_fingerprint ~ '^[a-f0-9]{32}$'),
  recorded_at timestamptz not null default now()
);

alter table public.migration_schema_contract enable row level security;

create table if not exists public.staging_fixture_runs (
  namespace text primary key check (namespace ~ '^nutsnews-test-[a-z0-9][a-z0-9-]{5,96}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table if not exists public.staging_fixture_users (
  namespace text primary key references public.staging_fixture_runs(namespace) on delete cascade,
  user_id uuid not null unique
);

alter table public.staging_fixture_runs enable row level security;
alter table public.staging_fixture_users enable row level security;

-- This is a deterministic catalog signature rather than a dump. It covers
-- public relations, columns/defaults, constraints, indexes, and RLS state;
-- it deliberately excludes row data and secrets.
create or replace function public.nutsnews_current_schema_fingerprint()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with schema_entries as (
    select format(
      'relation:%s:%s:%s:%s',
      c.relkind,
      c.relname,
      c.relrowsecurity,
      c.relforcerowsecurity
    ) as entry
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'm', 'v')

    union all

    select format(
      'column:%s:%s:%s:%s:%s:%s',
      c.relname,
      a.attname,
      pg_catalog.format_type(a.atttypid, a.atttypmod),
      a.attnotnull,
      coalesce(pg_catalog.pg_get_expr(ad.adbin, ad.adrelid), ''),
      a.attidentity
    ) as entry
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    left join pg_catalog.pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
    where n.nspname = 'public'
      and c.relkind in ('r', 'm', 'v')
      and a.attnum > 0
      and not a.attisdropped

    union all

    select format('constraint:%s:%s:%s', c.relname, con.conname, pg_catalog.pg_get_constraintdef(con.oid, true))
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_class c on c.oid = con.conrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'

    union all

    select format('index:%s:%s', c.relname, pg_catalog.pg_get_indexdef(i.indexrelid))
    from pg_catalog.pg_index i
    join pg_catalog.pg_class c on c.oid = i.indrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'

    union all

    select format(
      'policy:%s:%s:%s:%s:%s:%s',
      c.relname,
      policy.polname,
      policy.polcmd,
      policy.polpermissive,
      coalesce(pg_catalog.pg_get_expr(policy.polqual, policy.polrelid), ''),
      coalesce(pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid), '')
    )
    from pg_catalog.pg_policy policy
    join pg_catalog.pg_class c on c.oid = policy.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'

    union all

    select format(
      'function:%s:%s:%s',
      procedure.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid),
      pg_catalog.pg_get_functiondef(procedure.oid)
    )
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace n on n.oid = procedure.pronamespace
    where n.nspname = 'public'
  )
  select md5(coalesce(string_agg(entry, E'\n' order by entry), ''))
  from schema_entries;
$$;

create or replace function public.nutsnews_record_migration_head(p_migration_head text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_migration_head !~ '^[0-9]{14}$' then
    raise exception 'migration head must be a 14-digit version';
  end if;

  insert into public.migration_schema_contract (
    singleton,
    migration_head,
    schema_fingerprint,
    recorded_at
  )
  values (
    true,
    p_migration_head,
    public.nutsnews_current_schema_fingerprint(),
    now()
  )
  on conflict (singleton) do update
  set migration_head = excluded.migration_head,
      schema_fingerprint = excluded.schema_fingerprint,
      recorded_at = excluded.recorded_at;
end;
$$;

create or replace function public.nutsnews_migration_schema_contract()
returns table(
  legacy_schema_version text,
  migration_head text,
  expected_schema_fingerprint text,
  actual_schema_fingerprint text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    readiness.schema_version,
    contract.migration_head,
    contract.schema_fingerprint,
    public.nutsnews_current_schema_fingerprint()
  from public.release_readiness readiness
  join public.migration_schema_contract contract on contract.singleton = true
  where readiness.singleton = true;
$$;

-- The lock probe is only used by the disposable-database CI regression. The
-- production/staging migration command below uses the same advisory-lock key
-- while it runs `supabase db push`.
create or replace function public.nutsnews_migration_lock_probe(hold_milliseconds integer default 0)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if hold_milliseconds < 0 or hold_milliseconds > 5000 then
    raise exception 'hold_milliseconds must be between 0 and 5000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('nutsnews:migration-workflow'));
  perform pg_catalog.pg_sleep(hold_milliseconds / 1000.0);
  return 'locked';
end;
$$;

create or replace function public.nutsnews_reset_staging_fixture(p_namespace text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  deleted_summaries integer := 0;
  deleted_articles integer := 0;
  deleted_feeds integer := 0;
  deleted_events integer := 0;
  deleted_users integer := 0;
begin
  if p_namespace !~ '^nutsnews-test-[a-z0-9][a-z0-9-]{5,96}$' then
    raise exception 'staging fixture namespace is invalid';
  end if;

  delete from public.article_summaries
  where original_url like ('https://fixture.invalid/' || p_namespace || '/%');
  get diagnostics deleted_summaries = row_count;

  delete from public.articles
  where original_url like ('https://fixture.invalid/' || p_namespace || '/%');
  get diagnostics deleted_articles = row_count;

  delete from public.rss_feeds
  where url like ('https://fixture.invalid/' || p_namespace || '/%');
  get diagnostics deleted_feeds = row_count;

  delete from public.quota_usage_events
  where metadata ->> 'fixture_namespace' = p_namespace;
  get diagnostics deleted_events = row_count;

  delete from auth.users
  where id in (
    select user_id from public.staging_fixture_users where namespace = p_namespace
  );
  get diagnostics deleted_users = row_count;

  delete from public.staging_fixture_runs where namespace = p_namespace;

  return jsonb_build_object(
    'articles', deleted_articles,
    'translations', deleted_summaries,
    'feeds', deleted_feeds,
    'write_events', deleted_events,
    'users', deleted_users
  );
end;
$$;

create or replace function public.nutsnews_cleanup_expired_staging_fixtures()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  fixture record;
  cleaned integer := 0;
begin
  for fixture in
    select namespace
    from public.staging_fixture_runs
    where expires_at <= now()
  loop
    perform public.nutsnews_reset_staging_fixture(fixture.namespace);
    cleaned := cleaned + 1;
  end loop;

  return cleaned;
end;
$$;

revoke all on table public.migration_schema_contract from anon, authenticated;
revoke all on table public.staging_fixture_runs from anon, authenticated;
revoke all on table public.staging_fixture_users from anon, authenticated;
revoke all on function public.nutsnews_current_schema_fingerprint() from public;
revoke all on function public.nutsnews_record_migration_head(text) from public;
revoke all on function public.nutsnews_migration_schema_contract() from public;
revoke all on function public.nutsnews_migration_lock_probe(integer) from public;
revoke all on function public.nutsnews_reset_staging_fixture(text) from public;
revoke all on function public.nutsnews_cleanup_expired_staging_fixtures() from public;

grant execute on function public.nutsnews_migration_schema_contract() to anon, authenticated;
grant execute on function public.nutsnews_migration_lock_probe(integer) to service_role;
grant execute on function public.nutsnews_reset_staging_fixture(text) to service_role;
grant execute on function public.nutsnews_cleanup_expired_staging_fixtures() to service_role;

select public.nutsnews_record_migration_head('20260713000000');

comment on table public.migration_schema_contract is
  'Migration-head and catalog fingerprint. Updated only by the locked migration workflow.';
comment on table public.staging_fixture_runs is
  'Synthetic staging fixture namespaces with bounded TTL; production data is never seeded here.';
