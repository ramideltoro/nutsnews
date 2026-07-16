-- Issue #212: Supabase grants EXECUTE on new functions to API roles in local
-- stacks. Revoke explicit anon/authenticated grants from privileged helper
-- functions and then add back only the public readiness contract.

revoke all on function public.nutsnews_current_schema_fingerprint() from public, anon, authenticated;
revoke all on function public.nutsnews_record_migration_head(text) from public, anon, authenticated;
revoke all on function public.nutsnews_migration_lock_probe(integer) from public, anon, authenticated;
revoke all on function public.nutsnews_reset_staging_fixture(text) from public, anon, authenticated;
revoke all on function public.nutsnews_cleanup_expired_staging_fixtures() from public, anon, authenticated;

revoke all on function public.nutsnews_migration_schema_contract() from public, anon, authenticated;
grant execute on function public.nutsnews_migration_schema_contract() to anon, authenticated;

grant execute on function public.nutsnews_migration_lock_probe(integer) to service_role;
grant execute on function public.nutsnews_reset_staging_fixture(text) to service_role;
grant execute on function public.nutsnews_cleanup_expired_staging_fixtures() to service_role;

select public.nutsnews_record_migration_head('20260716090000');
