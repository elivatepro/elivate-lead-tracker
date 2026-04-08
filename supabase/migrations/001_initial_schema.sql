-- LeadTracker Initial Schema
-- Tables, indexes, RLS policies, triggers, and views

-- ============================================================
-- 1. TABLES
-- ============================================================

-- 1.1 Workspaces
create table workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  required_fields text[] default array['name']::text[],
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_workspaces_owner on workspaces(owner_id);

-- 1.2 Stages
create table stages (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  position      integer not null,
  sla_days      integer,
  is_closed     boolean not null default false,
  color         text default '#c4960a',
  created_at    timestamptz not null default now()
);

create unique index idx_stages_workspace_position on stages(workspace_id, position);
create index idx_stages_workspace on stages(workspace_id);

-- 1.3 Leads
create table leads (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  stage_id        uuid not null references stages(id) on delete restrict,

  name            text not null,
  company         text,
  email           text,
  phone           text,
  source          text,
  value           numeric(12, 2),
  notes           text,
  tags            text[] default array[]::text[],

  last_activity_at timestamptz not null default now(),
  snoozed_until    timestamptz,
  reminder_sent_at timestamptz,
  closed_at        timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_leads_workspace on leads(workspace_id);
create index idx_leads_stage on leads(stage_id);
create index idx_leads_workspace_stage on leads(workspace_id, stage_id);
create index idx_leads_last_activity on leads(last_activity_at);

-- 1.4 Activities
create type activity_type as enum (
  'created',
  'stage_changed',
  'field_edited',
  'note_added',
  'reminder_sent',
  'snoozed',
  'closed'
);

create table activities (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  lead_id       uuid not null references leads(id) on delete cascade,
  type          activity_type not null,
  payload       jsonb,
  actor_id      uuid references auth.users(id),
  created_at    timestamptz not null default now()
);

create index idx_activities_lead on activities(lead_id, created_at desc);
create index idx_activities_workspace on activities(workspace_id, created_at desc);

-- 1.5 Reminders
create table reminders (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  lead_id       uuid not null references leads(id) on delete cascade,
  sent_at       timestamptz not null default now(),
  due_at        timestamptz not null,
  email_id      text,
  status        text default 'sent'
);

create index idx_reminders_lead on reminders(lead_id, sent_at desc);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================

alter table workspaces enable row level security;
alter table stages     enable row level security;
alter table leads      enable row level security;
alter table activities enable row level security;
alter table reminders  enable row level security;

-- Workspaces: users only see/modify workspaces they own
create policy "Users see own workspace" on workspaces
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Stages: users see/modify stages in their workspace
create policy "Users see own stages" on stages
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  )
  with check (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- Leads: same pattern
create policy "Users see own leads" on leads
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  )
  with check (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- Activities: same pattern
create policy "Users see own activities" on activities
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  )
  with check (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- Reminders: same pattern
create policy "Users see own reminders" on reminders
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  )
  with check (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- ============================================================
-- 3. TRIGGERS
-- ============================================================

-- 3.1 Auto-update last_activity_at on lead edit
create or replace function update_lead_activity()
returns trigger as $$
begin
  new.last_activity_at = now();
  new.updated_at = now();
  -- Clear stale reminder when lead is touched
  new.reminder_sent_at = null;
  return new;
end;
$$ language plpgsql;

create trigger trg_lead_updated
  before update on leads
  for each row
  when (old.* is distinct from new.*)
  execute function update_lead_activity();

-- 3.2 Auto-create personal workspace on signup
-- NOTE: Workspace + stage creation is handled in application code (src/app/(auth)/actions.ts)
-- using the service_role key, which bypasses RLS reliably.
-- This avoids trigger permission issues in hosted Supabase environments.

-- ============================================================
-- 4. VIEWS
-- ============================================================

-- Stale leads view (used by the reminder cron job)
create or replace view stale_leads as
select
  l.*,
  s.name as stage_name,
  s.sla_days,
  (l.last_activity_at + (s.sla_days || ' days')::interval) as due_at,
  w.owner_id
from leads l
join stages s on s.id = l.stage_id
join workspaces w on w.id = l.workspace_id
where s.is_closed = false
  and s.sla_days is not null
  and now() >= l.last_activity_at + (s.sla_days || ' days')::interval
  and (l.snoozed_until is null or l.snoozed_until <= now())
  and l.reminder_sent_at is null;
