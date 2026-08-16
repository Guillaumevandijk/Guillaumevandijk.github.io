-- Allow Loopje as a Hardlopen training kind.

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
