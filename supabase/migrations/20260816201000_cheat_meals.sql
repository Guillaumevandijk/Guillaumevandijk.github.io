-- Cheat meals on Voeding: description + AI-estimated calories.

create table if not exists public.cheat_meals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  description text not null,
  calories integer not null,
  eaten_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint cheat_meals_calories_check check (calories > 0 and calories < 20000)
);

create table if not exists public.cheat_meals_dev (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  description text not null,
  calories integer not null,
  eaten_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint cheat_meals_dev_calories_check check (calories > 0 and calories < 20000)
);

create index if not exists cheat_meals_user_eaten_idx on public.cheat_meals (user_id, eaten_at desc);
create index if not exists cheat_meals_dev_user_eaten_idx on public.cheat_meals_dev (user_id, eaten_at desc);

alter table public.cheat_meals enable row level security;
alter table public.cheat_meals_dev enable row level security;

grant all on public.cheat_meals to anon, authenticated, service_role;
grant all on public.cheat_meals_dev to anon, authenticated, service_role;
grant usage, select on sequence public.cheat_meals_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.cheat_meals_dev_id_seq to anon, authenticated, service_role;

drop policy if exists own_rows on public.cheat_meals;
create policy own_rows on public.cheat_meals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_rows on public.cheat_meals_dev;
create policy own_rows on public.cheat_meals_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
