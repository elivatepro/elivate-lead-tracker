-- Automation engine: tables, lead-event trigger, and service-role RPCs.
--
-- Design rules:
--  * The engine never writes to `leads` (trg_lead_updated would reset the
--    stale-SLA clock). All state lives in the tables below.
--  * Every step commits atomically through automation_commit_step, guarded by
--    a lease token, so overlapping ticks can't double-advance an enrollment.
--  * send_email is two-phase: enqueue -> park the enrollment on the queue row
--    -> email_queue_finalize resumes (sent) or stops (failed/skipped) it.
--  * All RPCs are service_role only; the API routes do the tenant checks.

-- ============================================================
-- 1. TABLES
-- ============================================================

create table automations (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  name               text not null check (length(btrim(name)) between 1 and 120),
  status             text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  trigger_type       text not null check (trigger_type in ('manual', 'lead_created', 'stage_changed', 'tag_added')),
  trigger_config     jsonb not null default '{}'::jsonb,
  stop_rules         jsonb not null default '{"on_closed_stage": true}'::jsonb,
  allow_reenroll     boolean not null default false,
  draft_graph        jsonb not null default '{}'::jsonb check (octet_length(draft_graph::text) < 262144),
  draft_rev          int not null default 0,
  current_version_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_automations_workspace on automations(workspace_id);
create index idx_automations_active_trigger
  on automations(workspace_id, trigger_type) where status = 'active';

create table automation_versions (
  id             uuid primary key default gen_random_uuid(),
  automation_id  uuid not null references automations(id) on delete cascade,
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  version        int not null,
  graph          jsonb not null,
  entry_node_id  text not null,
  trigger_type   text not null,
  trigger_config jsonb not null,
  stop_rules     jsonb not null,
  created_at     timestamptz not null default now(),
  unique (automation_id, version)
);

alter table automations
  add constraint automations_current_version_fk
  foreign key (current_version_id) references automation_versions(id) on delete set null;

create table automation_enrollments (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  automation_id     uuid not null references automations(id) on delete cascade,
  version_id        uuid not null references automation_versions(id),
  lead_id           uuid not null references leads(id) on delete cascade,
  cycle             int not null default 1,
  status            text not null default 'active'
                      check (status in ('active', 'completed', 'stopped', 'failed')),
  -- The NEXT node to run, and when. NULL next_run_at = parked on the queue.
  current_node_id   text,
  next_run_at       timestamptz default now(),
  awaiting_queue_id uuid,
  lock_token        uuid,
  locked_until      timestamptz,
  attempts          int not null default 0,
  last_error        text,
  stop_reason       text,
  source            text not null default 'trigger',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  finished_at       timestamptz,
  unique (automation_id, lead_id, cycle)
);

create unique index uq_enrollment_active
  on automation_enrollments(automation_id, lead_id) where status = 'active';
create index idx_enrollment_due
  on automation_enrollments(next_run_at) where status = 'active' and next_run_at is not null;
create index idx_enrollment_lead on automation_enrollments(lead_id);
create index idx_enrollment_automation on automation_enrollments(automation_id, status);
create index idx_enrollment_awaiting
  on automation_enrollments(awaiting_queue_id) where awaiting_queue_id is not null;

create table automation_step_log (
  id            bigint generated always as identity primary key,
  enrollment_id uuid references automation_enrollments(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  automation_id uuid not null references automations(id) on delete cascade,
  node_id       text,
  node_type     text,
  outcome       text,
  detail        jsonb,
  created_at    timestamptz not null default now()
);

create index idx_step_log_enrollment on automation_step_log(enrollment_id, id);
create index idx_step_log_automation on automation_step_log(automation_id, created_at desc);

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================
-- Owners manage automations; everything the engine writes is read-only to
-- them (writes go through service-role RPCs).

alter table automations            enable row level security;
alter table automation_versions    enable row level security;
alter table automation_enrollments enable row level security;
alter table automation_step_log    enable row level security;

create policy "Users manage own automations" on automations
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  )
  with check (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "Users see own automation versions" on automation_versions
  for select using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "Users see own enrollments" on automation_enrollments
  for select using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

create policy "Users see own step log" on automation_step_log
  for select using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
  );

-- ============================================================
-- 3. RPCs
-- ============================================================

-- Enroll one lead into one active automation. Returns the enrollment id, or
-- NULL if the lead isn't eligible (workspace flag off, automation not active,
-- lead archived, no deliverable address, already enrolled, or re-enrollment
-- not allowed). Race-safe: the unique indexes arbitrate concurrent calls.
create or replace function enroll_lead(
  p_automation_id uuid,
  p_lead_id uuid,
  p_source text default 'trigger'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a automations%rowtype;
  v automation_versions%rowtype;
  l leads%rowtype;
  v_cycle int;
  v_id uuid;
begin
  select * into a from automations where id = p_automation_id and status = 'active';
  if not found or a.current_version_id is null then return null; end if;

  if not coalesce((select automations_enabled from workspaces where id = a.workspace_id), false) then
    return null;
  end if;

  select * into l from leads
   where id = p_lead_id and workspace_id = a.workspace_id and archived_at is null;
  if not found then return null; end if;

  if not exists (
    select 1
      from unnest(regexp_split_to_array(lower(coalesce(l.email, '')), '\s*[,;\n]+\s*')) as addr
     where addr ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
       and not exists (
         select 1 from email_suppressions s
          where s.workspace_id = l.workspace_id and s.email = addr
       )
  ) then
    return null;
  end if;

  select coalesce(max(cycle), 0) + 1 into v_cycle
    from automation_enrollments where automation_id = a.id and lead_id = l.id;
  if v_cycle > 1 and not a.allow_reenroll then return null; end if;

  select * into v from automation_versions where id = a.current_version_id;

  insert into automation_enrollments
    (workspace_id, automation_id, version_id, lead_id, cycle, current_node_id, next_run_at, source)
  values
    (a.workspace_id, a.id, v.id, l.id, v_cycle, v.entry_node_id, now(), p_source)
  on conflict do nothing
  returning id into v_id;

  if v_id is not null then
    insert into activities (workspace_id, lead_id, type, payload)
    values (a.workspace_id, l.id, 'automation_enrolled',
            jsonb_build_object('automation_id', a.id, 'automation_name', a.name,
                               'enrollment_id', v_id, 'source', p_source));
  end if;

  return v_id;
end;
$$;

-- Lead events -> enrollments, in the same transaction as the lead write, so
-- every write path (API, CSV import, cron) is covered without app changes.
-- It must never make a lead save fail: every step is wrapped.
create or replace function automations_on_lead_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_added text[];
begin
  begin
    if not coalesce((select automations_enabled from workspaces where id = new.workspace_id), false) then
      return null;
    end if;

    if tg_op = 'INSERT' then
      for r in
        select id from automations
         where workspace_id = new.workspace_id and status = 'active' and trigger_type = 'lead_created'
      loop
        begin
          perform enroll_lead(r.id, new.id, 'trigger');
        exception when others then
          raise warning 'automation % enroll failed: %', r.id, sqlerrm;
        end;
      end loop;
    else
      if new.stage_id is distinct from old.stage_id then
        for r in
          select id from automations
           where workspace_id = new.workspace_id and status = 'active'
             and trigger_type = 'stage_changed'
             and trigger_config ->> 'stage_id' = new.stage_id::text
        loop
          begin
            perform enroll_lead(r.id, new.id, 'trigger');
          exception when others then
            raise warning 'automation % enroll failed: %', r.id, sqlerrm;
          end;
        end loop;
      end if;

      if new.tags is distinct from old.tags then
        v_added := array(
          select lower(t) from unnest(coalesce(new.tags, '{}'::text[])) as t
          except
          select lower(t) from unnest(coalesce(old.tags, '{}'::text[])) as t
        );
        if coalesce(array_length(v_added, 1), 0) > 0 then
          for r in
            select id from automations
             where workspace_id = new.workspace_id and status = 'active'
               and trigger_type = 'tag_added'
               and lower(trigger_config ->> 'tag') = any (v_added)
          loop
            begin
              perform enroll_lead(r.id, new.id, 'trigger');
            exception when others then
              raise warning 'automation % enroll failed: %', r.id, sqlerrm;
            end;
          end loop;
        end if;
      end if;
    end if;
  exception when others then
    raise warning 'automations_on_lead_change failed: %', sqlerrm;
  end;

  return null;
end;
$$;

create trigger trg_automations_lead_insert
  after insert on leads
  for each row execute function automations_on_lead_change();

create trigger trg_automations_lead_update
  after update of stage_id, tags on leads
  for each row
  when (old.stage_id is distinct from new.stage_id or old.tags is distinct from new.tags)
  execute function automations_on_lead_change();

-- Lease due enrollments to a worker. The lease (lock_token + locked_until)
-- outlives this call, unlike a row lock. Paused automations and workspaces
-- with automations disabled are skipped, which is what "hold" means.
create or replace function claim_due_enrollments(p_limit int, p_lease_seconds int)
returns setof automation_enrollments
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select e.id
      from automation_enrollments e
      join automations a on a.id = e.automation_id and a.status = 'active'
      join workspaces w on w.id = e.workspace_id and w.automations_enabled
     where e.status = 'active'
       and e.next_run_at is not null
       and e.next_run_at <= now()
       and (e.locked_until is null or e.locked_until < now())
     order by e.next_run_at
     limit p_limit
     for update of e skip locked
  ), claimed as (
    update automation_enrollments e
       set lock_token = gen_random_uuid(),
           locked_until = now() + make_interval(secs => p_lease_seconds),
           updated_at = now()
      from picked
     where e.id = picked.id
    returning e.*
  )
  select * from claimed;
end;
$$;

-- Commit one engine step atomically. Returns 'ok' or 'lost_lease' (someone
-- else advanced or released the enrollment; the caller must discard its work).
--   p_status: active   = moved on (wait scheduled, or email enqueued -> parked)
--             completed / stopped / failed = terminal
--             retry    = unexpected error; back off, fail after 5 attempts
--   p_log:    jsonb array of {node_id, node_type, outcome, detail}
--   p_email:  null, or {lead_id, node_id, to_email, subject, body_html,
--             body_text, from_email, from_name, idempotency_key}
create or replace function automation_commit_step(
  p_enrollment_id uuid,
  p_lock_token uuid,
  p_expected_node text,
  p_status text,
  p_next_node text,
  p_next_run_at timestamptz,
  p_stop_reason text,
  p_error text,
  p_log jsonb,
  p_email jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  e automation_enrollments%rowtype;
  v_qid uuid;
  v_name text;
  v_attempts int;
begin
  if p_status not in ('active', 'completed', 'stopped', 'failed', 'retry') then
    raise exception 'invalid status %', p_status;
  end if;

  select * into e from automation_enrollments
   where id = p_enrollment_id
     and lock_token = p_lock_token
     and status = 'active'
     and current_node_id is not distinct from p_expected_node
   for update;
  if not found then return 'lost_lease'; end if;

  select name into v_name from automations where id = e.automation_id;

  insert into automation_step_log (enrollment_id, workspace_id, automation_id, node_id, node_type, outcome, detail)
  select e.id, e.workspace_id, e.automation_id,
         x ->> 'node_id', x ->> 'node_type', x ->> 'outcome', x -> 'detail'
    from jsonb_array_elements(coalesce(p_log, '[]'::jsonb)) as x;

  if p_status = 'retry' then
    v_attempts := e.attempts + 1;
    if v_attempts >= 5 then
      update automation_enrollments
         set status = 'failed', attempts = v_attempts, last_error = p_error,
             stop_reason = 'engine_error', finished_at = now(), next_run_at = null,
             lock_token = null, locked_until = null, updated_at = now()
       where id = e.id;
      insert into automation_step_log (enrollment_id, workspace_id, automation_id, node_id, node_type, outcome, detail)
      values (e.id, e.workspace_id, e.automation_id, e.current_node_id, null, 'failed',
              jsonb_build_object('error', p_error));
    else
      update automation_enrollments
         set attempts = v_attempts, last_error = p_error,
             next_run_at = coalesce(p_next_run_at, now() + interval '5 minutes'),
             lock_token = null, locked_until = null, updated_at = now()
       where id = e.id;
    end if;
    return 'ok';
  end if;

  if p_status = 'active' then
    if p_email is not null then
      insert into email_queue
        (workspace_id, lead_id, from_email, from_name, to_email, subject,
         body_html, body_text, scheduled_for, source, enrollment_id, node_id, idempotency_key)
      values
        (e.workspace_id, (p_email ->> 'lead_id')::uuid, p_email ->> 'from_email',
         p_email ->> 'from_name', p_email ->> 'to_email', p_email ->> 'subject',
         p_email ->> 'body_html', p_email ->> 'body_text', now(), 'automation',
         e.id, p_email ->> 'node_id', p_email ->> 'idempotency_key')
      on conflict (idempotency_key) where idempotency_key is not null do nothing
      returning id into v_qid;

      if v_qid is null then
        select id into v_qid from email_queue where idempotency_key = p_email ->> 'idempotency_key';
      end if;

      update automation_enrollments
         set current_node_id = p_next_node,
             awaiting_queue_id = v_qid,
             next_run_at = case when v_qid is null then now() else null end,
             attempts = 0, last_error = null,
             lock_token = null, locked_until = null, updated_at = now()
       where id = e.id;
    else
      update automation_enrollments
         set current_node_id = p_next_node,
             next_run_at = coalesce(p_next_run_at, now()),
             attempts = 0, last_error = null,
             lock_token = null, locked_until = null, updated_at = now()
       where id = e.id;
    end if;
    return 'ok';
  end if;

  -- terminal
  update automation_enrollments
     set status = p_status, stop_reason = p_stop_reason, last_error = p_error,
         finished_at = now(), current_node_id = null, next_run_at = null,
         awaiting_queue_id = null, lock_token = null, locked_until = null, updated_at = now()
   where id = e.id;

  if p_status = 'completed' then
    insert into activities (workspace_id, lead_id, type, payload)
    values (e.workspace_id, e.lead_id, 'automation_completed',
            jsonb_build_object('automation_id', e.automation_id, 'automation_name', v_name,
                               'enrollment_id', e.id));
  elsif p_status = 'stopped' then
    insert into activities (workspace_id, lead_id, type, payload)
    values (e.workspace_id, e.lead_id, 'automation_stopped',
            jsonb_build_object('automation_id', e.automation_id, 'automation_name', v_name,
                               'enrollment_id', e.id, 'reason', p_stop_reason));
  end if;

  return 'ok';
end;
$$;

-- Enrollments parked on a queue row that no longer exists (manually deleted,
-- say) would wait forever. Stop them.
create or replace function automation_recover()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update automation_enrollments e
     set status = 'stopped', stop_reason = 'queue_row_missing',
         finished_at = now(), awaiting_queue_id = null, next_run_at = null,
         current_node_id = null, updated_at = now()
   where e.status = 'active'
     and e.awaiting_queue_id is not null
     and not exists (select 1 from email_queue q where q.id = e.awaiting_queue_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Snapshot the (already validated) draft graph as a new immutable version and
-- optionally activate the automation. Enrollments pin a version, so editing
-- and republishing never disturbs in-flight runs.
create or replace function publish_automation(
  p_automation_id uuid,
  p_graph jsonb,
  p_entry_node_id text,
  p_activate boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a automations%rowtype;
  v_version int;
  v_id uuid;
begin
  select * into a from automations where id = p_automation_id for update;
  if not found then raise exception 'automation not found'; end if;

  select coalesce(max(version), 0) + 1 into v_version
    from automation_versions where automation_id = a.id;

  insert into automation_versions
    (automation_id, workspace_id, version, graph, entry_node_id, trigger_type, trigger_config, stop_rules)
  values
    (a.id, a.workspace_id, v_version, p_graph, p_entry_node_id, a.trigger_type, a.trigger_config, a.stop_rules)
  returning id into v_id;

  update automations
     set current_version_id = v_id,
         status = case when p_activate then 'active' else status end,
         updated_at = now()
   where id = a.id;

  return v_id;
end;
$$;

-- ============================================================
-- 4. QUEUE INTEGRATION (replaces the Phase 0 versions, same signatures)
-- ============================================================

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
  v_name text;
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
            jsonb_build_object('to', q.to_email, 'subject', q.subject, 'source', q.source,
                               'enrollment_id', q.enrollment_id));

    -- Only manual sends count as lead activity; automated mail must not
    -- reset the stale-lead SLA clock.
    if q.source = 'manual' then
      update leads set last_activity_at = now() where id = q.lead_id;
    end if;
  end if;

  -- Resume or stop the automation waiting on this email.
  if q.enrollment_id is not null then
    if v_status = 'sent' then
      update automation_enrollments
         set awaiting_queue_id = null, next_run_at = now(), updated_at = now()
       where id = q.enrollment_id and status = 'active' and awaiting_queue_id = q.id;
    else
      update automation_enrollments
         set status = 'stopped',
             stop_reason = case when v_status = 'skipped' then 'email_skipped' else 'email_failed' end,
             last_error = p_error, finished_at = now(), awaiting_queue_id = null,
             next_run_at = null, current_node_id = null, lock_token = null,
             locked_until = null, updated_at = now()
       where id = q.enrollment_id and status = 'active' and awaiting_queue_id = q.id;

      if found then
        select a.name into v_name
          from automation_enrollments e join automations a on a.id = e.automation_id
         where e.id = q.enrollment_id;
        insert into activities (workspace_id, lead_id, type, payload)
        values (q.workspace_id, q.lead_id, 'automation_stopped',
                jsonb_build_object('enrollment_id', q.enrollment_id, 'automation_name', v_name,
                                   'reason', case when v_status = 'skipped' then 'email_skipped' else 'email_failed' end,
                                   'detail', p_error));
      end if;
    end if;
  end if;

  return v_status;
end;
$$;

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

  -- Cancel anything queued for this address. An automation parked on a
  -- cancelled email is resumed so the engine re-evaluates the recipient: it
  -- will use another address if the lead has one, or stop at the next email.
  with cancelled as (
    delete from email_queue
     where workspace_id = p_workspace_id
       and lower(btrim(to_email)) = v_email
       and status = 'pending'
    returning *
  ), logged as (
    insert into email_log (workspace_id, lead_id, to_email, subject, status, error, sent_at, source, enrollment_id)
    select workspace_id, lead_id, to_email, subject, 'skipped', 'Recipient suppressed', now(), source, enrollment_id
      from cancelled
    returning 1
  )
  update automation_enrollments e
     set awaiting_queue_id = null, next_run_at = now(), updated_at = now()
    from cancelled c
   where e.id = c.enrollment_id and e.awaiting_queue_id = c.id and e.status = 'active';

  if v_inserted > 0 then
    insert into activities (workspace_id, lead_id, type, payload)
    select l.workspace_id, l.id, 'unsubscribed',
           jsonb_build_object('email', v_email, 'reason', p_reason)
      from leads l
     where l.workspace_id = p_workspace_id
       and v_email = any (regexp_split_to_array(lower(coalesce(l.email, '')), '\s*[,;\n]+\s*'));
  end if;
end;
$$;

-- ============================================================
-- 5. GRANTS: service role only
-- ============================================================

revoke all on function enroll_lead(uuid, uuid, text) from public, anon, authenticated;
revoke all on function automations_on_lead_change() from public, anon, authenticated;
revoke all on function claim_due_enrollments(int, int) from public, anon, authenticated;
revoke all on function automation_commit_step(uuid, uuid, text, text, text, timestamptz, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function automation_recover() from public, anon, authenticated;
revoke all on function publish_automation(uuid, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function email_queue_finalize(uuid, text, text, text, int) from public, anon, authenticated;
revoke all on function suppress_email(uuid, text, text) from public, anon, authenticated;

grant execute on function enroll_lead(uuid, uuid, text) to service_role;
grant execute on function claim_due_enrollments(int, int) to service_role;
grant execute on function automation_commit_step(uuid, uuid, text, text, text, timestamptz, text, text, jsonb, jsonb) to service_role;
grant execute on function automation_recover() to service_role;
grant execute on function publish_automation(uuid, jsonb, text, boolean) to service_role;
grant execute on function email_queue_finalize(uuid, text, text, text, int) to service_role;
grant execute on function suppress_email(uuid, text, text) to service_role;
