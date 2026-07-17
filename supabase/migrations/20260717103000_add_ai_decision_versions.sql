-- Issue #98: make AI decisions auditable by prompt/model version.
--
-- Writers can pass prompt_version and model_version with each review. Existing
-- rows remain traceable through a legacy marker, and future rows derive
-- model_version from ai_model when a caller has not supplied a separate value.

alter table public.article_ai_reviews
  add column if not exists prompt_version text default 'legacy-unversioned',
  add column if not exists model_version text default 'model-unset';

update public.article_ai_reviews
set prompt_version = 'legacy-unversioned'
where prompt_version is null
  or btrim(prompt_version) = '';

update public.article_ai_reviews
set model_version = coalesce(nullif(btrim(ai_model), ''), 'unknown-model')
where model_version is null
  or btrim(model_version) = ''
  or model_version = 'model-unset';

alter table public.article_ai_reviews
  alter column prompt_version set not null,
  alter column prompt_version set default 'legacy-unversioned',
  alter column model_version set not null,
  alter column model_version set default 'model-unset';

alter table public.article_ai_reviews
  add constraint article_ai_reviews_prompt_version_format_check
    check (prompt_version ~ '^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,95}$')
    not valid,
  add constraint article_ai_reviews_model_version_format_check
    check (model_version ~ '^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,95}$')
    not valid;

alter table public.article_ai_reviews
  validate constraint article_ai_reviews_prompt_version_format_check,
  validate constraint article_ai_reviews_model_version_format_check;

create or replace function public.set_article_ai_review_versions()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.prompt_version is null or btrim(new.prompt_version) = '' then
    new.prompt_version := 'legacy-unversioned';
  else
    new.prompt_version := btrim(new.prompt_version);
  end if;

  if new.model_version is null
    or btrim(new.model_version) = ''
    or new.model_version = 'model-unset' then
    new.model_version := coalesce(nullif(btrim(new.ai_model), ''), 'unknown-model');
  else
    new.model_version := btrim(new.model_version);
  end if;

  return new;
end;
$$;

drop trigger if exists set_article_ai_review_versions_trigger
  on public.article_ai_reviews;

create trigger set_article_ai_review_versions_trigger
  before insert or update of prompt_version, model_version, ai_model
  on public.article_ai_reviews
  for each row
  execute function public.set_article_ai_review_versions();

create index if not exists article_ai_reviews_prompt_model_version_reviewed_idx
  on public.article_ai_reviews (prompt_version, model_version, reviewed_at desc);

create index if not exists article_ai_reviews_version_decision_reviewed_idx
  on public.article_ai_reviews (prompt_version, model_version, decision, reviewed_at desc);

comment on column public.article_ai_reviews.prompt_version is
  'Prompt version that produced the AI review decision. legacy-unversioned marks rows created before explicit version tracking.';

comment on column public.article_ai_reviews.model_version is
  'Model version or model release identifier that produced the AI review decision. Defaults from ai_model when callers do not provide a separate value.';

create or replace view public.ai_decision_version_report as
with version_counts as (
  select
    coalesce(nullif(btrim(prompt_version), ''), 'legacy-unversioned') as prompt_version,
    coalesce(nullif(btrim(model_version), ''), coalesce(nullif(btrim(ai_model), ''), 'unknown-model')) as model_version,
    coalesce(nullif(btrim(ai_provider), ''), 'openai') as ai_provider,
    coalesce(nullif(btrim(ai_model), ''), 'unknown-model') as ai_model,
    min(reviewed_at) as first_reviewed_at,
    max(reviewed_at) as latest_reviewed_at,
    count(*)::integer as total_reviews,
    count(*) filter (where decision = 'accept')::integer as accepted_reviews,
    count(*) filter (where decision = 'reject')::integer as rejected_reviews,
    round((count(*) filter (where decision = 'accept'))::numeric / nullif(count(*), 0)::numeric * 100, 2) as acceptance_rate_pct,
    round((count(*) filter (where decision = 'reject'))::numeric / nullif(count(*), 0)::numeric * 100, 2) as rejection_rate_pct,
    round(avg(positivity_score)::numeric, 2) as average_positivity_score
  from public.article_ai_reviews
  group by 1, 2, 3, 4
),
ranked_versions as (
  select
    version_counts.*,
    row_number() over (
      order by
        latest_reviewed_at desc nulls last,
        prompt_version desc,
        model_version desc,
        ai_provider desc,
        ai_model desc
    )::integer as version_rank
  from version_counts
),
compared_versions as (
  select
    ranked_versions.*,
    lead(acceptance_rate_pct) over (order by version_rank) as previous_acceptance_rate_pct,
    lead(rejection_rate_pct) over (order by version_rank) as previous_rejection_rate_pct,
    lead(average_positivity_score) over (order by version_rank) as previous_average_positivity_score
  from ranked_versions
)
select
  case
    when version_rank = 1 then 'current'
    when version_rank = 2 then 'previous'
    else 'historical'
  end as version_window,
  version_rank,
  prompt_version,
  model_version,
  ai_provider,
  ai_model,
  total_reviews,
  accepted_reviews,
  rejected_reviews,
  acceptance_rate_pct,
  rejection_rate_pct,
  average_positivity_score,
  previous_acceptance_rate_pct,
  previous_rejection_rate_pct,
  previous_average_positivity_score,
  round(acceptance_rate_pct - previous_acceptance_rate_pct, 2) as acceptance_rate_delta_pct,
  round(rejection_rate_pct - previous_rejection_rate_pct, 2) as rejection_rate_delta_pct,
  round(average_positivity_score - previous_average_positivity_score, 2) as average_score_delta,
  first_reviewed_at,
  latest_reviewed_at
from compared_versions;

revoke all on public.ai_decision_version_report from anon, authenticated;
grant select on public.ai_decision_version_report to service_role;

select public.nutsnews_record_migration_head('20260717103000');
