-- Ticks the automation engine every minute via pg_cron + pg_net, but only when
-- there is work, so idle minutes cost no function invocation.
--
-- APPLY AFTER the /api/cron/automations route is deployed. Uses the same Vault
-- secrets as 008 (app_url, cron_secret).
--
-- "Work" mirrors what the engine acts on: enrollments that are due and not
-- leased, or parked on a queue row that no longer exists (recovery).

select cron.schedule(
  'leadtracker-automations-tick',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
           || '/api/cron/automations',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 58000
  )
  where exists (
    select 1
      from public.automation_enrollments e
      join public.automations a on a.id = e.automation_id and a.status = 'active'
      join public.workspaces w on w.id = e.workspace_id and w.automations_enabled
     where e.status = 'active'
       and (
         (e.next_run_at is not null and e.next_run_at <= now()
          and (e.locked_until is null or e.locked_until < now()))
         or
         (e.awaiting_queue_id is not null
          and not exists (select 1 from public.email_queue q where q.id = e.awaiting_queue_id))
       )
  )
  $job$
);
