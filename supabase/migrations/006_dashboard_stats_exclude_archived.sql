-- Archived leads (the "deleted" state in the UI) were still being counted in
-- every dashboard stat. Exclude them. Same signature as 005, so this is a
-- drop-in replacement.

create or replace function get_dashboard_stats(
  p_workspace_id uuid,
  p_required_fields text[]
)
returns table (
  active_leads bigint,
  stale_leads bigint,
  incomplete_leads bigint,
  added_this_week bigint,
  pipeline_value numeric
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    count(*) filter (where not s.is_closed) as active_leads,
    count(*) filter (
      where not s.is_closed and s.sla_days is not null
        and (l.snoozed_until is null or l.snoozed_until <= now())
        and now() >= l.last_activity_at + (s.sla_days || ' days')::interval
    ) as stale_leads,
    count(*) filter (
      where not s.is_closed and exists (
        select 1 from unnest(p_required_fields) as rf
        where nullif(to_jsonb(l) ->> rf, '') is null
      )
    ) as incomplete_leads,
    count(*) filter (where l.created_at >= now() - interval '7 days') as added_this_week,
    coalesce(sum(l.value) filter (where not s.is_closed), 0) as pipeline_value
  from leads l
  join stages s on s.id = l.stage_id
  where l.workspace_id = p_workspace_id
    and l.archived_at is null;
$$;

grant execute on function get_dashboard_stats(uuid, text[]) to authenticated;
