-- =============================================================================
-- NEW TABLE TEMPLATE — paste into Supabase Dashboard → SQL Editor → Run
-- =============================================================================
--
-- 1. Copy the block below
-- 2. Replace my_table with your name (e.g. forgot, weight, habits_daily)
-- 3. Replace the columns inside CREATE TABLE
-- 4. Run once in SQL Editor
--
-- Your site uses getTable('my_table'):
--   localhost     → my_table_dev
--   GitHub Pages  → my_table
--
-- =============================================================================

-- ▼▼▼ EDIT THESE TWO LINES ONLY (then run) ▼▼▼

create table if not exists public.my_table (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
  -- add columns here, e.g.:
  -- text text not null
);

create table if not exists public.my_table_dev (
  like public.my_table including all
);

alter table public.my_table enable row level security;
alter table public.my_table_dev enable row level security;

create policy "only_me" on public.my_table
  for all
  to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );

create policy "only_me" on public.my_table_dev
  for all
  to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );

-- ▲▲▲ END — if policy already exists, drop first or use a new policy name ▲▲▲


-- =============================================================================
-- READY-MADE EXAMPLES (copy one block instead of the template above)
-- =============================================================================

-- forgot / forgot_dev  (used by js/forgot.js)
/*
create table if not exists public.forgot (
  id bigint generated always as identity primary key,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.forgot_dev ( like public.forgot including all );

alter table public.forgot enable row level security;
alter table public.forgot_dev enable row level security;

create policy "only_me" on public.forgot for all to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );

create policy "only_me" on public.forgot_dev for all to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );
*/

-- weight / weight_dev  (used by js/weight.js)
/*
create table if not exists public.weight (
  id bigint generated always as identity primary key,
  weight numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.weight_dev ( like public.weight including all );

alter table public.weight enable row level security;
alter table public.weight_dev enable row level security;

create policy "only_me" on public.weight for all to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );

create policy "only_me" on public.weight_dev for all to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );
*/

-- habits_daily / habits_daily_dev  (used by js/habits.js)
/*
create table if not exists public.habits_daily (
  id bigint generated always as identity primary key,
  habit_date date not null unique,
  protein_shake boolean not null default false,
  b12 boolean not null default false,
  magnesium boolean not null default false,
  calve_exercises boolean not null default false,
  creatine boolean not null default false,
  habit_number smallint not null default 4
);

create table if not exists public.habits_daily_dev ( like public.habits_daily including all );

alter table public.habits_daily enable row level security;
alter table public.habits_daily_dev enable row level security;

create policy "only_me" on public.habits_daily for all to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );

create policy "only_me" on public.habits_daily_dev for all to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );
*/

-- run_stats / run_stats_dev  (distance km, tempo seconds, rating 1–10)
/*
create table if not exists public.run_stats (
  id bigint generated always as identity primary key,
  distance_km numeric(6, 2),
  tempo_seconds integer,
  rating smallint,
  created_at timestamptz not null default now(),
  constraint run_stats_rating_check check (rating is null or (rating >= 1 and rating <= 10))
);

create table if not exists public.run_stats_dev ( like public.run_stats including all );

alter table public.run_stats enable row level security;
alter table public.run_stats_dev enable row level security;

create policy "only_me" on public.run_stats for all to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );

create policy "only_me" on public.run_stats_dev for all to authenticated
  using ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' )
  with check ( (select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com' );
*/


-- =============================================================================
-- ADD A COLUMN LATER (run when you extend an existing table)
-- =============================================================================
/*
alter table public.my_table
  add column if not exists new_column text not null default '';

alter table public.my_table_dev
  add column if not exists new_column text not null default '';
*/
