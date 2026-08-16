-- Habits belong to Voeding / Beweging / Slaap. Food macros are mandatory voeding habits.
-- Nutrition plan lives on the profile.

alter table public.habits
  add column if not exists page text not null default 'sport';
alter table public.habits
  add column if not exists mandatory boolean not null default false;

alter table public.habits_dev
  add column if not exists page text not null default 'sport';
alter table public.habits_dev
  add column if not exists mandatory boolean not null default false;

alter table public.habits
  drop constraint if exists habits_page_check;
alter table public.habits
  add constraint habits_page_check
  check (page in ('voeding', 'sport', 'sleep'));

alter table public.habits_dev
  drop constraint if exists habits_dev_page_check;
alter table public.habits_dev
  add constraint habits_dev_page_check
  check (page in ('voeding', 'sport', 'sleep'));

alter table public.profiles
  add column if not exists nutrition_plan jsonb not null default '{}'::jsonb;
alter table public.profiles_dev
  add column if not exists nutrition_plan jsonb not null default '{}'::jsonb;

-- Existing habits stay on Beweging. Enable Voeding. Keep Beweging if they used Gewoontes.
update public.profiles
set enabled_pages = array_append(enabled_pages, 'voeding')
where enabled_pages is not null
  and not ('voeding' = any (enabled_pages));

update public.profiles_dev
set enabled_pages = array_append(enabled_pages, 'voeding')
where enabled_pages is not null
  and not ('voeding' = any (enabled_pages));

update public.profiles
set enabled_pages = array_append(enabled_pages, 'sport')
where enabled_pages is not null
  and ('habits' = any (enabled_pages))
  and not ('sport' = any (enabled_pages));

update public.profiles_dev
set enabled_pages = array_append(enabled_pages, 'sport')
where enabled_pages is not null
  and ('habits' = any (enabled_pages))
  and not ('sport' = any (enabled_pages));

insert into public.habits (user_id, name, position, kind, page, mandatory, starts_on)
select p.id, v.name, v.position, 'normal', 'voeding', true, current_date
from public.profiles p
cross join (
  values
    ('Eiwitten', 0),
    ('Vetten', 1),
    ('Koolhydraten', 2),
    ('Vochtintake', 3)
) as v(name, position)
where not exists (
  select 1
  from public.habits h
  where h.user_id = p.id
    and h.page = 'voeding'
    and h.mandatory
    and lower(h.name) = lower(v.name)
);

insert into public.habits_dev (user_id, name, position, kind, page, mandatory, starts_on)
select p.id, v.name, v.position, 'normal', 'voeding', true, current_date
from public.profiles_dev p
cross join (
  values
    ('Eiwitten', 0),
    ('Vetten', 1),
    ('Koolhydraten', 2),
    ('Vochtintake', 3)
) as v(name, position)
where not exists (
  select 1
  from public.habits_dev h
  where h.user_id = p.id
    and h.page = 'voeding'
    and h.mandatory
    and lower(h.name) = lower(v.name)
);
