-- Per-person vacation dates belong to this job's weekly schedule.
-- Existing schedule_items RLS policies continue to govern these details.
alter table public.schedule_items
  add column if not exists vacations jsonb not null default '{}'::jsonb
  constraint schedule_items_vacations_object check (jsonb_typeof(vacations) = 'object');

notify pgrst, 'reload schema';
