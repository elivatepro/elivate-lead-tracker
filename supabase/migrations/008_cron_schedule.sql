-- Drains the email queue every minute via pg_cron + pg_net, replacing the
-- hourly GitHub Action (Vercel Hobby has no sub-daily cron).
--
-- APPLY LAST. Before running this migration:
--   1. The new /api/cron/process-email-queue route must be deployed.
--   2. Create the two Vault secrets (kept out of this file on purpose):
--        select vault.create_secret('https://leadtracker.elivate.io', 'app_url');
--        select vault.create_secret('<same value as the CRON_SECRET env var>', 'cron_secret');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

-- Only calls the app when there is work: due pending rows, or claims stuck
-- in 'sending' that need recovering. Idle minutes cost no function invocation.
select cron.schedule(
  'leadtracker-email-drain',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url')
           || '/api/cron/process-email-queue',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 58000
  )
  where exists (
    select 1 from public.email_queue
    where (status = 'pending' and scheduled_for <= now())
       or (status = 'sending' and claimed_at < now() - interval '15 minutes')
  )
  $job$
);

-- cron.job_run_details grows every minute; keep three days.
select cron.schedule(
  'leadtracker-cron-history-purge',
  '17 3 * * *',
  $job$ delete from cron.job_run_details where end_time < now() - interval '3 days' $job$
);
