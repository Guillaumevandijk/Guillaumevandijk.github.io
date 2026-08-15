-- Extra run details on a completed Hardlopen sport session.
alter table public.sport_sessions
  add column if not exists distance_km numeric(6, 2);

alter table public.sport_sessions
  add column if not exists tempo_seconds integer;

alter table public.sport_sessions_dev
  add column if not exists distance_km numeric(6, 2);

alter table public.sport_sessions_dev
  add column if not exists tempo_seconds integer;
