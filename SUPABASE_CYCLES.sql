-- Strength Cycle program-cycle support
-- Safe migration: preserves all existing data as Cycle 1.

alter table public.profiles
  add column if not exists active_cycle integer not null default 1;

alter table public.calibrations
  add column if not exists cycle_number integer not null default 1;

alter table public.workout_logs
  add column if not exists cycle_number integer not null default 1;

alter table public.tm_history
  add column if not exists cycle_number integer not null default 1;

create table if not exists public.program_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_number integer not null,
  name text not null,
  started_on date,
  ended_on date,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, cycle_number)
);

alter table public.program_cycles enable row level security;

drop policy if exists "cycle own" on public.program_cycles;
create policy "cycle own"
on public.program_cycles
for all
to authenticated
using (user_id=auth.uid())
with check (user_id=auth.uid());

grant select, insert, update, delete
on public.program_cycles
to authenticated;

create or replace function public.archive_and_start_next_cycle(
  p_name text,
  p_started_on date,
  p_ended_on date,
  p_summary jsonb
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_cycle integer;
  v_next integer;
begin
  select active_cycle into v_cycle
  from public.profiles
  where id=auth.uid()
  for update;

  if v_cycle is null then
    v_cycle := 1;
  end if;

  insert into public.program_cycles(user_id,cycle_number,name,started_on,ended_on,summary)
  values(auth.uid(),v_cycle,coalesce(nullif(trim(p_name),''),'Cycle '||v_cycle),p_started_on,p_ended_on,coalesce(p_summary,'{}'::jsonb))
  on conflict(user_id,cycle_number)
  do update set
    name=excluded.name,
    started_on=excluded.started_on,
    ended_on=excluded.ended_on,
    summary=excluded.summary;

  v_next := v_cycle + 1;

  update public.profiles
  set active_cycle=v_next,
      current_week=0,
      current_workout='A',
      program_start=null,
      updated_at=now()
  where id=auth.uid();

  return v_next;
end;
$$;

revoke all on function public.archive_and_start_next_cycle(text,date,date,jsonb) from public;
grant execute on function public.archive_and_start_next_cycle(text,date,date,jsonb) to authenticated;
