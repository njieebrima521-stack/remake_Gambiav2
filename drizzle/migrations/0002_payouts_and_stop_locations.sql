create sequence if not exists public.payout_ref_seq start 501;

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  kind text not null check (kind in ('collector','partner')),
  payee_user_id uuid references public.profiles(id) on delete set null,
  partner text,
  payee_name text not null,
  item_count int not null default 0,
  quantity numeric not null default 0,
  rate numeric,
  amount_gmd numeric(12,2) not null check (amount_gmd >= 0),
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  method text,
  reference text,
  note text,
  requested_by uuid,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  paid_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid
);
create index payouts_payee_idx on public.payouts(payee_user_id);
create index payouts_status_idx on public.payouts(status);
grant select on public.payouts to authenticated;
grant all on public.payouts to service_role;
alter table public.payouts enable row level security;
create policy "Own payouts or admin" on public.payouts for select to authenticated
  using (payee_user_id = auth.uid() or public.is_admin());

alter table public.collections add column payout_id uuid references public.payouts(id) on delete set null;
create index collections_payout_idx on public.collections(payout_id);
alter table public.redemptions add column payout_id uuid references public.payouts(id) on delete set null;
alter table public.redemptions add column value_gmd int;
alter table public.redemptions add column partner text;
create index redemptions_payout_idx on public.redemptions(payout_id);

update public.redemptions r set value_gmd = rw.value_gmd, partner = rw.partner
from public.rewards rw where rw.id = r.reward_id and r.value_gmd is null;

create or replace function public._redemption_snapshot()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select value_gmd, partner into new.value_gmd, new.partner from public.rewards where id = new.reward_id;
  return new;
end $$;
create trigger redemptions_snapshot before insert on public.redemptions
  for each row execute function public._redemption_snapshot();

create table public.pickup_locations (
  pickup_id uuid primary key references public.pickups(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  source text not null default 'geocode' check (source in ('geocode','area','manual')),
  label text,
  updated_at timestamptz not null default now()
);
grant select on public.pickup_locations to authenticated;
grant all on public.pickup_locations to service_role;
alter table public.pickup_locations enable row level security;
create policy "Locations follow pickup visibility" on public.pickup_locations for select to authenticated
  using (exists (select 1 from public.pickups p where p.id = pickup_id));

create or replace function public.set_pickup_location(_pickup uuid, _lat double precision, _lng double precision, _source text, _label text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.pickups;
begin
  if uid is null then raise exception 'You need to sign in first.'; end if;
  select * into p from public.pickups where id = _pickup;
  if not found then raise exception 'Pickup not found.'; end if;
  if not ((p.collector_id = uid and public.has_role(uid, 'collector')) or public.is_admin()) then
    raise exception 'Your account is not allowed to do this.';
  end if;
  if _lat is null or _lng is null or _lat not between -90 and 90 or _lng not between -180 and 180 then
    raise exception 'Invalid location.';
  end if;
  if coalesce(_source, '') not in ('geocode','area','manual') then raise exception 'Invalid location source.'; end if;
  insert into public.pickup_locations(pickup_id, lat, lng, source, label)
  values (_pickup, _lat, _lng, _source, left(_label, 200))
  on conflict (pickup_id) do update set lat = excluded.lat, lng = excluded.lng, source = excluded.source, label = excluded.label, updated_at = now();
end $$;

create or replace function public._create_collector_payout(_collector uuid, _actor uuid)
returns public.payouts language plpgsql security definer set search_path = public as $$
declare po public.payouts; rate_v numeric; n int; kg numeric; nm text;
begin
  select value into rate_v from public.platform_settings where key = 'collector_rate_gmd_per_kg';
  rate_v := coalesce(rate_v, 0);
  perform 1 from public.collections c
    where c.collector_id = _collector and c.accepted and c.weight_kg is not null and c.payout_id is null
    for update;
  select count(*), coalesce(sum(c.weight_kg), 0) into n, kg from public.collections c
    where c.collector_id = _collector and c.accepted and c.weight_kg is not null and c.payout_id is null;
  if n = 0 then raise exception 'There are no unpaid collections to pay out.'; end if;
  select coalesce(nullif(full_name, ''), email, 'Collector') into nm from public.profiles where id = _collector;
  insert into public.payouts(ref, kind, payee_user_id, payee_name, item_count, quantity, rate, amount_gmd, requested_by)
  values ('PO-' || nextval('public.payout_ref_seq'), 'collector', _collector, nm, n, kg, rate_v, round(kg * rate_v, 2), _actor)
  returning * into po;
  update public.collections set payout_id = po.id
    where collector_id = _collector and accepted and weight_kg is not null and payout_id is null;
  perform public._log('create_payout', 'payout', po.ref, jsonb_build_object('kind', 'collector', 'amount', po.amount_gmd, 'kg', kg));
  return po;
end $$;

create or replace function public.request_collector_payout()
returns public.payouts language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('collector'); po public.payouts;
begin
  if exists (select 1 from public.payouts where payee_user_id = uid and kind = 'collector' and status = 'pending') then
    raise exception 'You already have a payout request waiting to be paid.';
  end if;
  po := public._create_collector_payout(uid, uid);
  perform public._notify_role('admin', 'coins', 'Payout requested',
    po.payee_name || ' requested ' || po.ref || ' · GMD ' || po.amount_gmd, '/admin');
  return po;
end $$;

create or replace function public.admin_create_collector_payout(_collector uuid)
returns public.payouts language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('admin'); po public.payouts;
begin
  po := public._create_collector_payout(_collector, uid);
  perform public._notify(_collector, 'coins', 'Payout prepared',
    po.ref || ' · GMD ' || po.amount_gmd || ' for ' || po.quantity || ' kg is being paid.', '/collector/earnings');
  return po;
end $$;

create or replace function public.admin_create_partner_payout(_partner text)
returns public.payouts language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('admin'); po public.payouts; n int; amt numeric; p text := trim(coalesce(_partner, ''));
begin
  if p = '' then raise exception 'Choose a partner.'; end if;
  perform 1 from public.redemptions r where r.partner = p and r.status <> 'Cancelled' and r.payout_id is null for update;
  select count(*), coalesce(sum(coalesce(r.value_gmd, 0)), 0) into n, amt from public.redemptions r
    where r.partner = p and r.status <> 'Cancelled' and r.payout_id is null;
  if n = 0 then raise exception 'There are no unpaid vouchers for this partner.'; end if;
  insert into public.payouts(ref, kind, partner, payee_name, item_count, quantity, amount_gmd, requested_by)
  values ('PO-' || nextval('public.payout_ref_seq'), 'partner', p, p, n, n, round(amt, 2), uid)
  returning * into po;
  update public.redemptions set payout_id = po.id where partner = p and status <> 'Cancelled' and payout_id is null;
  perform public._log('create_payout', 'payout', po.ref, jsonb_build_object('kind', 'partner', 'partner', p, 'amount', po.amount_gmd, 'vouchers', n));
  return po;
end $$;

create or replace function public.admin_mark_payout_paid(_payout uuid, _method text, _reference text, _note text)
returns public.payouts language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('admin'); po public.payouts; ref_v text := trim(coalesce(_reference, ''));
begin
  if coalesce(_method, '') not in ('Mobile money','Bank transfer','Cash') then raise exception 'Choose how the payout was paid.'; end if;
  if _method <> 'Cash' and length(ref_v) < 3 then raise exception 'Enter the payment reference from the transfer.'; end if;
  select * into po from public.payouts where id = _payout for update;
  if not found then raise exception 'Payout not found.'; end if;
  if po.status <> 'pending' then raise exception 'This payout was already %.', po.status; end if;
  update public.payouts set status = 'paid', method = _method, reference = nullif(left(ref_v, 80), ''),
    note = nullif(left(trim(coalesce(_note, '')), 300), ''), paid_at = now(), paid_by = uid
    where id = po.id returning * into po;
  if po.kind = 'collector' and po.payee_user_id is not null then
    perform public._notify(po.payee_user_id, 'coins', 'Payout paid',
      po.ref || ' · GMD ' || po.amount_gmd || ' sent by ' || lower(_method) || coalesce(' (ref ' || po.reference || ')', '') || '.', '/collector/earnings');
  end if;
  perform public._log('pay_payout', 'payout', po.ref, jsonb_build_object('method', _method, 'reference', po.reference, 'amount', po.amount_gmd));
  return po;
end $$;

create or replace function public.admin_cancel_payout(_payout uuid, _note text)
returns public.payouts language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('admin'); po public.payouts;
begin
  select * into po from public.payouts where id = _payout for update;
  if not found then raise exception 'Payout not found.'; end if;
  if po.status <> 'pending' then raise exception 'Only pending payouts can be cancelled.'; end if;
  update public.collections set payout_id = null where payout_id = po.id;
  update public.redemptions set payout_id = null where payout_id = po.id;
  update public.payouts set status = 'cancelled', note = nullif(left(trim(coalesce(_note, '')), 300), ''), cancelled_at = now(), cancelled_by = uid
    where id = po.id returning * into po;
  if po.kind = 'collector' and po.payee_user_id is not null then
    perform public._notify(po.payee_user_id, 'coins', 'Payout cancelled',
      po.ref || ' was cancelled. Its collections are unpaid again.', '/collector/earnings');
  end if;
  perform public._log('cancel_payout', 'payout', po.ref, jsonb_build_object('amount', po.amount_gmd));
  return po;
end $$;

create or replace function public.admin_payout_balances()
returns table(kind text, payee_user_id uuid, payee_name text, item_count bigint, quantity numeric, amount_gmd numeric)
language plpgsql stable security definer set search_path = public as $$
declare rate_v numeric;
begin
  perform public._require_role('admin');
  select coalesce(value, 0) into rate_v from public.platform_settings where key = 'collector_rate_gmd_per_kg';
  return query
    select 'collector'::text, c.collector_id, coalesce(nullif(p.full_name, ''), p.email, 'Collector'),
           count(*), coalesce(sum(c.weight_kg), 0), round(coalesce(sum(c.weight_kg), 0) * coalesce(rate_v, 0), 2)
    from public.collections c join public.profiles p on p.id = c.collector_id
    where c.accepted and c.weight_kg is not null and c.payout_id is null
    group by c.collector_id, p.full_name, p.email
    union all
    select 'partner'::text, null::uuid, r.partner, count(*), count(*)::numeric, round(coalesce(sum(coalesce(r.value_gmd, 0)), 0), 2)
    from public.redemptions r
    where r.status <> 'Cancelled' and r.payout_id is null and coalesce(r.partner, '') <> ''
    group by r.partner;
end $$;

revoke execute on function public._redemption_snapshot() from public, anon, authenticated;
revoke execute on function public._create_collector_payout(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.set_pickup_location(uuid, double precision, double precision, text, text) from public, anon;
revoke execute on function public.request_collector_payout() from public, anon;
revoke execute on function public.admin_create_collector_payout(uuid) from public, anon;
revoke execute on function public.admin_create_partner_payout(text) from public, anon;
revoke execute on function public.admin_mark_payout_paid(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_cancel_payout(uuid, text) from public, anon;
revoke execute on function public.admin_payout_balances() from public, anon;
grant execute on function public.set_pickup_location(uuid, double precision, double precision, text, text) to authenticated;
grant execute on function public.request_collector_payout() to authenticated;
grant execute on function public.admin_create_collector_payout(uuid) to authenticated;
grant execute on function public.admin_create_partner_payout(text) to authenticated;
grant execute on function public.admin_mark_payout_paid(uuid, text, text, text) to authenticated;
grant execute on function public.admin_cancel_payout(uuid, text) to authenticated;
grant execute on function public.admin_payout_balances() to authenticated;