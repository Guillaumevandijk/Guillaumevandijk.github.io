-- Split cheat meals into item(s) + optional explanation.

alter table public.cheat_meals
  add column if not exists items text;

alter table public.cheat_meals_dev
  add column if not exists items text;

update public.cheat_meals
set items = description
where items is null or items = '';

update public.cheat_meals_dev
set items = description
where items is null or items = '';

alter table public.cheat_meals
  alter column items set not null;

alter table public.cheat_meals_dev
  alter column items set not null;

alter table public.cheat_meals
  alter column description drop not null;

alter table public.cheat_meals_dev
  alter column description drop not null;
