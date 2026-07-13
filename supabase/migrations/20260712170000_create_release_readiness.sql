-- Issue #172: this singleton is a deliberately minimal, anonymous read-only
-- schema marker for the web readiness probe. Every compatible migration that
-- changes the app's readiness contract must update this value explicitly.

create table if not exists public.release_readiness (
  singleton boolean primary key default true check (singleton),
  schema_version text not null check (schema_version ~ '^[0-9]{14}$')
);

alter table public.release_readiness enable row level security;

drop policy if exists "Public can read release readiness" on public.release_readiness;
create policy "Public can read release readiness"
on public.release_readiness
for select
to anon, authenticated
using (true);

grant select on table public.release_readiness to anon, authenticated;

insert into public.release_readiness (singleton, schema_version)
values (true, '20260712170000')
on conflict (singleton) do nothing;

comment on table public.release_readiness is
  'Public read-only schema marker used by the NutsNews /readyz dependency check.';
