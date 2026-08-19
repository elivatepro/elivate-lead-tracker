-- LeadTracker Email + Archive Schema
-- SMTP settings, email queue/log, lead archiving, email_sent activity type

-- ============================================================
-- 1. WORKSPACE EMAIL SETTINGS
-- ============================================================

alter table workspaces
  add column smtp_host            text,
  add column smtp_port            integer not null default 587,
  add column smtp_user            text,
  add column smtp_pass_encrypted  text,
  add column email_from_name      text,
  add column email_signature      text,
  add column email_batch_size     integer not null default 10,
  add column email_batch_delay    integer not null default 5;

-- ============================================================
-- 2. LEAD ARCHIVING
-- ============================================================

alter table leads
  add column archived_at timestamptz;

create index idx_leads_workspace_active
  on leads(workspace_id)
  where archived_at is null;

-- ============================================================
-- 3. EMAIL QUEUE + LOG
-- ============================================================

create table email_queue (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  lead_id       uuid not null references leads(id) on delete cascade,
  from_email    text not null,
  from_name     text,
  to_email      text not null,
  subject       text not null,
  body_html     text,
  scheduled_for timestamptz not null default now(),
  status        text not null default 'pending', -- pending | sending | failed
  error         text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index idx_email_queue_pending
  on email_queue(status, scheduled_for)
  where status = 'pending';

create index idx_email_queue_workspace on email_queue(workspace_id);

create table email_log (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  lead_id       uuid not null references leads(id) on delete cascade,
  to_email      text not null,
  subject       text not null,
  status        text not null default 'sent', -- sent | failed
  error         text,
  sent_at       timestamptz not null default now()
);

create index idx_email_log_lead on email_log(lead_id, sent_at desc);
create index idx_email_log_workspace on email_log(workspace_id, sent_at desc);

-- ============================================================
-- 4. ACTIVITY TYPE FOR SENT EMAILS
-- ============================================================

alter type activity_type add value if not exists 'email_sent';
alter type activity_type add value if not exists 'archived';
alter type activity_type add value if not exists 'restored';

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

alter table email_queue enable row level security;
alter table email_log  enable row level security;

create policy "Users manage own email queue" on email_queue
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  )
  with check (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "Users see own email log" on email_log
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  )
  with check (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- ============================================================
-- 6. KEEP ARCHIVED LEADS OUT OF REMINDERS
-- ============================================================

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
  and l.reminder_sent_at is null
  and l.archived_at is null;
