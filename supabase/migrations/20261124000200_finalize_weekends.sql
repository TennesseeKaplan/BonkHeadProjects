alter table public.tracker_weeks add column finalized_at timestamptz;

update public.tracker_weeks set finalized_at = now()
where week_start < (select max(week_start) from public.tracker_weeks);

insert into public.tracker_weeks (week_start, assigned_member_id, pick_deadline)
select date '2026-11-23', 1, timestamptz '2026-11-28 12:00:00 America/New_York'
where not exists (select 1 from public.tracker_weeks);

create unique index tracker_single_active_week
on public.tracker_weeks ((finalized_at is null)) where finalized_at is null;

drop policy "Public creates current week" on public.tracker_weeks;
revoke insert on public.tracker_weeks from anon;

drop policy "Public swaps current turn" on public.tracker_weeks;
create policy "Public swaps active turn" on public.tracker_weeks for update to anon
using (finalized_at is null) with check (finalized_at is null);

drop policy "Public adds current picks" on public.tracker_picks;
drop policy "Public edits current picks" on public.tracker_picks;
drop policy "Public clears current picks" on public.tracker_picks;
create policy "Public adds active picks" on public.tracker_picks for insert to anon
with check (exists (select 1 from public.tracker_weeks w where w.week_start = tracker_picks.week_start and w.finalized_at is null));
create policy "Public edits active picks" on public.tracker_picks for update to anon
using (exists (select 1 from public.tracker_weeks w where w.week_start = tracker_picks.week_start and w.finalized_at is null));
create policy "Public clears active picks" on public.tracker_picks for delete to anon
using (exists (select 1 from public.tracker_weeks w where w.week_start = tracker_picks.week_start and w.finalized_at is null));

drop policy "Public marks Bozos" on public.tracker_bozos;
drop policy "Public unmarks Bozos" on public.tracker_bozos;
create policy "Public marks active Bozos" on public.tracker_bozos for insert to anon
with check (exists (select 1 from public.tracker_weeks w where w.week_start = tracker_bozos.week_start and w.finalized_at is null));
create policy "Public unmarks active Bozos" on public.tracker_bozos for delete to anon
using (exists (select 1 from public.tracker_weeks w where w.week_start = tracker_bozos.week_start and w.finalized_at is null));

create schema tracker_internal;
revoke all on schema tracker_internal from public;
grant usage on schema tracker_internal to anon;

-- Serialize pick and BOZO changes with finalization using the same parent row lock.
create function tracker_internal.guard_week_edits() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  target_week date := case when tg_op = 'DELETE' then old.week_start else new.week_start end;
begin
  perform 1 from public.tracker_weeks
    where week_start = target_week and finalized_at is null for update;
  if not found then raise exception 'This weekend is closed'; end if;
  if tg_table_name = 'tracker_bozos' and tg_op = 'INSERT' and
     exists (
       select 1 from public.tracker_members m where not exists (
         select 1 from public.tracker_picks p where p.week_start = target_week and p.member_id = m.id
       )
     )
  then raise exception 'All picks must be saved before marking a BOZO'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function tracker_internal.guard_week_edits() from public;

create trigger tracker_guard_pick_edits before insert or update or delete on public.tracker_picks
for each row execute function tracker_internal.guard_week_edits();
create trigger tracker_guard_bozo_edits before insert or delete on public.tracker_bozos
for each row execute function tracker_internal.guard_week_edits();

create function tracker_internal.finalize_week(target_week date) returns date
language plpgsql security definer set search_path = ''
as $$
declare
  closed_at timestamptz;
  next_week date := target_week + 7;
  next_member smallint;
begin
  select finalized_at into closed_at from public.tracker_weeks
    where week_start = target_week for update;
  if not found then raise exception 'Weekend not found'; end if;
  if closed_at is not null then return next_week; end if;

  if exists (
    select 1 from public.tracker_members m where not exists (
      select 1 from public.tracker_picks p where p.week_start = target_week and p.member_id = m.id
    )
  ) or not exists (select 1 from public.tracker_bozos where week_start = target_week)
  then raise exception 'Save all picks and mark at least one BOZO first'; end if;

  -- Rotation follows the schedule even if this weekend's turn was swapped.
  select id into strict next_member from public.tracker_members
  order by rotation_position
  offset (((next_week - date '2026-11-23') / 7 % 5 + 5) % 5)
  limit 1;

  update public.tracker_weeks set finalized_at = now() where week_start = target_week;
  insert into public.tracker_weeks (week_start, assigned_member_id, pick_deadline)
  values (next_week, next_member, (next_week + 5 + time '12:00') at time zone 'America/New_York');
  return next_week;
end $$;
revoke all on function tracker_internal.finalize_week(date) from public;
grant execute on function tracker_internal.finalize_week(date) to anon;

create function public.tracker_finalize_week(target_week date) returns date
language sql security invoker set search_path = ''
as $$ select tracker_internal.finalize_week(target_week) $$;
revoke all on function public.tracker_finalize_week(date) from public, authenticated;
grant execute on function public.tracker_finalize_week(date) to anon;
