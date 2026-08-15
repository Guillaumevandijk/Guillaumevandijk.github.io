-- Multi-user ownership for *_dev tables only.
-- Existing rows are assigned to guillaumevandijk@gmail.com.
-- Production tables (weight, run_stats, habits_daily, forgot) are unchanged.

-- 1. Add user_id (nullable first — auth.uid() is null in the SQL editor)
alter table public.weight_dev
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.run_stats_dev
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.habits_daily_dev
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.forgot_dev
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2. Backfill existing rows to Guillaume
update public.weight_dev
  set user_id = (select id from auth.users where email = 'guillaumevandijk@gmail.com')
  where user_id is null;

update public.run_stats_dev
  set user_id = (select id from auth.users where email = 'guillaumevandijk@gmail.com')
  where user_id is null;

update public.habits_daily_dev
  set user_id = (select id from auth.users where email = 'guillaumevandijk@gmail.com')
  where user_id is null;

update public.forgot_dev
  set user_id = (select id from auth.users where email = 'guillaumevandijk@gmail.com')
  where user_id is null;

-- 3. Default + NOT NULL for new inserts from the logged-in JWT
alter table public.weight_dev
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

alter table public.run_stats_dev
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

alter table public.habits_daily_dev
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

alter table public.forgot_dev
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

-- 4. Habits unique per user, not globally
alter table public.habits_daily_dev
  drop constraint if exists habits_daily_dev_habit_date_key;

alter table public.habits_daily_dev
  add constraint habits_daily_dev_user_date_key unique (user_id, habit_date);

-- 5. RLS: own rows instead of hardcoded email
drop policy if exists only_me on public.weight_dev;
create policy own_rows on public.weight_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists only_me on public.run_stats_dev;
create policy own_rows on public.run_stats_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists only_me on public.habits_daily_dev;
create policy own_rows on public.habits_daily_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists only_me on public.forgot_dev;
create policy own_rows on public.forgot_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
