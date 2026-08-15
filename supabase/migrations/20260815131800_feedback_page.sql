-- Remember which page a feedback message was sent from.
alter table public.feedback
  add column if not exists page text;

alter table public.feedback_dev
  add column if not exists page text;
