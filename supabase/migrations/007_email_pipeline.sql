-- Phase 0: email pipeline hardening.
-- Adds send caps, a suppression list, row claiming/retry state on the queue,
-- and service-role-only RPCs that make claiming and finishing a send atomic.
-- Additive only: the currently deployed code keeps working against this schema.

-- ============================================================
-- 1. WORKSPACE SETTINGS
-- ============================================================

alter table workspaces
  add column if not exists email_hourly_cap int not null default 20
    check (email_hourly_cap between 1 and 500),
  add column if not exists email_daily_cap int not null default 100
    check (email_daily_cap between 1 and 2000),
  add column if not exists email_footer_address text,
  add column if not exists email_reply_to text,
  add column if not exists automations_enabled boolean not null default false;

-- ============================================================
-- 2. QUEUE + LOG COLUMNS
-- ============================================================

alter table email_queue
  add column if not exists body_text text,
  add column if not exists attempts int not null default 0,
  add column if not exists claimed_at timestamptz,
  add column if not exists source text not null default 'manual',
  add column if not exists enrollment_id uuid,
  add column if not exists node_id text,
  add column if not exists idempotency_key text;

create unique index if not exists uq_email_queue_idem
  on email_queue(idempotency_key) where idempotency_key is not null;
create index if not exists idx_email_queue_due
  on email_queue(workspace_id, scheduled_for) where status = 'pending';
create index if not exists idx_email_queue_stale
  on email_queue(claimed_at) where status = 'sending';

alter table email_log
  add column if not exists source text default 'manual',
  add column if not exists enrollment_id uuid,
  add column if not exists message_id text;

create index if not exists idx_email_log_ws_sent
  on email_log(workspace_id, sent_at desc) where status = 'sent';

alter type activity_type add value if not exists 'unsubscribed';

-- ============================================================
-- 3. SUPPRESSION LIST
-- ============================================================

create table if not exists email_suppressions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email        text not null check (email = lower(btrim(email))),
  reason       text not null check (reason in ('unsubscribe', 'bounce', 'manual')),
  created_at   timestamptz not null default now(),
  unique (workspace_id, email)
);

alter table email_suppressions enable row level security;

create policy "Users manage own suppressions" on email_suppressions
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  )
  with check (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- ============================================================
-- 4. RPCs (service role only — the API routes do the tenant checks)
-- ============================================================

-- Atomically claim due queue rows for one workspace, honouring its hourly and
-- daily caps (counting rows already in flight). Returns the claimed rows.
create or replace function claim_email_queue(p_workspace_id uuid, p_limit int)
returns setof email_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hourly int;
  v_daily int;
  v_sent_hour int;
  v_sent_day int;
  v_inflight int;
  v_room int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 7));

  select email_hourly_cap, email_daily_cap
    into v_hourly, v_daily
    from workspaces where id = p_workspace_id;
  if not found then return; end if;

  select count(*) into v_sent_hour from email_log
    where workspace_id = p_workspace_id and status = 'sent'
      and sent_at > now() - interval '1 hour';
  select count(*) into v_sent_day from email_log
    where workspace_id = p_workspace_id and status = 'sent'
      and sent_at > now() - interval '1 day';
  select count(*) into v_inflight from email_queue
    where workspace_id = p_workspace_id and status = 'sending';

  v_room := least(p_limit, v_hourly - v_sent_hour - v_inflight, v_daily - v_sent_day - v_inflight);
  if v_room <= 0 then return; end if;

  return query
  with picked as (
    select id from email_queue
    where workspace_id = p_workspace_id
      and status = 'pending'
      and scheduled_for <= now()
    order by scheduled_for
    limit v_room
    for update skip locked
  ), claimed as (
    update email_queue q
       set status = 'sending', claimed_at = now(), attempts = q.attempts + 1
      from picked
     where q.id = picked.id
    returning q.*
  )
  select * from claimed;
end;
$$;

-- Finish a claimed row. Idempotent: returns 'noop' if the row is no longer
-- in the 'sending' state.
--   sent / failed / skipped : terminal — logs, deletes the queue row
--   retry                   : back to pending after p_retry_seconds; becomes
--                             failed once 3 attempts are used
--   release                 : back to pending without burning an attempt
--                             (auth problems, worker ran out of time)
create or replace function email_queue_finalize(
  p_id uuid,
  p_outcome text,
  p_error text default null,
  p_message_id text default null,
  p_retry_seconds int default 300
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  q email_queue%rowtype;
  v_status text;
begin
  if p_outcome not in ('sent', 'failed', 'skipped', 'retry', 'release') then
    raise exception 'invalid outcome %', p_outcome;
  end if;

  select * into q from email_queue where id = p_id and status = 'sending' for update;
  if not found then return 'noop'; end if;

  if p_outcome = 'release' then
    update email_queue
       set status = 'pending', claimed_at = null,
           attempts = greatest(attempts - 1, 0), error = p_error,
           scheduled_for = now() + make_interval(secs => greatest(p_retry_seconds, 0))
     where id = q.id;
    return 'released';
  end if;

  if p_outcome = 'retry' and q.attempts < 3 then
    update email_queue
       set status = 'pending', claimed_at = null, error = p_error,
           scheduled_for = now() + make_interval(secs => greatest(p_retry_seconds, 0))
     where id = q.id;
    return 'retried';
  end if;

  v_status := case p_outcome
    when 'sent' then 'sent'
    when 'skipped' then 'skipped'
    else 'failed'
  end;

  delete from email_queue where id = q.id;

  insert into email_log
    (workspace_id, lead_id, to_email, subject, status, error, sent_at, source, enrollment_id, message_id)
  values
    (q.workspace_id, q.lead_id, q.to_email, q.subject, v_status, p_error, now(),
     q.source, q.enrollment_id, p_message_id);

  if v_status = 'sent' then
    insert into activities (workspace_id, lead_id, type, payload)
    values (q.workspace_id, q.lead_id, 'email_sent',
            jsonb_build_object('to', q.to_email, 'subject', q.subject, 'source', q.source));

    -- Only manual sends count as lead activity; automated mail must not
    -- reset the stale-lead SLA clock.
    if q.source = 'manual' then
      update leads set last_activity_at = now() where id = q.lead_id;
    end if;
  end if;

  return v_status;
end;
$$;

-- Add an address to the workspace suppression list, cancel anything still
-- queued for it, and note it on the matching leads' timelines.
create or replace function suppress_email(p_workspace_id uuid, p_email text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_inserted int;
begin
  if p_reason not in ('unsubscribe', 'bounce', 'manual') then
    raise exception 'invalid reason %', p_reason;
  end if;

  insert into email_suppressions (workspace_id, email, reason)
  values (p_workspace_id, v_email, p_reason)
  on conflict (workspace_id, email) do nothing;
  get diagnostics v_inserted = row_count;

  with cancelled as (
    delete from email_queue
     where workspace_id = p_workspace_id
       and lower(btrim(to_email)) = v_email
       and status = 'pending'
    returning *
  )
  insert into email_log (workspace_id, lead_id, to_email, subject, status, error, sent_at, source, enrollment_id)
  select workspace_id, lead_id, to_email, subject, 'skipped', 'Recipient suppressed', now(), source, enrollment_id
    from cancelled;

  if v_inserted > 0 then
    insert into activities (workspace_id, lead_id, type, payload)
    select l.workspace_id, l.id, 'unsubscribed',
           jsonb_build_object('email', v_email, 'reason', p_reason)
      from leads l
     where l.workspace_id = p_workspace_id
       and v_email = any(regexp_split_to_array(lower(coalesce(l.email, '')), '\s*[,;\n]+\s*'));
  end if;
end;
$$;

revoke all on function claim_email_queue(uuid, int) from public, anon, authenticated;
revoke all on function email_queue_finalize(uuid, text, text, text, int) from public, anon, authenticated;
revoke all on function suppress_email(uuid, text, text) from public, anon, authenticated;
grant execute on function claim_email_queue(uuid, int) to service_role;
grant execute on function email_queue_finalize(uuid, text, text, text, int) to service_role;
grant execute on function suppress_email(uuid, text, text) to service_role;
