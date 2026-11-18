create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  acct text := coalesce(meta->>'account_type', 'resident');
  ws text := meta->>'workspace';
  em text := coalesce(new.email, nullif(trim(meta->>'email'), ''));
  nm text := coalesce(nullif(trim(meta->>'full_name'), ''), nullif(trim(meta->>'name'), ''), split_part(coalesce(em, 'Guest'), '@', 1));
  area_v text := coalesce(nullif(trim(meta->>'area'), ''), 'Kanifing');
  org_id uuid;
  r public.app_role;
  staff public.app_role;
begin
  if acct not in ('resident','business','collector','institution') then acct := 'resident'; end if;
  if acct = 'institution' and coalesce(ws, '') not in ('hub','processor','admin') then acct := 'resident'; end if;

  insert into public.profiles(id, email, full_name, phone, address, area, account_type)
  values (new.id, em, left(nm, 120), left(coalesce(meta->>'phone', ''), 40), left(coalesce(meta->>'address', ''), 200), area_v,
          case when acct = 'institution' then ws else acct end);
  insert into public.wallets(user_id) values (new.id);

  if new.email is not null and exists (select 1 from public.admin_bootstrap_emails b where lower(b.email) = lower(new.email)) then
    foreach r in array enum_range(null::public.app_role) loop
      insert into public.user_roles(user_id, role) values (new.id, r) on conflict do nothing;
    end loop;
    update public.profiles set account_type = 'admin' where id = new.id;
    insert into public.collector_profiles(user_id, vehicle, areas)
      values (new.id, 'Demo truck', array['Kanifing','Serrekunda','Bakau','Banjul','Brikama','Brusubi','Sukuta','Kololi','Lamin']);
    insert into public.organization_members(org_id, user_id)
      select id, new.id from public.organizations where kind in ('hub','processor') or name = 'Kololi Sands Hotel'
      on conflict do nothing;
    return new;
  end if;

  if acct = 'resident' then
    insert into public.user_roles(user_id, role) values (new.id, 'resident');
  elsif acct = 'business' then
    insert into public.user_roles(user_id, role) values (new.id, 'business');
    insert into public.organizations(name, kind, phone, address, area)
      values (left(coalesce(nullif(trim(meta->>'business_name'), ''), nm), 120), 'business', left(coalesce(meta->>'phone', ''), 40), left(coalesce(meta->>'address', ''), 200), area_v)
      returning id into org_id;
    insert into public.organization_members(org_id, user_id) values (org_id, new.id);
  else
    -- Demo mode: staff workspaces are granted instantly (no admin approval).
    staff := (case when acct = 'collector' then 'collector' else ws end)::public.app_role;
    if staff = 'collector' then
      insert into public.collector_profiles(user_id, vehicle, areas)
        values (new.id, 'Demo truck', array['Kanifing','Serrekunda','Bakau','Banjul','Brikama','Brusubi','Sukuta','Kololi','Lamin'])
        on conflict (user_id) do update set active = true;
    elsif staff in ('hub','processor') then
      insert into public.organization_members(org_id, user_id)
        select id, new.id from public.organizations where kind::text = staff::text order by created_at limit 1
        on conflict do nothing;
    end if;
    insert into public.user_roles(user_id, role) values (new.id, staff) on conflict do nothing;
  end if;
  return new;
end $$;