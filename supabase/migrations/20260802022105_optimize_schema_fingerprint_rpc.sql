-- Keep the release-readiness RPC below Supabase's anon-role statement timeout.
-- The original fingerprint rendered every catalog object back into SQL with
-- pg_get_* helpers. Under ordinary production load that catalog rendering could
-- exceed the API timeout even though the schema was healthy. Hashing the same
-- underlying catalog attributes directly preserves drift detection without the
-- expensive deparsing work on every readiness request.
create or replace function public.nutsnews_current_schema_fingerprint()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with schema_entries as (
    select concat_ws(
      ':',
      'relation',
      c.relkind,
      c.relname,
      c.relowner,
      c.relpersistence,
      c.relrowsecurity,
      c.relforcerowsecurity,
      c.relreplident,
      c.relacl::text,
      c.reloptions::text
    ) as entry
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'm', 'v')

    union all

    select concat_ws(
      ':',
      'column',
      c.relname,
      a.attname,
      a.atttypid,
      a.atttypmod,
      a.attcollation,
      a.attnotnull,
      a.attidentity,
      a.attgenerated,
      ad.adbin::text
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

    select concat_ws(
      ':',
      'constraint',
      c.relname,
      con.conname,
      con.contype,
      con.condeferrable,
      con.condeferred,
      con.convalidated,
      con.conkey::text,
      con.confrelid,
      con.confkey::text,
      con.confupdtype,
      con.confdeltype,
      con.confmatchtype,
      con.conexclop::text,
      con.conbin::text
    ) as entry
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_class c on c.oid = con.conrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'

    union all

    select concat_ws(
      ':',
      'index',
      table_class.relname,
      index_class.relname,
      access_method.amname,
      index_class.relowner,
      index_class.reloptions::text,
      index_definition.indisunique,
      index_definition.indisprimary,
      index_definition.indisexclusion,
      index_definition.indimmediate,
      index_definition.indisclustered,
      index_definition.indisvalid,
      index_definition.indisready,
      index_definition.indislive,
      index_definition.indisreplident,
      index_definition.indkey::text,
      index_definition.indcollation::text,
      index_definition.indclass::text,
      index_definition.indoption::text,
      index_definition.indexprs::text,
      index_definition.indpred::text
    ) as entry
    from pg_catalog.pg_index index_definition
    join pg_catalog.pg_class table_class on table_class.oid = index_definition.indrelid
    join pg_catalog.pg_class index_class on index_class.oid = index_definition.indexrelid
    join pg_catalog.pg_namespace n on n.oid = table_class.relnamespace
    join pg_catalog.pg_am access_method on access_method.oid = index_class.relam
    where n.nspname = 'public'

    union all

    select concat_ws(
      ':',
      'policy',
      c.relname,
      policy.polname,
      policy.polcmd,
      policy.polpermissive,
      policy.polroles::text,
      policy.polqual::text,
      policy.polwithcheck::text
    ) as entry
    from pg_catalog.pg_policy policy
    join pg_catalog.pg_class c on c.oid = policy.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'

    union all

    select concat_ws(
      ':',
      'function',
      procedure.proname,
      procedure.proowner,
      language.lanname,
      procedure.prokind,
      procedure.provolatile,
      procedure.proparallel,
      procedure.prosecdef,
      procedure.proleakproof,
      procedure.proisstrict,
      procedure.proretset,
      procedure.prorettype,
      procedure.proargtypes::text,
      procedure.proallargtypes::text,
      procedure.proargmodes::text,
      procedure.proargnames::text,
      procedure.proargdefaults::text,
      procedure.procost,
      procedure.prorows,
      procedure.proconfig::text,
      procedure.proacl::text,
      procedure.probin,
      procedure.prosrc,
      procedure.prosqlbody::text
    ) as entry
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace n on n.oid = procedure.pronamespace
    join pg_catalog.pg_language language on language.oid = procedure.prolang
    where n.nspname = 'public'
  )
  select md5(coalesce(string_agg(entry, E'\n' order by entry), ''))
  from schema_entries;
$$;

select public.nutsnews_record_migration_head('20260802022105');

comment on function public.nutsnews_current_schema_fingerprint() is
  'Fast deterministic public-schema signature for release readiness and drift detection.';
