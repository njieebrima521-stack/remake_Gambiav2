
create or replace function public._schedule_next_recurring()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sch public.recurring_schedules;
  next_date date;
  ref_v text;
  col_id uuid; col_name text;
  row public.pickups;
begin
  if new.schedule_id is null or old.status <> 'scheduled' or new.status not in ('collected','rejected') then
    return new;
  end if;
  select * into sch from public.recurring_schedules where id = new.schedule_id and active;
  if not found then return new; end if;
  -- Only one future visit per schedule at a time.
  if exists (select 1 from public.pickups where schedule_id = sch.id and status = 'scheduled' and id <> new.id) then
    return new;
  end if;
  next_date := new.preferred_date + case sch.frequency when 'Weekly' then interval '7 days' when 'Fortnightly' then interval '14 days' else interval '1 month' end;
  if next_date <= current_date then next_date := current_date + 1; end if;

  select cp.user_id, p.full_name into col_id, col_name
  from public.collector_profiles cp
  join public.profiles p on p.id = cp.user_id and p.active
  join public.user_roles ur on ur.user_id = cp.user_id and ur.role = 'collector'
  where cp.active
  order by (new.area = any(cp.areas)) desc,
           (select count(*) from public.pickups x where x.collector_id = cp.user_id and x.status = 'scheduled') asc,
           cp.created_at
  limit 1;

  ref_v := 'PU-' || nextval('public.pickup_ref_seq');
  insert into public.pickups(ref, qr_code, owner_id, owner_type, organization_id, customer_name, phone, address, area,
    material_id, bags, preferred_date, slot, notes, collector_id, collector_name, schedule_id, frequency)
  values (ref_v, 'RMK-' || ref_v || '-' || public._rand4(), new.owner_id, new.owner_type, new.organization_id, new.customer_name,
    new.phone, new.address, new.area, sch.material_id, sch.bags, next_date, sch.slot, new.notes,
    col_id, col_name, sch.id, sch.frequency)
  returning * into row;
  insert into public.pickup_status_history(pickup_id, status, actor_id, note) values (row.id, 'scheduled', null, 'Recurring ' || lower(sch.frequency) || ' pickup');
  perform public._notify(new.owner_id, 'pickup', 'Next recurring pickup scheduled',
    row.ref || ' on ' || to_char(next_date, 'DD Mon') || coalesce(' with ' || col_name, '') || '.', '/business/pickups');
  if col_id is not null then
    perform public._notify(col_id, 'pickup', 'New pickup assigned', row.customer_name || ' · ' || row.area || ' on ' || to_char(next_date, 'DD Mon'), '/collector/stops/' || row.ref);
  end if;
  return new;
end $$;

revoke execute on function public._schedule_next_recurring() from public, anon, authenticated;

create trigger pickups_schedule_next_recurring after update of status on public.pickups
  for each row execute function public._schedule_next_recurring();
