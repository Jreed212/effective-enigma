-- Strength Cycle authenticated API permissions
-- Run once in Supabase SQL Editor after SUPABASE_SETUP.sql.

grant usage on schema public to authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.calibrations to authenticated;
grant select, insert, update, delete on table public.checkins to authenticated;
grant select, insert, update, delete on table public.workout_logs to authenticated;
grant select, insert, update, delete on table public.tm_history to authenticated;
grant select, insert, update, delete on table public.training_groups to authenticated;
grant select, insert, update, delete on table public.group_members to authenticated;

grant execute on function public.join_training_group(text) to authenticated;
