-- Reference schema (tables may already exist in your project).
-- Dev: habits_daily_dev | Production: habits_daily

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

create table if not exists public.habits_daily_dev (
  like public.habits_daily including all
);

alter table public.habits_daily enable row level security;
alter table public.habits_daily_dev enable row level security;

-- Adjust policies if you add user_id later; example for authenticated users:
-- create policy "habits_select" on public.habits_daily for select to authenticated using (true);
-- create policy "habits_insert" on public.habits_daily for insert to authenticated with check (true);
-- create policy "habits_update" on public.habits_daily for update to authenticated using (true);
