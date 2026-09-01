-- Strength Cycle Stats + group scoreboard
-- Run once in Supabase SQL Editor.

create unique index if not exists checkins_user_date_unique
on public.checkins(user_id, checkin_date);

create or replace function public.group_stats(p_group_id uuid)
returns table (
  member_id uuid,
  member_name text,
  workouts_completed bigint,
  start_weight numeric,
  current_weight numeric,
  weight_change numeric,
  weight_change_pct numeric,
  start_waist numeric,
  current_waist numeric,
  waist_change numeric,
  back_squat_start numeric,
  back_squat_current numeric,
  bench_press_start numeric,
  bench_press_current numeric,
  trap_bar_deadlift_start numeric,
  trap_bar_deadlift_current numeric,
  overhead_press_start numeric,
  overhead_press_current numeric
)
language sql
security definer
set search_path=public
as $$
with permitted as (
  select 1
  from public.group_members gm
  where gm.group_id=p_group_id and gm.user_id=auth.uid()
),
members as (
  select gm.user_id
  from public.group_members gm, permitted
  where gm.group_id=p_group_id
),
body as (
  select m.user_id,
    coalesce(
      (select c.body_weight from public.checkins c where c.user_id=m.user_id and c.body_weight is not null order by c.checkin_date asc limit 1),
      p.body_weight
    ) as start_weight,
    coalesce(
      (select c.body_weight from public.checkins c where c.user_id=m.user_id and c.body_weight is not null order by c.checkin_date desc limit 1),
      p.body_weight
    ) as current_weight,
    coalesce(
      (select c.waist from public.checkins c where c.user_id=m.user_id and c.waist is not null order by c.checkin_date asc limit 1),
      p.waist
    ) as start_waist,
    coalesce(
      (select c.waist from public.checkins c where c.user_id=m.user_id and c.waist is not null order by c.checkin_date desc limit 1),
      p.waist
    ) as current_waist
  from members m
  left join public.profiles p on p.id=m.user_id
),
logged_lifts as (
  select w.user_id,
         item->>'name' as lift,
         max(
           case when (s->>'weight') ~ '^[0-9]+([.][0-9]+)?$'
                  and (s->>'reps') ~ '^[0-9]+$'
                  and (s->>'reps')::numeric between 1 and 12
                then (s->>'weight')::numeric * (1 + (s->>'reps')::numeric / 30.0)
           end
         ) as best_e1rm
  from public.workout_logs w
  join members m on m.user_id=w.user_id
  cross join lateral jsonb_array_elements(w.items) item
  cross join lateral jsonb_array_elements(coalesce(item->'sets','[]'::jsonb)) s
  group by w.user_id,item->>'name'
),
lift_stats as (
  select m.user_id,
    max(c.e1rm) filter (where c.lift='Back Squat') as back_squat_start,
    greatest(
      max(c.e1rm) filter (where c.lift='Back Squat'),
      max(l.best_e1rm) filter (where l.lift='Back Squat')
    ) as back_squat_current,
    max(c.e1rm) filter (where c.lift='Bench Press') as bench_press_start,
    greatest(
      max(c.e1rm) filter (where c.lift='Bench Press'),
      max(l.best_e1rm) filter (where l.lift='Bench Press')
    ) as bench_press_current,
    max(c.e1rm) filter (where c.lift='Trap-Bar Deadlift') as trap_bar_deadlift_start,
    greatest(
      max(c.e1rm) filter (where c.lift='Trap-Bar Deadlift'),
      max(l.best_e1rm) filter (where l.lift='Trap-Bar Deadlift')
    ) as trap_bar_deadlift_current,
    max(c.e1rm) filter (where c.lift='Straight-Bar Overhead Press') as overhead_press_start,
    greatest(
      max(c.e1rm) filter (where c.lift='Straight-Bar Overhead Press'),
      max(l.best_e1rm) filter (where l.lift='Straight-Bar Overhead Press')
    ) as overhead_press_current
  from members m
  left join public.calibrations c on c.user_id=m.user_id
  left join logged_lifts l on l.user_id=m.user_id
  group by m.user_id
)
select
  m.user_id,
  coalesce(p.display_name,'Lifter') as member_name,
  (select count(*) from public.workout_logs w where w.user_id=m.user_id) as workouts_completed,
  b.start_weight,b.current_weight,
  case when b.start_weight is not null and b.current_weight is not null then b.current_weight-b.start_weight end as weight_change,
  case when b.start_weight not in (0) and b.current_weight is not null then round(((b.current_weight-b.start_weight)/b.start_weight)*100,1) end as weight_change_pct,
  b.start_waist,b.current_waist,
  case when b.start_waist is not null and b.current_waist is not null then b.current_waist-b.start_waist end as waist_change,
  ls.back_squat_start,ls.back_squat_current,
  ls.bench_press_start,ls.bench_press_current,
  ls.trap_bar_deadlift_start,ls.trap_bar_deadlift_current,
  ls.overhead_press_start,ls.overhead_press_current
from members m
left join public.profiles p on p.id=m.user_id
left join body b on b.user_id=m.user_id
left join lift_stats ls on ls.user_id=m.user_id
order by member_name;
$$;

revoke all on function public.group_stats(uuid) from public;
grant execute on function public.group_stats(uuid) to authenticated;
