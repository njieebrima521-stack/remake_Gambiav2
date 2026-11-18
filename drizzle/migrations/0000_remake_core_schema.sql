
create type public.app_role as enum ('resident','business','collector','hub','processor','admin');
create type public.pickup_status as enum ('scheduled','collected','batched','verified','rejected');
create type public.batch_status as enum ('ready','in_transit','verified');
create type public.batch_decision as enum ('accepted','partial','rejected');
create type public.coin_txn_type as enum ('earned','pending','redeemed','forfeited');
create type public.request_status as enum ('pending','approved','rejected');

create sequence public.pickup_ref_seq start 1001;
create sequence public.batch_ref_seq start 301;
create sequence public.receipt_seq start 88001;
create sequence public.redemption_ref_seq start 201;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  phone text not null default '',
  address text not null default '',
  area text not null default 'Kanifing',
  language text not null default 'English',
  sms_alerts boolean not null default true,
  account_type text not null default 'resident',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id and ur.role = _role and p.active
  )
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create policy "Own profile or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "Own roles or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('business','hub','processor')),
  phone text not null default '',
  address text not null default '',
  area text not null default '',
  materials text[] not null default '{}',
  status text not null default 'active' check (status in ('active','onboarding','suspended')),
  created_at timestamptz not null default now()
);
grant select on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
grant select on public.organization_members to authenticated;
grant all on public.organization_members to service_role;
alter table public.organization_members enable row level security;

create or replace function public.is_org_member(_org uuid, _user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members where org_id = _org and user_id = _user)
$$;

create policy "Hubs and processors are visible; own org; admin" on public.organizations for select to authenticated
  using (kind in ('hub','processor') or public.is_org_member(id) or public.is_admin());
create policy "Own memberships or admin" on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table public.collector_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  vehicle text not null default '',
  areas text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.collector_profiles to authenticated;
grant all on public.collector_profiles to service_role;
alter table public.collector_profiles enable row level security;
create policy "Own collector profile or admin" on public.collector_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table public.role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  status public.request_status not null default 'pending',
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index role_requests_one_pending on public.role_requests (user_id, role) where status = 'pending';
grant select on public.role_requests to authenticated;
grant all on public.role_requests to service_role;
alter table public.role_requests enable row level security;
create policy "Own requests or admin" on public.role_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table public.admin_bootstrap_emails (email text primary key);
grant all on public.admin_bootstrap_emails to service_role;
alter table public.admin_bootstrap_emails enable row level security;

create table public.materials (
  id text primary key,
  name text not null,
  examples text not null default '',
  points_per_kg numeric not null check (points_per_kg >= 0),
  accepted text[] not null default '{}',
  not_accepted text[] not null default '{}',
  prep text[] not null default '{}',
  active boolean not null default true,
  sort int not null default 0
);
grant select on public.materials to anon, authenticated;
grant all on public.materials to service_role;
alter table public.materials enable row level security;
create policy "Materials are public" on public.materials for select to anon, authenticated using (true);

create table public.platform_settings (
  key text primary key,
  value numeric not null,
  label text not null default ''
);
grant select on public.platform_settings to authenticated;
grant all on public.platform_settings to service_role;
alter table public.platform_settings enable row level security;
create policy "Settings readable by signed-in users" on public.platform_settings for select to authenticated using (true);

create table public.recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  material_id text not null references public.materials(id),
  bags int not null,
  slot text not null,
  frequency text not null check (frequency in ('Weekly','Fortnightly','Monthly')),
  start_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.recurring_schedules to authenticated;
grant all on public.recurring_schedules to service_role;
alter table public.recurring_schedules enable row level security;
create policy "Own schedules, org, admin" on public.recurring_schedules for select to authenticated
  using (owner_id = auth.uid() or (organization_id is not null and public.is_org_member(organization_id)) or public.is_admin());

create table public.pickups (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  qr_code text not null unique,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  owner_type text not null check (owner_type in ('resident','business')),
  organization_id uuid references public.organizations(id) on delete set null,
  customer_name text not null,
  phone text not null default '',
  address text not null,
  area text not null,
  material_id text not null references public.materials(id),
  bags int not null check (bags between 1 and 50),
  preferred_date date not null,
  slot text not null,
  notes text,
  status public.pickup_status not null default 'scheduled',
  collector_id uuid references public.profiles(id) on delete set null,
  collector_name text,
  schedule_id uuid references public.recurring_schedules(id) on delete set null,
  frequency text,
  client_request_id uuid unique,
  points_pending int not null default 0,
  points_awarded int,
  accepted_kg numeric,
  batch_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pickups_owner_idx on public.pickups(owner_id);
create index pickups_collector_idx on public.pickups(collector_id);
create index pickups_status_idx on public.pickups(status);
create index pickups_org_idx on public.pickups(organization_id);
grant select on public.pickups to authenticated;
grant all on public.pickups to service_role;
alter table public.pickups enable row level security;
create policy "Pickup visibility by role" on public.pickups for select to authenticated using (
  owner_id = auth.uid()
  or (organization_id is not null and public.is_org_member(organization_id))
  or (collector_id = auth.uid() and public.has_role(auth.uid(), 'collector'))
  or public.has_role(auth.uid(), 'hub')
  or public.is_admin()
);

create table public.pickup_status_history (
  id uuid primary key default gen_random_uuid(),
  pickup_id uuid not null references public.pickups(id) on delete cascade,
  status public.pickup_status not null,
  actor_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index psh_pickup_idx on public.pickup_status_history(pickup_id);
grant select on public.pickup_status_history to authenticated;
grant all on public.pickup_status_history to service_role;
alter table public.pickup_status_history enable row level security;
create policy "History follows pickup visibility" on public.pickup_status_history for select to authenticated
  using (exists (select 1 from public.pickups p where p.id = pickup_id));

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  pickup_id uuid not null unique references public.pickups(id) on delete cascade,
  collector_id uuid references public.profiles(id) on delete set null,
  receipt_no text unique,
  weight_kg numeric check (weight_kg is null or (weight_kg > 0 and weight_kg <= 500)),
  accepted boolean not null,
  reject_reason text,
  photo_path text,
  offline_recorded boolean not null default false,
  client_request_id uuid unique,
  collected_at timestamptz not null default now(),
  hub_received_at timestamptz,
  hub_received_by uuid,
  batch_id uuid
);
create index collections_collector_idx on public.collections(collector_id);
grant select on public.collections to authenticated;
grant all on public.collections to service_role;
alter table public.collections enable row level security;
create policy "Collections follow pickup visibility" on public.collections for select to authenticated
  using (collector_id = auth.uid() or exists (select 1 from public.pickups p where p.id = pickup_id));

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  qr_code text not null unique,
  material_id text not null references public.materials(id),
  processor_org_id uuid not null references public.organizations(id),
  processor_name text not null,
  total_kg numeric not null,
  status public.batch_status not null default 'ready',
  created_by uuid,
  created_at timestamptz not null default now(),
  handed_over_at timestamptz,
  handed_over_by uuid
);
grant select on public.batches to authenticated;
grant all on public.batches to service_role;
alter table public.batches enable row level security;
create policy "Batch visibility by role" on public.batches for select to authenticated using (
  public.has_role(auth.uid(), 'hub')
  or public.is_admin()
  or (public.has_role(auth.uid(), 'processor') and public.is_org_member(processor_org_id))
  or exists (select 1 from public.pickups p where p.batch_id = batches.id)
);

create table public.batch_items (
  batch_id uuid not null references public.batches(id) on delete cascade,
  collection_id uuid not null unique references public.collections(id) on delete cascade,
  pickup_id uuid not null references public.pickups(id) on delete cascade,
  weight_kg numeric not null,
  primary key (batch_id, collection_id)
);
grant select on public.batch_items to authenticated;
grant all on public.batch_items to service_role;
alter table public.batch_items enable row level security;
create policy "Items follow batch visibility" on public.batch_items for select to authenticated
  using (exists (select 1 from public.batches b where b.id = batch_id));

create table public.batch_verifications (
  batch_id uuid primary key references public.batches(id) on delete cascade,
  actual_kg numeric not null,
  accepted_kg numeric not null,
  rejected_kg numeric not null,
  grade text not null,
  note text,
  decision public.batch_decision not null,
  verified_by uuid not null,
  verified_at timestamptz not null default now()
);
grant select on public.batch_verifications to authenticated;
grant all on public.batch_verifications to service_role;
alter table public.batch_verifications enable row level security;
create policy "Verifications follow batch visibility" on public.batch_verifications for select to authenticated
  using (exists (select 1 from public.batches b where b.id = batch_id));

create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  available int not null default 0 check (available >= 0),
  pending int not null default 0 check (pending >= 0),
  updated_at timestamptz not null default now()
);
grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "Own wallet or admin" on public.wallets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table public.rewards (
  id text primary key,
  name text not null,
  partner text not null,
  category text not null check (category in ('Airtime & Data','Household','Food','Education','Services')),
  cost int not null check (cost > 0),
  value_gmd int not null default 0,
  stock int not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.rewards to authenticated;
grant all on public.rewards to service_role;
alter table public.rewards enable row level security;
create policy "Listed rewards or admin" on public.rewards for select to authenticated
  using (active or public.is_admin());

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_id text not null references public.rewards(id),
  name text not null,
  cost int not null,
  voucher text not null unique,
  status text not null default 'Issued' check (status in ('Issued','Delivered','Cancelled')),
  client_request_id uuid unique,
  created_at timestamptz not null default now()
);
grant select on public.redemptions to authenticated;
grant all on public.redemptions to service_role;
alter table public.redemptions enable row level security;
create policy "Own redemptions or admin" on public.redemptions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table public.redemption_status_history (
  id uuid primary key default gen_random_uuid(),
  redemption_id uuid not null references public.redemptions(id) on delete cascade,
  status text not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.redemption_status_history to authenticated;
grant all on public.redemption_status_history to service_role;
alter table public.redemption_status_history enable row level security;
create policy "Follows redemption visibility" on public.redemption_status_history for select to authenticated
  using (exists (select 1 from public.redemptions r where r.id = redemption_id));

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.coin_txn_type not null,
  amount int not null,
  label text not null,
  pickup_id uuid references public.pickups(id) on delete set null,
  redemption_id uuid references public.redemptions(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index coin_txn_one_earned_per_pickup on public.coin_transactions(pickup_id) where type = 'earned';
create unique index coin_txn_one_pending_per_pickup on public.coin_transactions(pickup_id) where type = 'pending';
create index coin_txn_user_idx on public.coin_transactions(user_id);
grant select on public.coin_transactions to authenticated;
grant all on public.coin_transactions to service_role;
alter table public.coin_transactions enable row level security;
create policy "Own transactions or admin" on public.coin_transactions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_path text,
  items jsonb not null default '[]',
  primary_material text references public.materials(id),
  accepted boolean not null default false,
  contaminated boolean not null default false,
  estimated_kg numeric not null default 0,
  advice text,
  source text not null default 'ai' check (source in ('ai','manual')),
  created_at timestamptz not null default now()
);
grant select, insert on public.scans to authenticated;
grant all on public.scans to service_role;
alter table public.scans enable row level security;
create policy "Own scans or admin" on public.scans for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "Insert own scans" on public.scans for insert to authenticated
  with check (user_id = auth.uid());

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'pickup' check (kind in ('pickup','coins','reward','tip','batch','account')),
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Own notifications" on public.notifications for select to authenticated
  using (user_id = auth.uid());

create table public.activity_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
grant select on public.activity_log to authenticated;
grant all on public.activity_log to service_role;
alter table public.activity_log enable row level security;
create policy "Admins read activity" on public.activity_log for select to authenticated using (public.is_admin());

alter publication supabase_realtime add table public.notifications;

create or replace function public._notify(_user uuid, _kind text, _title text, _body text, _link text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, kind, title, body, link) values (_user, _kind, _title, _body, _link);
$$;

create or replace function public._notify_role(_role public.app_role, _kind text, _title text, _body text, _link text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, kind, title, body, link)
  select ur.user_id, _kind, _title, _body, _link from public.user_roles ur
  join public.profiles p on p.id = ur.user_id and p.active
  where ur.role = _role;
$$;

create or replace function public._notify_org(_org uuid, _kind text, _title text, _body text, _link text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, kind, title, body, link)
  select m.user_id, _kind, _title, _body, _link from public.organization_members m
  join public.profiles p on p.id = m.user_id and p.active
  where m.org_id = _org;
$$;

create or replace function public._log(_action text, _entity text, _entity_id text, _details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.activity_log(actor_id, action, entity, entity_id, details) values (auth.uid(), _action, _entity, _entity_id, _details);
$$;

create or replace function public._require_role(_role public.app_role)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'You need to sign in first.'; end if;
  if not public.has_role(uid, _role) then raise exception 'Your account is not allowed to do this.'; end if;
  return uid;
end $$;

create or replace function public._rand4() returns text language sql volatile as $$
  select upper(substr(md5(gen_random_uuid()::text), 1, 4))
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  acct text := coalesce(meta->>'account_type', 'resident');
  ws text := meta->>'workspace';
  nm text := coalesce(nullif(trim(meta->>'full_name'), ''), nullif(trim(meta->>'name'), ''), split_part(coalesce(new.email, ''), '@', 1));
  area_v text := coalesce(nullif(trim(meta->>'area'), ''), 'Kanifing');
  org_id uuid;
  r public.app_role;
begin
  if acct not in ('resident','business','collector','institution') then acct := 'resident'; end if;
  if acct = 'institution' and coalesce(ws, '') not in ('hub','processor','admin') then acct := 'resident'; end if;

  insert into public.profiles(id, email, full_name, phone, address, area, account_type)
  values (new.id, new.email, left(nm, 120), left(coalesce(meta->>'phone', ''), 40), left(coalesce(meta->>'address', ''), 200), area_v,
          case when acct = 'institution' then ws else acct end);
  insert into public.wallets(user_id) values (new.id);

  if exists (select 1 from public.admin_bootstrap_emails b where lower(b.email) = lower(new.email)) then
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
    insert into public.role_requests(user_id, role)
      values (new.id, (case when acct = 'collector' then 'collector' else ws end)::public.app_role);
    perform public._notify_role('admin', 'account', 'New staff sign-up',
      nm || ' asked for ' || (case when acct = 'collector' then 'collector' else ws end) || ' access.', '/admin');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.update_my_profile(_full_name text, _phone text, _address text, _area text, _language text, _sms_alerts boolean)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); row public.profiles;
begin
  if uid is null then raise exception 'You need to sign in first.'; end if;
  if length(trim(coalesce(_full_name, ''))) < 2 then raise exception 'Enter your name.'; end if;
  if trim(coalesce(_phone, '')) !~ '^\+?[0-9 ]{7,20}$' then raise exception 'Enter a valid phone number.'; end if;
  if coalesce(_language, '') not in ('English','Wolof','Mandinka') then raise exception 'Choose a language.'; end if;
  update public.profiles set full_name = left(trim(_full_name), 120), phone = trim(_phone), address = left(trim(coalesce(_address, '')), 200),
    area = left(trim(coalesce(_area, 'Kanifing')), 60), language = _language, sms_alerts = coalesce(_sms_alerts, true), updated_at = now()
  where id = uid returning * into row;
  return row;
end $$;

create or replace function public.mark_notifications_read(_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (_ids is null or id = any(_ids));
$$;

create or replace function public.book_pickup(
  _material text, _bags int, _date date, _slot text, _address text, _area text,
  _notes text, _client_request_id uuid, _frequency text default null)
returns public.pickups language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  prof public.profiles;
  existing public.pickups;
  row public.pickups;
  o_type text;
  org public.organizations;
  col_id uuid; col_name text;
  sched uuid;
  ref_v text;
  mat public.materials;
begin
  if uid is null then raise exception 'You need to sign in first.'; end if;
  if _client_request_id is not null then
    select * into existing from public.pickups where client_request_id = _client_request_id;
    if found then
      if existing.owner_id <> uid then raise exception 'Duplicate request.'; end if;
      return existing;
    end if;
  end if;

  if _frequency is not null then
    if not public.has_role(uid, 'business') then raise exception 'Only business accounts can schedule recurring pickups.'; end if;
    if _frequency not in ('Weekly','Fortnightly','Monthly') then raise exception 'Choose a valid frequency.'; end if;
    o_type := 'business';
    select o.* into org from public.organizations o join public.organization_members m on m.org_id = o.id
      where m.user_id = uid and o.kind = 'business' order by o.created_at limit 1;
    if not found then raise exception 'Your business profile is missing.'; end if;
  elsif public.has_role(uid, 'resident') then
    o_type := 'resident';
  else
    raise exception 'Your account cannot book pickups.';
  end if;

  select * into mat from public.materials where id = _material and active;
  if not found then raise exception 'This material is not currently accepted.'; end if;
  if _bags is null or _bags < 1 or _bags > 50 then raise exception 'Bags must be between 1 and 50.'; end if;
  if _date is null or _date < current_date then raise exception 'Choose today or a future date.'; end if;
  if _date > current_date + 120 then raise exception 'Choose a date within the next four months.'; end if;
  if length(trim(coalesce(_slot, ''))) = 0 then raise exception 'Choose a time slot.'; end if;
  if length(trim(coalesce(_address, ''))) < 3 then raise exception 'Enter the pickup address.'; end if;
  if length(coalesce(_notes, '')) > 500 then raise exception 'Notes are too long.'; end if;

  select * into prof from public.profiles where id = uid;

  select cp.user_id, p.full_name into col_id, col_name
  from public.collector_profiles cp
  join public.profiles p on p.id = cp.user_id and p.active
  join public.user_roles ur on ur.user_id = cp.user_id and ur.role = 'collector'
  where cp.active
  order by (_area = any(cp.areas)) desc,
           (select count(*) from public.pickups x where x.collector_id = cp.user_id and x.status = 'scheduled') asc,
           cp.created_at
  limit 1;

  if o_type = 'business' then
    insert into public.recurring_schedules(owner_id, organization_id, material_id, bags, slot, frequency, start_date)
      values (uid, org.id, _material, _bags, trim(_slot), _frequency, _date) returning id into sched;
  end if;

  ref_v := 'PU-' || nextval('public.pickup_ref_seq');
  insert into public.pickups(ref, qr_code, owner_id, owner_type, organization_id, customer_name, phone, address, area,
    material_id, bags, preferred_date, slot, notes, collector_id, collector_name, schedule_id, frequency, client_request_id)
  values (ref_v, 'RMK-' || ref_v || '-' || public._rand4(), uid, o_type, org.id,
    case when o_type = 'business' then org.name else prof.full_name end,
    case when o_type = 'business' and org.phone <> '' then org.phone else prof.phone end,
    left(trim(_address), 200), left(trim(coalesce(_area, prof.area)), 60), _material, _bags, _date, trim(_slot),
    nullif(left(trim(coalesce(_notes, '')), 500), ''), col_id, col_name, sched, _frequency, _client_request_id)
  returning * into row;

  insert into public.pickup_status_history(pickup_id, status, actor_id, note) values (row.id, 'scheduled', uid, 'Booked');
  perform public._notify(uid, 'pickup', 'Pickup booked',
    mat.name || ' pickup ' || row.ref || ' is scheduled' || coalesce(' with ' || col_name, ' — a collector will be assigned soon') || '.',
    case when o_type = 'resident' then '/resident/pickups/' || row.ref else '/business/pickups' end);
  if col_id is not null then
    perform public._notify(col_id, 'pickup', 'New pickup assigned', row.customer_name || ' · ' || mat.name || ' · ' || row.area || ' on ' || to_char(_date, 'DD Mon'), '/collector/stops/' || row.ref);
  else
    perform public._notify_role('admin', 'pickup', 'Pickup needs a collector', row.ref || ' in ' || row.area || ' has no collector yet.', '/admin');
  end if;
  perform public._log('book_pickup', 'pickup', row.ref, jsonb_build_object('material', _material, 'bags', _bags));
  return row;
end $$;

create or replace function public.verify_pickup_code(_pickup uuid, _code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('collector'); p public.pickups; c text := upper(trim(coalesce(_code, '')));
begin
  select * into p from public.pickups where id = _pickup;
  if not found or (p.collector_id is distinct from uid) then raise exception 'This pickup is not assigned to you.'; end if;
  if c = '' then raise exception 'Enter or scan the pickup code.'; end if;
  if c <> upper(p.qr_code) and c <> upper(p.ref) then raise exception 'This code does not match the pickup.'; end if;
  return true;
end $$;

create or replace function public.record_collection(_pickup uuid, _weight numeric, _photo_path text, _offline boolean, _client_request_id uuid)
returns public.collections language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._require_role('collector');
  p public.pickups; c public.collections; mat public.materials; pts int := 0; w numeric;
begin
  if _client_request_id is not null then
    select * into c from public.collections where client_request_id = _client_request_id;
    if found then return c; end if;
  end if;
  select * into p from public.pickups where id = _pickup for update;
  if not found or p.collector_id is distinct from uid then raise exception 'This pickup is not assigned to you.'; end if;
  if p.status <> 'scheduled' then raise exception 'This pickup has already been recorded.'; end if;
  if _weight is null or _weight <= 0 or _weight > 500 then raise exception 'Enter a weight between 0.1 and 500 kg.'; end if;
  if _photo_path is not null and split_part(_photo_path, '/', 1) <> uid::text then raise exception 'Invalid photo.'; end if;
  w := round(_weight, 1);
  select * into mat from public.materials where id = p.material_id;

  insert into public.collections(pickup_id, collector_id, receipt_no, weight_kg, accepted, photo_path, offline_recorded, client_request_id)
  values (p.id, uid, 'RC-' || nextval('public.receipt_seq'), w, true, _photo_path, coalesce(_offline, false), _client_request_id)
  returning * into c;

  if p.owner_type = 'resident' then
    pts := round(mat.points_per_kg * w)::int;
    update public.wallets set pending = pending + pts, updated_at = now() where user_id = p.owner_id;
    insert into public.coin_transactions(user_id, type, amount, label, pickup_id)
      values (p.owner_id, 'pending', pts, mat.name || ' pickup ' || p.ref || ' · awaiting verification', p.id);
  end if;
  update public.pickups set status = 'collected', points_pending = pts, updated_at = now() where id = p.id;
  insert into public.pickup_status_history(pickup_id, status, actor_id, note) values (p.id, 'collected', uid, w || ' kg recorded');
  perform public._notify(p.owner_id, 'pickup', 'Waste collected',
    coalesce(p.collector_name, 'Your collector') || ' recorded ' || w || ' kg. Receipt ' || c.receipt_no ||
    case when pts > 0 then '. ' || pts || ' Green Coins pending verification.' else '.' end,
    case when p.owner_type = 'resident' then '/resident/pickups/' || p.ref else '/business/pickups' end);
  perform public._log('record_collection', 'pickup', p.ref, jsonb_build_object('kg', w));
  return c;
end $$;

create or replace function public.reject_pickup(_pickup uuid, _reason text, _offline boolean, _client_request_id uuid)
returns public.collections language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('collector'); p public.pickups; c public.collections;
begin
  if _client_request_id is not null then
    select * into c from public.collections where client_request_id = _client_request_id;
    if found then return c; end if;
  end if;
  select * into p from public.pickups where id = _pickup for update;
  if not found or p.collector_id is distinct from uid then raise exception 'This pickup is not assigned to you.'; end if;
  if p.status <> 'scheduled' then raise exception 'This pickup has already been recorded.'; end if;
  if length(trim(coalesce(_reason, ''))) < 3 then raise exception 'Give a reason for the rejection.'; end if;
  insert into public.collections(pickup_id, collector_id, accepted, reject_reason, offline_recorded, client_request_id)
  values (p.id, uid, false, left(trim(_reason), 200), coalesce(_offline, false), _client_request_id) returning * into c;
  update public.pickups set status = 'rejected', updated_at = now() where id = p.id;
  insert into public.pickup_status_history(pickup_id, status, actor_id, note) values (p.id, 'rejected', uid, c.reject_reason);
  perform public._notify(p.owner_id, 'pickup', 'Pickup not accepted', 'Reason: ' || c.reject_reason,
    case when p.owner_type = 'resident' then '/resident/pickups/' || p.ref else '/business/pickups' end);
  perform public._log('reject_pickup', 'pickup', p.ref, jsonb_build_object('reason', c.reject_reason));
  return c;
end $$;

create or replace function public.create_batch(_pickup_ids uuid[], _processor_org uuid)
returns public.batches language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._require_role('hub');
  org public.organizations; b public.batches; n int; mats int; mat text; total numeric; ref_v text; rec record;
begin
  if _pickup_ids is null or cardinality(_pickup_ids) = 0 then raise exception 'Select at least one load.'; end if;
  select * into org from public.organizations where id = _processor_org and kind = 'processor' and status <> 'suspended';
  if not found then raise exception 'Choose an active processor.'; end if;
  perform 1 from public.pickups where id = any(_pickup_ids) for update;
  select count(*), count(distinct material_id), min(material_id) into n, mats, mat
    from public.pickups where id = any(_pickup_ids) and status = 'collected';
  if n <> cardinality(_pickup_ids) then raise exception 'Some loads are no longer waiting at the hub.'; end if;
  if mats <> 1 then raise exception 'A batch can only contain one material.'; end if;
  select sum(c.weight_kg) into total from public.collections c where c.pickup_id = any(_pickup_ids) and c.accepted;

  ref_v := 'BT-' || nextval('public.batch_ref_seq');
  insert into public.batches(ref, qr_code, material_id, processor_org_id, processor_name, total_kg, created_by)
  values (ref_v, 'RMK-' || ref_v || '-' || public._rand4(), mat, org.id, org.name, round(total, 1), uid) returning * into b;

  insert into public.batch_items(batch_id, collection_id, pickup_id, weight_kg)
    select b.id, c.id, c.pickup_id, c.weight_kg from public.collections c where c.pickup_id = any(_pickup_ids);
  update public.collections set hub_received_at = coalesce(hub_received_at, now()), hub_received_by = uid, batch_id = b.id
    where pickup_id = any(_pickup_ids);
  update public.pickups set status = 'batched', batch_id = b.id, updated_at = now() where id = any(_pickup_ids);
  insert into public.pickup_status_history(pickup_id, status, actor_id, note)
    select unnest(_pickup_ids), 'batched', uid, 'Batch ' || ref_v;
  for rec in select owner_id, ref, owner_type from public.pickups where id = any(_pickup_ids) loop
    perform public._notify(rec.owner_id, 'batch', 'Received at the hub',
      'Pickup ' || rec.ref || ' was received and added to batch ' || ref_v || ' for ' || org.name || '.',
      case when rec.owner_type = 'resident' then '/resident/pickups/' || rec.ref else '/business/pickups' end);
  end loop;
  perform public._notify_org(org.id, 'batch', 'Batch prepared', ref_v || ' (' || round(total, 1) || ' kg) is being prepared at the hub.', '/processor');
  perform public._log('create_batch', 'batch', ref_v, jsonb_build_object('pickups', cardinality(_pickup_ids), 'kg', total));
  return b;
end $$;

create or replace function public.hand_over_batch(_batch uuid)
returns public.batches language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('hub'); b public.batches;
begin
  select * into b from public.batches where id = _batch for update;
  if not found then raise exception 'Batch not found.'; end if;
  if b.status <> 'ready' then raise exception 'This batch has already been handed over.'; end if;
  update public.batches set status = 'in_transit', handed_over_at = now(), handed_over_by = uid where id = b.id returning * into b;
  perform public._notify_org(b.processor_org_id, 'batch', 'Batch handed over', b.ref || ' (' || b.total_kg || ' kg) is on its way for inspection.', '/processor/batches/' || b.ref);
  perform public._log('hand_over_batch', 'batch', b.ref);
  return b;
end $$;

create or replace function public.verify_batch(_batch uuid, _actual numeric, _rejected numeric, _grade text, _note text)
returns public.batch_verifications language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public._require_role('processor');
  b public.batches; v public.batch_verifications; accepted numeric; ratio numeric; dec public.batch_decision;
  rec record; acc_kg numeric; awarded int; pend int;
begin
  select * into b from public.batches where id = _batch for update;
  if not found then raise exception 'Batch not found.'; end if;
  if not public.is_org_member(b.processor_org_id, uid) then raise exception 'This batch was not sent to your organisation.'; end if;
  if b.status = 'verified' or exists (select 1 from public.batch_verifications where batch_id = b.id) then
    raise exception 'This batch has already been verified.';
  end if;
  if b.status <> 'in_transit' then raise exception 'The hub has not handed this batch over yet.'; end if;
  if _actual is null or _actual <= 0 or _actual > 100000 then raise exception 'Enter the actual weight.'; end if;
  if _rejected is null or _rejected < 0 or _rejected > _actual then raise exception 'Rejected weight must be between 0 and the actual weight.'; end if;
  if coalesce(_grade, '') not in ('Grade A','Grade B','Grade C') then raise exception 'Choose a quality grade.'; end if;
  accepted := round(_actual - _rejected, 1);
  if accepted <= 0 and length(trim(coalesce(_note, ''))) = 0 then raise exception 'Add a note explaining the rejection.'; end if;
  dec := case when _rejected <= 0 and accepted > 0 then 'accepted' when accepted <= 0 then 'rejected' else 'partial' end;
  ratio := accepted / _actual;

  insert into public.batch_verifications(batch_id, actual_kg, accepted_kg, rejected_kg, grade, note, decision, verified_by)
  values (b.id, round(_actual, 1), accepted, round(_rejected, 1), _grade, nullif(left(trim(coalesce(_note, '')), 500), ''), dec, uid)
  returning * into v;

  for rec in
    select p.id, p.ref, p.owner_id, p.owner_type, p.points_pending, bi.weight_kg, m.points_per_kg, m.name as mname
    from public.batch_items bi join public.pickups p on p.id = bi.pickup_id join public.materials m on m.id = p.material_id
    where bi.batch_id = b.id for update of p
  loop
    acc_kg := round(rec.weight_kg * ratio, 1);
    if rec.owner_type = 'resident' then
      awarded := round(rec.points_per_kg * acc_kg)::int;
      pend := coalesce(rec.points_pending, 0);
      perform 1 from public.wallets where user_id = rec.owner_id for update;
      update public.wallets set pending = greatest(0, pending - pend), available = available + awarded, updated_at = now()
        where user_id = rec.owner_id;
      insert into public.coin_transactions(user_id, type, amount, label, pickup_id)
        values (rec.owner_id, 'earned', awarded, rec.mname || ' pickup ' || rec.ref || ' verified', rec.id);
      if pend > awarded then
        insert into public.coin_transactions(user_id, type, amount, label, pickup_id)
          values (rec.owner_id, 'forfeited', -(pend - awarded), 'Rejected weight on ' || rec.ref, rec.id);
      end if;
      update public.pickups set status = 'verified', accepted_kg = acc_kg, points_awarded = awarded, points_pending = 0, updated_at = now() where id = rec.id;
      perform public._notify(rec.owner_id, 'coins', 'Green Coins available',
        '+' || awarded || ' coins released for ' || rec.ref || ' after processor verification (' || acc_kg || ' kg accepted).', '/resident/rewards');
    else
      update public.pickups set status = 'verified', accepted_kg = acc_kg, updated_at = now() where id = rec.id;
      perform public._notify(rec.owner_id, 'batch', 'Collection verified', rec.ref || ': ' || acc_kg || ' kg accepted by ' || b.processor_name || '.', '/business/pickups');
    end if;
    insert into public.pickup_status_history(pickup_id, status, actor_id, note) values (rec.id, 'verified', uid, acc_kg || ' kg accepted');
  end loop;

  update public.batches set status = 'verified' where id = b.id;
  perform public._notify_role('hub', 'batch', 'Batch verified', b.ref || ': ' || accepted || ' kg accepted by ' || b.processor_name || '.', '/hub/batches/' || b.ref);
  perform public._log('verify_batch', 'batch', b.ref, jsonb_build_object('accepted', accepted, 'rejected', _rejected, 'decision', dec));
  return v;
end $$;

create or replace function public.lookup_batch_code(_code text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('processor'); b public.batches; c text := upper(trim(coalesce(_code, '')));
begin
  select * into b from public.batches where upper(qr_code) = c or upper(ref) = c;
  if not found then raise exception 'No batch matches this code.'; end if;
  if not public.is_org_member(b.processor_org_id, uid) then raise exception 'This batch was not sent to your organisation.'; end if;
  return b.ref;
end $$;

create or replace function public.redeem_reward(_reward text, _client_request_id uuid)
returns public.redemptions language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('resident'); rw public.rewards; w public.wallets; r public.redemptions;
begin
  if _client_request_id is not null then
    select * into r from public.redemptions where client_request_id = _client_request_id and user_id = uid;
    if found then return r; end if;
  end if;
  select * into rw from public.rewards where id = _reward for update;
  if not found or not rw.active then raise exception 'This reward is not available.'; end if;
  if rw.stock <= 0 then raise exception 'This reward is out of stock.'; end if;
  select * into w from public.wallets where user_id = uid for update;
  if w.available < rw.cost then raise exception 'You need % more Green Coins.', rw.cost - w.available; end if;

  update public.wallets set available = available - rw.cost, updated_at = now() where user_id = uid;
  update public.rewards set stock = stock - 1 where id = rw.id;
  insert into public.redemptions(ref, user_id, reward_id, name, cost, voucher, client_request_id)
  values ('RD-' || nextval('public.redemption_ref_seq'), uid, rw.id, rw.name, rw.cost,
          'RMK-' || upper(left(regexp_replace(rw.id, '[^a-zA-Z]', '', 'g'), 3)) || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6)),
          _client_request_id)
  returning * into r;
  insert into public.redemption_status_history(redemption_id, status, actor_id) values (r.id, 'Issued', uid);
  insert into public.coin_transactions(user_id, type, amount, label, redemption_id) values (uid, 'redeemed', -rw.cost, rw.name, r.id);
  perform public._notify(uid, 'reward', 'Reward redeemed', rw.name || ' · voucher ' || r.voucher, '/resident/rewards');
  perform public._log('redeem_reward', 'redemption', r.ref, jsonb_build_object('reward', rw.id, 'cost', rw.cost));
  return r;
end $$;

create or replace function public.admin_set_user_active(_user uuid, _active boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('admin');
begin
  if _user = uid then raise exception 'You cannot suspend your own account.'; end if;
  update public.profiles set active = _active, updated_at = now() where id = _user;
  perform public._log(case when _active then 'activate_user' else 'suspend_user' end, 'user', _user::text);
end $$;

create or replace function public.admin_set_role(_user uuid, _role public.app_role, _grant boolean, _org uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('admin'); prof public.profiles;
begin
  select * into prof from public.profiles where id = _user;
  if not found then raise exception 'User not found.'; end if;
  if not _grant then
    if _user = uid and _role = 'admin' then raise exception 'You cannot remove your own admin role.'; end if;
    delete from public.user_roles where user_id = _user and role = _role;
  else
    if _role = 'processor' then
      if _org is null or not exists (select 1 from public.organizations where id = _org and kind = 'processor') then
        raise exception 'Choose the processor organisation for this user.';
      end if;
      insert into public.organization_members(org_id, user_id) values (_org, _user) on conflict do nothing;
    elsif _role = 'hub' then
      insert into public.organization_members(org_id, user_id)
        select coalesce(_org, (select id from public.organizations where kind = 'hub' order by created_at limit 1)), _user
        on conflict do nothing;
    elsif _role = 'collector' then
      insert into public.collector_profiles(user_id, areas) values (_user, array[prof.area]) on conflict (user_id) do update set active = true;
    end if;
    insert into public.user_roles(user_id, role) values (_user, _role) on conflict do nothing;
    perform public._notify(_user, 'account', 'Access granted', 'You now have ' || _role || ' access in Remake.', '/' || _role);
  end if;
  perform public._log(case when _grant then 'grant_role' else 'revoke_role' end, 'user', _user::text, jsonb_build_object('role', _role));
end $$;

create or replace function public.admin_decide_role_request(_request uuid, _approve boolean, _org uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('admin'); rq public.role_requests;
begin
  select * into rq from public.role_requests where id = _request for update;
  if not found or rq.status <> 'pending' then raise exception 'This request was already handled.'; end if;
  if _approve then
    perform public.admin_set_role(rq.user_id, rq.role, true, _org);
  else
    perform public._notify(rq.user_id, 'account', 'Access request declined', 'Your ' || rq.role || ' access request was not approved.', null);
  end if;
  update public.role_requests set status = case when _approve then 'approved'::public.request_status else 'rejected'::public.request_status end,
    decided_by = uid, decided_at = now() where id = rq.id;
end $$;

create or replace function public.admin_assign_collector(_pickup uuid, _collector uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('admin'); p public.pickups; nm text;
begin
  select * into p from public.pickups where id = _pickup for update;
  if not found or p.status <> 'scheduled' then raise exception 'Only scheduled pickups can be reassigned.'; end if;
  if not public.has_role(_collector, 'collector') then raise exception 'That user is not an active collector.'; end if;
  select full_name into nm from public.profiles where id = _collector;
  update public.pickups set collector_id = _collector, collector_name = nm, updated_at = now() where id = p.id;
  perform public._notify(_collector, 'pickup', 'New pickup assigned', p.customer_name || ' · ' || p.area, '/collector/stops/' || p.ref);
  perform public._log('assign_collector', 'pickup', p.ref, jsonb_build_object('collector', _collector));
end $$;

create or replace function public.admin_update_material(_id text, _points numeric, _active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_role('admin');
  if _points is null or _points < 0 or _points > 1000 then raise exception 'Rate must be between 0 and 1000 coins per kg.'; end if;
  update public.materials set points_per_kg = _points, active = coalesce(_active, active) where id = _id;
  if not found then raise exception 'Material not found.'; end if;
  perform public._log('update_material', 'material', _id, jsonb_build_object('points_per_kg', _points, 'active', _active));
end $$;

create or replace function public.admin_upsert_reward(_id text, _name text, _partner text, _category text, _cost int, _value int, _stock int, _active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_role('admin');
  if _id !~ '^[a-z0-9-]{2,40}$' then raise exception 'Reward ID must use lowercase letters, numbers and dashes.'; end if;
  if length(trim(coalesce(_name, ''))) < 2 then raise exception 'Enter a reward name.'; end if;
  if _cost is null or _cost <= 0 then raise exception 'Cost must be more than 0.'; end if;
  if _stock is null or _stock < 0 then raise exception 'Stock cannot be negative.'; end if;
  insert into public.rewards(id, name, partner, category, cost, value_gmd, stock, active)
  values (_id, trim(_name), trim(coalesce(_partner, '')), _category, _cost, coalesce(_value, 0), _stock, coalesce(_active, true))
  on conflict (id) do update set name = excluded.name, partner = excluded.partner, category = excluded.category,
    cost = excluded.cost, value_gmd = excluded.value_gmd, stock = excluded.stock, active = excluded.active;
  perform public._log('upsert_reward', 'reward', _id, jsonb_build_object('cost', _cost, 'stock', _stock, 'active', _active));
end $$;

create or replace function public.admin_set_redemption_status(_id uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_role('admin'); r public.redemptions;
begin
  if _status not in ('Issued','Delivered') then raise exception 'Invalid status.'; end if;
  update public.redemptions set status = _status where id = _id returning * into r;
  if not found then raise exception 'Redemption not found.'; end if;
  insert into public.redemption_status_history(redemption_id, status, actor_id) values (_id, _status, uid);
  perform public._notify(r.user_id, 'reward', 'Reward ' || lower(_status), r.name || ' · voucher ' || r.voucher, '/resident/rewards');
end $$;

create or replace function public.admin_set_setting(_key text, _value numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_role('admin');
  if _value is null or _value < 0 then raise exception 'Value must be zero or more.'; end if;
  update public.platform_settings set value = _value where key = _key;
  if not found then raise exception 'Unknown setting.'; end if;
  perform public._log('update_setting', 'setting', _key, jsonb_build_object('value', _value));
end $$;

create or replace function public.admin_set_org_status(_org uuid, _status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_role('admin');
  if _status not in ('active','onboarding','suspended') then raise exception 'Invalid status.'; end if;
  update public.organizations set status = _status where id = _org;
  perform public._log('update_org', 'organization', _org::text, jsonb_build_object('status', _status));
end $$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname <> 'handle_new_user'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if left(f.proname, 1) = '_' then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create policy "Upload own scan images" on storage.objects for insert to authenticated
  with check (bucket_id = 'scan-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Read own scan images" on storage.objects for select to authenticated
  using (bucket_id = 'scan-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "Collectors upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'collection-photos' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role(auth.uid(), 'collector'));
create policy "Read collection photos" on storage.objects for select to authenticated
  using (bucket_id = 'collection-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin() or public.has_role(auth.uid(), 'hub')));

insert into public.admin_bootstrap_emails(email) values ('remake@gmai.com');

insert into public.platform_settings(key, value, label) values
  ('collector_rate_gmd_per_kg', 6, 'Collector pay per kg (GMD)'),
  ('coins_per_gmd', 10, 'Green Coins per GMD 1');

insert into public.materials(id, name, examples, points_per_kg, accepted, not_accepted, prep, sort) values
('plastic','Plastics','Bottles, buckets, chairs, cups',15,
  array['PET water & soft-drink bottles','HDPE buckets and jerrycans','Plastic chairs and crates','Cups and food tubs (rinsed)'],
  array['Pure-water sachets with food residue','Styrofoam','Plastic mixed with metal parts'],
  array['Empty and rinse containers','Remove caps and keep them in the same bag','Flatten bottles to save space','Keep plastics dry and separate from food waste'],1),
('metal','Metals','Cans, tables, gas containers',20,
  array['Aluminium drink cans','Tin food cans','Old metal tables and frames','Empty, depressurised gas containers'],
  array['Cans with paint or oil residue','Pressurised or leaking gas bottles'],
  array['Rinse food cans','Crush aluminium cans','Ensure gas containers are fully empty and valve open','Separate metal from wood or plastic parts'],2),
('glass','Glass','Bottles, jars, mirrors',8,
  array['Clear and green bottles','Food jars','Intact mirrors (wrapped)'],
  array['Light bulbs','Window glass','Ceramic plates and cups'],
  array['Remove lids and corks','Rinse jars','Wrap broken pieces in paper and label them','Do not mix with ceramics'],3),
('paper','Paper & Cardboard','Boxes, newspapers, exercise books',10,
  array['Cardboard boxes','Newspapers and magazines','Office paper and old exercise books'],
  array['Wet or greasy paper','Paper cups with plastic lining','Tissue paper'],
  array['Flatten boxes','Tie paper in bundles','Keep dry — wet paper is rejected'],4),
('ewaste','Electronic Waste','Phones, chargers, cables, radios',30,
  array['Mobile phones and tablets','Chargers and cables','Radios, small appliances','Computer parts'],
  array['Leaking or swollen batteries','Fridges (book a special collection)'],
  array['Remove batteries and hand them over separately','Erase personal data from phones','Bundle cables together'],5),
('organic','Organic Waste','Food scraps, peels, garden waste',5,
  array['Fruit and vegetable peels','Coconut husks','Garden leaves and grass'],
  array['Meat and bones','Plastic bags with food','Animal waste'],
  array['Drain liquids','Use a covered bucket','Keep free of plastic and glass'],6);

insert into public.rewards(id, name, partner, category, cost, value_gmd, stock) values
('airtime-50','Africell Airtime GMD 50','Africell','Airtime & Data',500,50,240),
('data-2gb','QCell 2GB Data Bundle','QCell','Airtime & Data',900,90,120),
('cashpower-100','NAWEC Cash Power GMD 100','NAWEC','Services',1000,100,80),
('delivery','Free Delivery Voucher','Gamjobs Express','Services',1000,100,60),
('bag','Reusable Shopping Bag','Remake Store','Household',350,35,300),
('bin','Household Sorting Bin','Remake Store','Household',5000,500,25),
('rice','Rice Bag 5kg','Kairaba Supermarket','Food',3200,320,40),
('books','School Exercise Books (10)','Timbooktoo','Education',2200,220,90),
('dispenser','Water Dispenser','Remake Store','Household',10000,1000,8);

insert into public.organizations(name, kind, address, area, materials, status) values
('Kanifing Recycling Hub','hub','Kanifing Industrial Estate','Kanifing', array['plastic','metal','glass','paper','ewaste','organic'],'active'),
('Gambia Polymer Works','processor','Banjul Industrial Area','Banjul', array['plastic','paper'],'active'),
('Banjul Metal Recovery','processor','Half Die','Banjul', array['metal','ewaste'],'active'),
('Brikama Compost Co-op','processor','Brikama','Brikama', array['organic','glass'],'onboarding'),
('Kololi Sands Hotel','business','Senegambia Strip','Kololi', array['plastic','glass'],'active');
