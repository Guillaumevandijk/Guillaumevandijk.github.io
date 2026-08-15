-- Flexible per-user habits (name, count, date range) + daily logs.
-- Migrates existing habits_daily / habits_daily_dev boolean columns.

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  position integer not null default 0,
  starts_on date not null default current_date,
  ends_on date,
  kind text not null default 'normal',
  constraint habits_kind_check check (kind in ('normal', 'skip_after_run'))
);

create table if not exists public.habits_dev (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  position integer not null default 0,
  starts_on date not null default current_date,
  ends_on date,
  kind text not null default 'normal',
  constraint habits_dev_kind_check check (kind in ('normal', 'skip_after_run'))
);

create table if not exists public.habit_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  habit_date date not null,
  done boolean not null default false,
  unique (habit_id, habit_date)
);

create table if not exists public.habit_logs_dev (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  habit_id uuid not null references public.habits_dev(id) on delete cascade,
  habit_date date not null,
  done boolean not null default false,
  unique (habit_id, habit_date)
);

create index if not exists habits_user_id_idx on public.habits (user_id);
create index if not exists habits_dev_user_id_idx on public.habits_dev (user_id);
create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, habit_date);
create index if not exists habit_logs_dev_user_date_idx on public.habit_logs_dev (user_id, habit_date);

alter table public.habits enable row level security;
alter table public.habits_dev enable row level security;
alter table public.habit_logs enable row level security;
alter table public.habit_logs_dev enable row level security;

grant all on public.habits to anon, authenticated, service_role;
grant all on public.habits_dev to anon, authenticated, service_role;
grant all on public.habit_logs to anon, authenticated, service_role;
grant all on public.habit_logs_dev to anon, authenticated, service_role;
grant usage, select on sequence public.habit_logs_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.habit_logs_dev_id_seq to anon, authenticated, service_role;

drop policy if exists own_rows on public.habits;
create policy own_rows on public.habits
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_rows on public.habits_dev;
create policy own_rows on public.habits_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_rows on public.habit_logs;
create policy own_rows on public.habit_logs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_rows on public.habit_logs_dev;
create policy own_rows on public.habit_logs_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- seed defs + logs from old wide tables
-- ---------------------------------------------------------------------------
-- Production: old table has no user_id; all rows belong to Guillaume.
insert into public.habits (user_id, name, position, starts_on, kind)
select u.id, s.name, s.position, s.starts_on::date, s.kind
from auth.users u
cross join (values
  ('Eiwit shake', 0, '2026-05-27', 'normal', 'protein_shake'),
  ('B12 vitamine', 1, '2026-05-27', 'normal', 'b12'),
  ('Magnesium', 2, '2026-05-27', 'normal', 'magnesium'),
  ('Kuit oefeningen', 3, '2026-05-27', 'skip_after_run', 'calve_exercises'),
  ('Creatine', 4, '2026-05-28', 'normal', 'creatine')
) as s(name, position, starts_on, kind, col)
where u.email = 'guillaumevandijk@gmail.com'
  and exists (select 1 from public.habits_daily)
  and not exists (select 1 from public.habits h where h.user_id = u.id);

insert into public.habit_logs (user_id, habit_id, habit_date, done)
select u.id, h.id, d.habit_date,
  case s.col
    when 'protein_shake' then coalesce(d.protein_shake, false)
    when 'b12' then coalesce(d.b12, false)
    when 'magnesium' then coalesce(d.magnesium, false)
    when 'calve_exercises' then coalesce(d.calve_exercises, false)
    when 'creatine' then coalesce(d.creatine, false)
  end
from public.habits_daily d
cross join auth.users u
join public.habits h on h.user_id = u.id
join (values
  ('Eiwit shake', 'protein_shake'),
  ('B12 vitamine', 'b12'),
  ('Magnesium', 'magnesium'),
  ('Kuit oefeningen', 'calve_exercises'),
  ('Creatine', 'creatine')
) as s(name, col) on s.name = h.name
where u.email = 'guillaumevandijk@gmail.com'
  and (
    s.col <> 'creatine'
    or d.habit_date >= '2026-05-28'
    or coalesce(d.habit_number, 0) >= 5
    or coalesce(d.creatine, false)
  )
on conflict (habit_id, habit_date) do nothing;

-- Dev: per user_id when that column exists.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'habits_daily_dev'
      and column_name = 'user_id'
  ) then
    insert into public.habits_dev (user_id, name, position, starts_on, kind)
    select distinct d.user_id, s.name, s.position, s.starts_on::date, s.kind
    from public.habits_daily_dev d
    cross join (values
      ('Eiwit shake', 0, '2026-05-27', 'normal'),
      ('B12 vitamine', 1, '2026-05-27', 'normal'),
      ('Magnesium', 2, '2026-05-27', 'normal'),
      ('Kuit oefeningen', 3, '2026-05-27', 'skip_after_run'),
      ('Creatine', 4, '2026-05-28', 'normal')
    ) as s(name, position, starts_on, kind)
    where d.user_id is not null
      and not exists (
        select 1 from public.habits_dev h where h.user_id = d.user_id
      );

    insert into public.habit_logs_dev (user_id, habit_id, habit_date, done)
    select d.user_id, h.id, d.habit_date,
      case s.col
        when 'protein_shake' then coalesce(d.protein_shake, false)
        when 'b12' then coalesce(d.b12, false)
        when 'magnesium' then coalesce(d.magnesium, false)
        when 'calve_exercises' then coalesce(d.calve_exercises, false)
        when 'creatine' then coalesce(d.creatine, false)
      end
    from public.habits_daily_dev d
    join public.habits_dev h on h.user_id = d.user_id
    join (values
      ('Eiwit shake', 'protein_shake'),
      ('B12 vitamine', 'b12'),
      ('Magnesium', 'magnesium'),
      ('Kuit oefeningen', 'calve_exercises'),
      ('Creatine', 'creatine')
    ) as s(name, col) on s.name = h.name
    where d.user_id is not null
      and (
        s.col <> 'creatine'
        or d.habit_date >= '2026-05-28'
        or coalesce(d.habit_number, 0) >= 5
        or coalesce(d.creatine, false)
      )
    on conflict (habit_id, habit_date) do nothing;
  end if;
end $$;
