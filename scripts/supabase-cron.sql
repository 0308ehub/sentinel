-- Runs Kismet's loop every hour from Supabase, on time.
-- GitHub Actions' scheduler is best-effort and skipped most hourly runs; Vercel Hobby only allows a daily cron.
-- Overlapping runs are safe: each account's tick takes a lease (kismet.autopilot_tick_lock), so the
-- GitHub workflow can stay on as a backup.
--
-- Run once in the Supabase SQL editor for the production project.
-- 1. Replace PASTE_CRON_SECRET with the CRON_SECRET value from Vercel (no "Bearer ", no spaces).
-- 2. Run the whole file. Re-running is safe: the secret is replaced and the job is updated in place.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Keep the secret in Vault, not in the job text (cron.job is readable by more roles).
delete from vault.secrets where name = 'kismet_cron_secret';
select vault.create_secret('PASTE_CRON_SECRET', 'kismet_cron_secret', 'Bearer token for /api/autopilot/tick');

-- :07 each hour, ten minutes before the GitHub backup at :17.
select cron.schedule(
  'kismet-tick',
  '7 * * * *',
  $$
  select net.http_get(
    url := 'https://app.sentinelai.one/api/autopilot/tick',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'kismet_cron_secret')
    ),
    -- The tick can run up to its 300s limit; don't hang up on it early.
    timeout_milliseconds := 310000
  );
  $$
);

-- Check it afterwards:
--   select jobid, schedule, active from cron.job where jobname = 'kismet-tick';
--   select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
--   select status_code, left(content, 300), created from net._http_response order by created desc limit 5;
