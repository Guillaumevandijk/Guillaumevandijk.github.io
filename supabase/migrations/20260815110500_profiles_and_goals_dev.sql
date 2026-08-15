-- User home data: 6 goals on profiles, personal notes, developer feedback.
-- profiles / notes: own rows via user_id (or profiles.id).
-- feedback / feedback_dev: no user_id; store email only. Both prod and _dev.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text,
  enabled_pages text[] not null default array['weight', 'run', 'ai', 'habits']::text[],
  home_page text not null default 'home',
  long_goal_1 text,
  long_goal_2 text,
  long_goal_3 text,
  short_goal_1 text,
  short_goal_2 text,
  short_goal_3 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles_dev (
  id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text,
  enabled_pages text[] not null default array['weight', 'run', 'ai', 'habits']::text[],
  home_page text not null default 'home',
  long_goal_1 text,
  long_goal_2 text,
  long_goal_3 text,
  short_goal_1 text,
  short_goal_2 text,
  short_goal_3 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notes (personal; same listing style as run results)
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notes_dev (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on public.notes (user_id);
create index if not exists notes_dev_user_id_idx on public.notes_dev (user_id);

-- ---------------------------------------------------------------------------
-- feedback (developer inbox: email, no user_id)
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  email text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_dev (
  id bigint generated always as identity primary key,
  email text not null,
  text text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profiles_dev enable row level security;
alter table public.notes enable row level security;
alter table public.notes_dev enable row level security;
alter table public.feedback enable row level security;
alter table public.feedback_dev enable row level security;

grant all on public.profiles to anon, authenticated, service_role;
grant all on public.profiles_dev to anon, authenticated, service_role;
grant all on public.notes to anon, authenticated, service_role;
grant all on public.notes_dev to anon, authenticated, service_role;
grant all on public.feedback to anon, authenticated, service_role;
grant all on public.feedback_dev to anon, authenticated, service_role;

grant usage, select on sequence public.notes_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.notes_dev_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.feedback_id_seq to anon, authenticated, service_role;
grant usage, select on sequence public.feedback_dev_id_seq to anon, authenticated, service_role;

drop policy if exists own_rows on public.profiles;
create policy own_rows on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists own_rows on public.profiles_dev;
create policy own_rows on public.profiles_dev
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists own_rows on public.notes;
create policy own_rows on public.notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_rows on public.notes_dev;
create policy own_rows on public.notes_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Anyone logged in can send feedback, but only with their own JWT email.
-- Only the developer can read the inbox from the client.
drop policy if exists insert_own_email on public.feedback;
create policy insert_own_email on public.feedback
  for insert to authenticated
  with check (email = (select auth.jwt() ->> 'email'));

drop policy if exists developer_read on public.feedback;
create policy developer_read on public.feedback
  for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com');

drop policy if exists insert_own_email on public.feedback_dev;
create policy insert_own_email on public.feedback_dev
  for insert to authenticated
  with check (email = (select auth.jwt() ->> 'email'));

drop policy if exists developer_read on public.feedback_dev;
create policy developer_read on public.feedback_dev
  for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'guillaumevandijk@gmail.com');

insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1)
from auth.users
on conflict (id) do nothing;

insert into public.profiles_dev (id, display_name)
select id, split_part(email, '@', 1)
from auth.users
on conflict (id) do nothing;
