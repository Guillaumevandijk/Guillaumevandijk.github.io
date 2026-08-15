-- Sport planning + tracking: user-defined types (name + colour) and sessions.

-- ---------------------------------------------------------------------------
-- sport_types
-- ---------------------------------------------------------------------------
create table if not exists public.sport_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text not null,
  position integer not null default 0,
  constraint sport_types_color_check check (color ~ '^#[0-9A-Fa-f]{6}$'),
  unique (user_id, name)
);

create table if not exists public.sport_types_dev (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  color text not null,
  position integer not null default 0,
  constraint sport_types_dev_color_check check (color ~ '^#[0-9A-Fa-f]{6}$'),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------------
-- sport_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.sport_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  sport_type_id uuid not null references public.sport_types(id) on delete cascade,
  session_date date not null,
  status text not null default 'planned',
  rating smallint,
  note text,
  created_at timestamptz not null default now(),
  constraint sport_sessions_status_check check (status in ('planned', 'done')),
  constraint sport_sessions_rating_check check (rating is null or (rating >= 1 and rating <= 10)),
  unique (user_id, session_date, sport_type_id)
);

create table if not exists public.sport_sessions_dev (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  sport_type_id uuid not null references public.sport_types_dev(id) on delete cascade,
  session_date date not null,
  status text not null default 'planned',
  rating smallint,
  note text,
  created_at timestamptz not null default now(),
  constraint sport_sessions_dev_status_check check (status in ('planned', 'done')),
  constraint sport_sessions_dev_rating_check check (rating is null or (rating >= 1 and rating <= 10)),
  unique (user_id, session_date, sport_type_id)
);

create index if not exists sport_types_user_id_idx on public.sport_types (user_id);
create index if not exists sport_types_dev_user_id_idx on public.sport_types_dev (user_id);
create index if not exists sport_sessions_user_date_idx on public.sport_sessions (user_id, session_date);
create index if not exists sport_sessions_dev_user_date_idx on public.sport_sessions_dev (user_id, session_date);

alter table public.sport_types enable row level security;
alter table public.sport_types_dev enable row level security;
alter table public.sport_sessions enable row level security;
alter table public.sport_sessions_dev enable row level security;

grant all on public.sport_types to anon, authenticated, service_role;
grant all on public.sport_types_dev to anon, authenticated, service_role;
grant all on public.sport_sessions to anon, authenticated, service_role;
grant all on public.sport_sessions_dev to anon, authenticated, service_role;

drop policy if exists own_rows on public.sport_types;
create policy own_rows on public.sport_types
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_rows on public.sport_types_dev;
create policy own_rows on public.sport_types_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_rows on public.sport_sessions;
create policy own_rows on public.sport_sessions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_rows on public.sport_sessions_dev;
create policy own_rows on public.sport_sessions_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

update public.profiles
set enabled_pages = array_append(enabled_pages, 'sport')
where enabled_pages is not null
  and not ('sport' = any (enabled_pages));

update public.profiles_dev
set enabled_pages = array_append(enabled_pages, 'sport')
where enabled_pages is not null
  and not ('sport' = any (enabled_pages));
