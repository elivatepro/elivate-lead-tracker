-- LeadTracker Dashboard/List Performance
-- Pushes JS-side full-table aggregation and stale-lead filtering
-- (previously done in /api/dashboard and /api/leads after fetching every
-- row) into Postgres.
--
-- Requires Postgres 15+ (for the `security_invoker` view option below).
-- Run `select version();` to confirm before applying.

-- ============================================================
-- 1. DASHBOARD STATS RPC
-- ============================================================
-- Replicates the exact stats /api/dashboard previously computed in JS.
-- security invoker (not definer) so RLS on `leads`/`stages` still
-- applies based on the calling role — a caller only ever sees stats
-- scoped to workspaces they own, same as today. Fails closed: if RLS
-- would return zero rows for a workspace, so does this function.
--
-- Intentionally does NOT filter archived_at is null, matching the
-- pre-existing dashboard route behavior (archived leads are counted in
-- these stats today; changing that is a separate product decision, not
-- part of this performance change).

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
  where l.workspace_id = p_workspace_id;
$$;

grant execute on function get_dashboard_stats(uuid, text[]) to authenticated;

-- ============================================================
-- 2. LEADS + STALE STATE VIEW
-- ============================================================
-- Backs /api/leads. `security_invoker = true` is required — Postgres
-- views default to running as the view owner otherwise, which would
-- bypass RLS on `leads`/`stages`.

create or replace view leads_sla_state
with (security_invoker = true)
as
select
  l.*,
  jsonb_build_object(
    'name', s.name,
    'sla_days', s.sla_days,
    'is_closed', s.is_closed,
    'color', s.color,
    'position', s.position
  ) as stages,
  (
    not s.is_closed and s.sla_days is not null
    and (l.snoozed_until is null or l.snoozed_until <= now())
    and now() >= l.last_activity_at + (s.sla_days || ' days')::interval
  ) as is_stale
from leads l
join stages s on s.id = l.stage_id;

grant select on leads_sla_state to authenticated;
