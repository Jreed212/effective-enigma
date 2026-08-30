-- Strength Cycle group discovery + join requests
-- Run once in Supabase SQL Editor.

create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.training_groups(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique(group_id, requester_id)
);

alter table public.group_join_requests enable row level security;

drop policy if exists "requester sees own requests" on public.group_join_requests;
create policy "requester sees own requests"
on public.group_join_requests for select
using (requester_id = auth.uid());

drop policy if exists "requester creates own request" on public.group_join_requests;
create policy "requester creates own request"
on public.group_join_requests for insert
with check (requester_id = auth.uid());

grant select, insert, update, delete on table public.group_join_requests to authenticated;

create or replace function public.list_my_groups()
returns table (
  group_id uuid,
  group_name text,
  join_code text,
  role text,
  owner_id uuid,
  member_count bigint
)
language sql
security definer
set search_path=public
as $$
  select g.id, g.name, g.join_code, gm.role, g.owner_id,
         (select count(*) from public.group_members x where x.group_id=g.id)
  from public.group_members gm
  join public.training_groups g on g.id=gm.group_id
  where gm.user_id=auth.uid()
  order by g.created_at, g.name;
$$;

create or replace function public.list_joinable_groups()
returns table (
  group_id uuid,
  group_name text,
  member_count bigint,
  request_status text
)
language sql
security definer
set search_path=public
as $$
  select g.id, g.name,
         (select count(*) from public.group_members x where x.group_id=g.id),
         r.status
  from public.training_groups g
  left join public.group_join_requests r
    on r.group_id=g.id and r.requester_id=auth.uid()
  where not exists (
    select 1 from public.group_members gm
    where gm.group_id=g.id and gm.user_id=auth.uid()
  )
  order by g.name;
$$;

create or replace function public.request_group_join(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if exists (
    select 1 from public.group_members
    where group_id=p_group_id and user_id=auth.uid()
  ) then
    raise exception 'Already a member';
  end if;

  insert into public.group_join_requests(group_id,requester_id,status,created_at,responded_at)
  values(p_group_id,auth.uid(),'pending',now(),null)
  on conflict(group_id,requester_id)
  do update set status='pending',created_at=now(),responded_at=null;
end $$;

create or replace function public.list_owned_group_requests()
returns table (
  request_id uuid,
  group_id uuid,
  group_name text,
  requester_id uuid,
  requester_name text,
  requested_at timestamptz
)
language sql
security definer
set search_path=public
as $$
  select r.id, g.id, g.name, r.requester_id,
         coalesce(p.display_name,'Lifter'), r.created_at
  from public.group_join_requests r
  join public.training_groups g on g.id=r.group_id
  left join public.profiles p on p.id=r.requester_id
  where g.owner_id=auth.uid() and r.status='pending'
  order by r.created_at;
$$;

create or replace function public.respond_group_join_request(p_request_id uuid,p_approve boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_group uuid;
  v_user uuid;
begin
  select r.group_id,r.requester_id into v_group,v_user
  from public.group_join_requests r
  join public.training_groups g on g.id=r.group_id
  where r.id=p_request_id and g.owner_id=auth.uid() and r.status='pending';

  if v_group is null then raise exception 'Request not found'; end if;

  if p_approve then
    insert into public.group_members(group_id,user_id,role)
    values(v_group,v_user,'member')
    on conflict(group_id,user_id) do nothing;

    update public.group_join_requests
    set status='approved',responded_at=now()
    where id=p_request_id;
  else
    update public.group_join_requests
    set status='declined',responded_at=now()
    where id=p_request_id;
  end if;
end $$;

revoke all on function public.list_my_groups() from public;
revoke all on function public.list_joinable_groups() from public;
revoke all on function public.request_group_join(uuid) from public;
revoke all on function public.list_owned_group_requests() from public;
revoke all on function public.respond_group_join_request(uuid,boolean) from public;

grant execute on function public.list_my_groups() to authenticated;
grant execute on function public.list_joinable_groups() to authenticated;
grant execute on function public.request_group_join(uuid) to authenticated;
grant execute on function public.list_owned_group_requests() to authenticated;
grant execute on function public.respond_group_join_request(uuid,boolean) to authenticated;
