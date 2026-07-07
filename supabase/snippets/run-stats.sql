-- run_stats / run_stats_dev — paste into Supabase Dashboard → SQL Editor → Run
-- JS: const TABLE = getTable('run_stats')

create table if not exists public.run_stats (
  id bigint generated always as identity primary key,
  distance_km numeric(6, 2),
  tempo_seconds integer,
  rating smallint,
  created_at timestamptz not null default now(),
  constraint run_stats_rating_check check (rating is null or (rating >= 1 and rating <= 10))
);

create table if not exists public.run_stats_dev (
  like public.run_stats including all
);

alter table public.run_stats enable row level security;
alter table public.run_stats_dev enable row level security;

create policy "only_me" on public.run_stats
  for all
  to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );

create policy "only_me" on public.run_stats_dev
  for all
  to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );

-- Optional placeholder row in dev (distance, tempo, rating all null)
insert into public.run_stats_dev (distance_km, tempo_seconds, rating)
values (null, null, null);
