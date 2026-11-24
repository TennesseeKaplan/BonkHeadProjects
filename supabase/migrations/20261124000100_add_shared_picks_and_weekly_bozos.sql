create table public.tracker_bozos (
  week_start date not null references public.tracker_weeks(week_start),
  member_id smallint not null references public.tracker_members(id),
  primary key (week_start, member_id)
);
create index tracker_bozos_member_idx on public.tracker_bozos(member_id);
alter table public.tracker_bozos enable row level security;
revoke all on public.tracker_bozos from public, anon, authenticated;
grant select on public.tracker_members to anon;
grant select, insert, update (assigned_member_id) on public.tracker_weeks to anon;
grant select, insert (week_start, member_id, pick_text), update (pick_text), delete on public.tracker_picks to anon;
grant select, insert, delete on public.tracker_bozos to anon;

create policy "Public reads roster" on public.tracker_members for select to anon using (true);
create policy "Public reads weeks" on public.tracker_weeks for select to anon using (true);
create policy "Public creates current week" on public.tracker_weeks for insert to anon with check (
  week_start = date_trunc('week', now() at time zone 'America/New_York')::date
  and pick_deadline = (week_start + 5 + time '12:00') at time zone 'America/New_York'
);
create policy "Public swaps current turn" on public.tracker_weeks for update to anon using (
  week_start = date_trunc('week', now() at time zone 'America/New_York')::date
);
create policy "Public reads picks" on public.tracker_picks for select to anon using (true);
create policy "Public adds current picks" on public.tracker_picks for insert to anon with check (
  week_start = date_trunc('week', now() at time zone 'America/New_York')::date
);
create policy "Public edits current picks" on public.tracker_picks for update to anon using (
  week_start = date_trunc('week', now() at time zone 'America/New_York')::date
);
create policy "Public clears current picks" on public.tracker_picks for delete to anon using (
  week_start = date_trunc('week', now() at time zone 'America/New_York')::date
);
create policy "Public reads Bozos" on public.tracker_bozos for select to anon using (true);
create policy "Public marks Bozos" on public.tracker_bozos for insert to anon with check (true);
create policy "Public unmarks Bozos" on public.tracker_bozos for delete to anon using (true);

insert into public.tracker_bozos (week_start, member_id)
select week_start, member_id from public.tracker_results where outcome = 'lost';
