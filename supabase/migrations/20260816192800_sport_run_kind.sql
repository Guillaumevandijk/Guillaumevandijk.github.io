-- Training kind for Hardlopen sessions, plus interval details.

alter table public.sport_sessions
  add column if not exists run_kind text;

alter table public.sport_sessions
  add column if not exists interval_sets smallint;

alter table public.sport_sessions
  add column if not exists interval_set_seconds integer;

alter table public.sport_sessions
  add column if not exists interval_tempo_seconds integer;

alter table public.sport_sessions_dev
  add column if not exists run_kind text;

alter table public.sport_sessions_dev
  add column if not exists interval_sets smallint;

alter table public.sport_sessions_dev
  add column if not exists interval_set_seconds integer;

alter table public.sport_sessions_dev
  add column if not exists interval_tempo_seconds integer;

alter table public.sport_sessions
  drop constraint if exists sport_sessions_run_kind_check;
alter table public.sport_sessions
  add constraint sport_sessions_run_kind_check
  check (run_kind is null or run_kind in ('duurloop', 'herstelloop', 'loopje', 'interval'));

alter table public.sport_sessions_dev
  drop constraint if exists sport_sessions_dev_run_kind_check;
alter table public.sport_sessions_dev
  add constraint sport_sessions_dev_run_kind_check
  check (run_kind is null or run_kind in ('duurloop', 'herstelloop', 'loopje', 'interval'));
