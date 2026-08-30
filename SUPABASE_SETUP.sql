-- Strength Cycle cloud backend (Supabase/Postgres)
-- Run this in Supabase SQL Editor once per project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Lifter',
  program_start date,
  body_weight numeric,
  waist numeric,
  height text,
  goal text default 'Strength',
  current_week integer not null default 0,
  current_workout text not null default 'A',
  updated_at timestamptz not null default now()
);

create table if not exists public.calibrations (
  user_id uuid references auth.users(id) on delete cascade,
  lift text not null,
  weight numeric not null,
  reps integer not null,
  rir text,
  e1rm numeric not null,
  training_max numeric not null,
  target_guess numeric,
  ramp_sets jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, lift)
);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  body_weight numeric,
  waist numeric,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week integer not null,
  workout text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer,
  completion_reason text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tm_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  after_week integer not null,
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.training_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.training_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.calibrations enable row level security;
alter table public.checkins enable row level security;
alter table public.workout_logs enable row level security;
alter table public.tm_history enable row level security;
alter table public.training_groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "profile own" on public.profiles;
create policy "profile own" on public.profiles for all using (auth.uid()=id) with check (auth.uid()=id);

drop policy if exists "calibration own" on public.calibrations;
create policy "calibration own" on public.calibrations for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "checkin own" on public.checkins;
create policy "checkin own" on public.checkins for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "workout own" on public.workout_logs;
create policy "workout own" on public.workout_logs for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "tm own" on public.tm_history;
create policy "tm own" on public.tm_history for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "groups visible to members" on public.training_groups;
create policy "groups visible to members" on public.training_groups for select using (
  owner_id=auth.uid() or exists(select 1 from public.group_members gm where gm.group_id=id and gm.user_id=auth.uid())
);
drop policy if exists "groups owner insert" on public.training_groups;
create policy "groups owner insert" on public.training_groups for insert with check (owner_id=auth.uid());
drop policy if exists "groups owner update" on public.training_groups;
create policy "groups owner update" on public.training_groups for update using (owner_id=auth.uid()) with check (owner_id=auth.uid());

drop policy if exists "membership visible" on public.group_members;
create policy "membership visible" on public.group_members for select using (
  user_id=auth.uid() or exists(select 1 from public.training_groups g where g.id=group_id and g.owner_id=auth.uid())
);
drop policy if exists "membership self join" on public.group_members;
create policy "membership self join" on public.group_members for insert with check (user_id=auth.uid());
drop policy if exists "membership self leave" on public.group_members;
create policy "membership self leave" on public.group_members for delete using (user_id=auth.uid());

create or replace function public.join_training_group(p_code text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare gid uuid;
begin
  select id into gid from public.training_groups where upper(join_code)=upper(p_code);
  if gid is null then raise exception 'Invalid group code'; end if;
  insert into public.group_members(group_id,user_id,role)
  values(gid,auth.uid(),'member')
  on conflict(group_id,user_id) do nothing;
  return gid;
end $$;

revoke all on function public.join_training_group(text) from public;
grant execute on function public.join_training_group(text) to authenticated;
