-- Sleep duration + feeling (1–10), same pattern as run_stats.

create table if not exists public.sleep_stats (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  duration_minutes integer not null,
  rating smallint,
  created_at timestamptz not null default now(),
  constraint sleep_stats_duration_check check (duration_minutes > 0 and duration_minutes < 1440),
  constraint sleep_stats_rating_check check (rating is null or (rating >= 1 and rating <= 10))
);

create table if not exists public.sleep_stats_dev (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  duration_minutes integer not null,
  rating smallint,
  created_at timestamptz not null default now(),
  constraint sleep_stats_dev_duration_check check (duration_minutes > 0 and duration_minutes < 1440),
  constraint sleep_stats_dev_rating_check check (rating is null or (rating >= 1 and rating <= 10))
);

create index if not exists sleep_stats_user_id_idx on public.sleep_stats (user_id);
create index if not exists sleep_stats_dev_user_id_idx on public.sleep_stats_dev (user_id);

alter table public.sleep_stats enable row level security;
alter table public.sleep_stats_dev enable row level security;

grant all on public.sleep_stats to anon, authenticated, service_role;
grant all on public.sleep_stats_dev to anon, authenticated, service_role;
grant usage, select on sequence public.sleep_stats_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.sleep_stats_dev_id_seq to anon, authenticated, service_role;

drop policy if exists own_rows on public.sleep_stats;
create policy own_rows on public.sleep_stats
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_rows on public.sleep_stats_dev;
create policy own_rows on public.sleep_stats_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

update public.profiles
set enabled_pages = array_append(enabled_pages, 'sleep')
where enabled_pages is not null
  and not ('sleep' = any (enabled_pages));

update public.profiles_dev
set enabled_pages = array_append(enabled_pages, 'sleep')
where enabled_pages is not null
  and not ('sleep' = any (enabled_pages));
