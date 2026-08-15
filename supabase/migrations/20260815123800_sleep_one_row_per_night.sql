-- One row per night: bedtime, wake time, feeling, note.
-- Duration is calculated in the app (wake - bed, wrapping past midnight).

alter table public.sleep_stats drop constraint if exists sleep_stats_duration_check;
alter table public.sleep_stats drop column if exists duration_minutes;
alter table public.sleep_stats add column if not exists night_start date;
alter table public.sleep_stats add column if not exists bedtime time;
alter table public.sleep_stats add column if not exists wake_time time;
alter table public.sleep_stats add column if not exists note text;

alter table public.sleep_stats_dev drop constraint if exists sleep_stats_dev_duration_check;
alter table public.sleep_stats_dev drop column if exists duration_minutes;
alter table public.sleep_stats_dev add column if not exists night_start date;
alter table public.sleep_stats_dev add column if not exists bedtime time;
alter table public.sleep_stats_dev add column if not exists wake_time time;
alter table public.sleep_stats_dev add column if not exists note text;

delete from public.sleep_stats where night_start is null;
delete from public.sleep_stats_dev where night_start is null;

alter table public.sleep_stats alter column night_start set not null;
alter table public.sleep_stats_dev alter column night_start set not null;

alter table public.sleep_stats drop constraint if exists sleep_stats_user_night_key;
alter table public.sleep_stats
  add constraint sleep_stats_user_night_key unique (user_id, night_start);

alter table public.sleep_stats_dev drop constraint if exists sleep_stats_dev_user_night_key;
alter table public.sleep_stats_dev
  add constraint sleep_stats_dev_user_night_key unique (user_id, night_start);
