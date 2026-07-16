-- Issue #110: production article_ai_reviews backups contain UUID review IDs.
-- Fresh disposable restore databases must match that schema, but never rewrite
-- a populated bigint table implicitly.

do $$
declare
  current_id_type text;
begin
  select pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
    into current_id_type
  from pg_catalog.pg_attribute attribute
  where attribute.attrelid = 'public.article_ai_reviews'::regclass
    and attribute.attname = 'id'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if current_id_type is null then
    raise exception 'public.article_ai_reviews.id is missing';
  end if;

  if current_id_type = 'uuid' then
    alter table public.article_ai_reviews
      alter column id set default gen_random_uuid();
    return;
  end if;

  if current_id_type <> 'bigint' then
    raise exception 'Unexpected public.article_ai_reviews.id type: %', current_id_type;
  end if;

  if exists (select 1 from public.article_ai_reviews limit 1) then
    raise exception 'Refusing to convert populated public.article_ai_reviews.id from bigint to uuid';
  end if;

  alter table public.article_ai_reviews
    drop constraint if exists article_ai_reviews_pkey;

  alter table public.article_ai_reviews
    drop column id;

  alter table public.article_ai_reviews
    add column id uuid primary key default gen_random_uuid();
end $$;

select public.nutsnews_record_migration_head('20260716170000');
