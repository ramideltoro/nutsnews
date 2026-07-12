-- Runtime flags are intentionally limited to documented boolean keys. They are
-- evaluated server-side by the web app and Worker; browser clients cannot read
-- or change this table directly.

create table if not exists public.runtime_feature_flags (
  key text primary key check (
    key in (
      'reader_archive_search',
      'worker_public_feed_edge_snapshot_publish'
    )
  ),
  enabled boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_runtime_feature_flags_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_runtime_feature_flags_updated_at on public.runtime_feature_flags;
create trigger set_runtime_feature_flags_updated_at
before update on public.runtime_feature_flags
for each row
execute function public.set_runtime_feature_flags_updated_at();

revoke execute on function public.set_runtime_feature_flags_updated_at() from public;
grant execute on function public.set_runtime_feature_flags_updated_at() to service_role;

alter table public.runtime_feature_flags enable row level security;

revoke all on table public.runtime_feature_flags from anon, authenticated;
grant select, insert, update, delete on table public.runtime_feature_flags to service_role;

insert into public.runtime_feature_flags (key, enabled)
values
  ('reader_archive_search', true),
  ('worker_public_feed_edge_snapshot_publish', true)
on conflict (key) do nothing;

comment on table public.runtime_feature_flags is
  'Allow-listed runtime boolean feature flags. Only privileged server-side callers may read or update values.';
