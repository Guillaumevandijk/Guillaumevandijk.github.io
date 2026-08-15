-- Saved week plans that can be applied to next week.

create table if not exists public.sport_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sport_templates_dev (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sport_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.sport_templates(id) on delete cascade,
  weekday smallint not null,
  sport_type_id uuid not null references public.sport_types(id) on delete cascade,
  constraint sport_template_items_weekday_check check (weekday >= 0 and weekday <= 6),
  unique (template_id, weekday, sport_type_id)
);

create table if not exists public.sport_template_items_dev (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.sport_templates_dev(id) on delete cascade,
  weekday smallint not null,
  sport_type_id uuid not null references public.sport_types_dev(id) on delete cascade,
  constraint sport_template_items_dev_weekday_check check (weekday >= 0 and weekday <= 6),
  unique (template_id, weekday, sport_type_id)
);

create index if not exists sport_templates_user_id_idx on public.sport_templates (user_id);
create index if not exists sport_templates_dev_user_id_idx on public.sport_templates_dev (user_id);
create index if not exists sport_template_items_template_id_idx on public.sport_template_items (template_id);
create index if not exists sport_template_items_dev_template_id_idx on public.sport_template_items_dev (template_id);

alter table public.sport_templates enable row level security;
alter table public.sport_templates_dev enable row level security;
alter table public.sport_template_items enable row level security;
alter table public.sport_template_items_dev enable row level security;

grant all on public.sport_templates to anon, authenticated, service_role;
grant all on public.sport_templates_dev to anon, authenticated, service_role;
grant all on public.sport_template_items to anon, authenticated, service_role;
grant all on public.sport_template_items_dev to anon, authenticated, service_role;

drop policy if exists own_rows on public.sport_templates;
create policy own_rows on public.sport_templates
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_rows on public.sport_templates_dev;
create policy own_rows on public.sport_templates_dev
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists own_template_items on public.sport_template_items;
create policy own_template_items on public.sport_template_items
  for all to authenticated
  using (
    exists (
      select 1 from public.sport_templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sport_templates t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );

drop policy if exists own_template_items on public.sport_template_items_dev;
create policy own_template_items on public.sport_template_items_dev
  for all to authenticated
  using (
    exists (
      select 1 from public.sport_templates_dev t
      where t.id = template_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.sport_templates_dev t
      where t.id = template_id and t.user_id = auth.uid()
    )
  );
