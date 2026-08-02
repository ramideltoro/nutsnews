-- Keep PostgREST schema-cache rebuilds from failing when constrained production
-- compute needs longer than the default authenticator timeout. Request roles
-- retain their own shorter limits (anon 3s, authenticated 8s).
alter role authenticator set statement_timeout = '120s';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

select public.nutsnews_record_migration_head('20260802040522');
