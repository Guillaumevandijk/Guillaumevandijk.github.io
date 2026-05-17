-- Run in Supabase SQL Editor. Replace YOUR_EMAIL@example.com with your auth email.

-- ============ weight (production) ============
alter table public.weight enable row level security;

drop policy if exists "only_me" on public.weight;

create policy "only_me"
on public.weight
for all
to authenticated
using ((select auth.jwt() ->> 'email') = 'YOUR_EMAIL@example.com')
with check ((select auth.jwt() ->> 'email') = 'YOUR_EMAIL@example.com');

-- ============ weight_dev (local dev) ============
alter table public.weight_dev enable row level security;

drop policy if exists "only_me" on public.weight_dev;

create policy "only_me"
on public.weight_dev
for all
to authenticated
using ((select auth.jwt() ->> 'email') = 'YOUR_EMAIL@example.com')
with check ((select auth.jwt() ->> 'email') = 'YOUR_EMAIL@example.com');
