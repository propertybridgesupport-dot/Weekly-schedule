-- Vacation periods are shared by personnel, across jobs and schedule weeks.
create table public.person_vacations (
  id uuid primary key default gen_random_uuid(),
  person_key text not null check (person_key ~ '^(pm|super|foreman|surveyor):.+$'),
  from_date date not null,
  to_date date not null check (to_date >= from_date),
  updated_at timestamptz not null default clock_timestamp(),
  unique (person_key, from_date, to_date)
);
alter table public.person_vacations enable row level security;

-- This app shares personnel among its signed-in scheduling staff. Reuse
-- access to the existing personnel records rather than private row ownership.
create function public.can_manage_schedule_person(p_key text)
returns boolean language sql stable security invoker set search_path = public
as $$
  select (select auth.uid()) is not null and (
    exists (select 1 from public.project_managers where p_key = 'pm:' || id::text) or
    exists (select 1 from public.superintendents where p_key = 'super:' || id::text) or
    exists (select 1 from public.foremen where p_key = 'foreman:' || id::text) or
    exists (select 1 from public.surveyors where p_key = 'surveyor:' || id::text) or
    exists (select 1 from public.schedule_item_foremen
      where nullif(btrim(split_part(split_note, '|||NIGHTS', 1)), '') is not null
      and p_key = 'foreman:' || btrim(split_part(split_note, '|||NIGHTS', 1)))
  );
$$;
revoke all on function public.can_manage_schedule_person(text) from public, anon;
grant execute on function public.can_manage_schedule_person(text) to authenticated;
create policy "scheduling staff can manage accessible personnel vacations"
on public.person_vacations for all to authenticated
using (public.can_manage_schedule_person(person_key))
with check (public.can_manage_schedule_person(person_key));
revoke all on public.person_vacations from anon;
grant select, insert, update, delete on public.person_vacations to authenticated;

-- Preserve existing entries. For conflicting overlapping dates, the most
-- recently saved job entry wins. Source job data remains intact for history.
with candidates as (
  select distinct on (v.key, v.value->>'from', v.value->>'to')
    v.key as person_key, (v.value->>'from')::date as from_date,
    (v.value->>'to')::date as to_date, s.updated_at, s.id as source_id
  from public.schedule_items s cross join lateral jsonb_each(s.vacations) v
  where v.value->>'selected' = 'true'
    and v.value->>'from' ~ '^\d{4}-\d{2}-\d{2}$'
    and v.value->>'to' ~ '^\d{4}-\d{2}-\d{2}$'
    and v.value->>'from' <= v.value->>'to'
  order by v.key, v.value->>'from', v.value->>'to', s.updated_at desc, s.id desc
)
insert into public.person_vacations (person_key, from_date, to_date, updated_at)
select c.person_key, c.from_date, c.to_date, c.updated_at from candidates c
where not exists (
  select 1 from candidates newer where newer.person_key = c.person_key
    and newer.from_date <= c.to_date and newer.to_date >= c.from_date
    and (newer.updated_at, newer.source_id) > (c.updated_at, c.source_id)
)
on conflict do nothing;

-- Apply explicitly edited people in one transaction. Per-person locks prevent
-- simultaneous saves from leaving overlapping copies. Untouched people stay put.
create function public.save_person_vacations(p_changes jsonb)
returns void language plpgsql security invoker set search_path = public
as $$
declare
  entry jsonb;
  p_key text;
  old_row public.person_vacations%rowtype;
  first_day date;
  last_day date;
begin
  if (select auth.uid()) is null then raise exception 'Please sign in again.'; end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then raise exception 'Invalid vacation changes.'; end if;
  for entry in select value from jsonb_array_elements(p_changes) order by value->>'person_key'
  loop
    p_key := entry->>'person_key';
    if not public.can_manage_schedule_person(p_key) then raise exception 'This person is not accessible.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_key, 0));
    old_row := null;
    if nullif(entry->>'record_id', '') is not null then
      select * into old_row from public.person_vacations
      where id = (entry->>'record_id')::uuid and person_key = p_key for update;
      if not found or old_row.updated_at is distinct from (entry->>'updated_at')::timestamptz then
        raise exception 'Vacation dates changed elsewhere. Refresh the schedule before saving.';
      end if;
    end if;
    if coalesce((entry->>'selected')::boolean, false) then
      first_day := (entry->>'from')::date;
      last_day := (entry->>'to')::date;
      if first_day is null or last_day is null or last_day < first_day then
        raise exception 'Enter valid vacation From and To dates.';
      end if;
      delete from public.person_vacations where person_key = p_key
        and from_date <= last_day and to_date >= first_day
        and (old_row.id is null or id <> old_row.id);
      if old_row.id is not null then
        update public.person_vacations set from_date = first_day, to_date = last_day,
          updated_at = clock_timestamp() where id = old_row.id;
      else
        insert into public.person_vacations (person_key, from_date, to_date)
        values (p_key, first_day, last_day);
      end if;
    elsif old_row.id is not null then
      delete from public.person_vacations where id = old_row.id;
    end if;
  end loop;
end;
$$;
revoke all on function public.save_person_vacations(jsonb) from public, anon;
grant execute on function public.save_person_vacations(jsonb) to authenticated;
notify pgrst, 'reload schema';
