begin;

create table if not exists public.mahaflow_facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('bus','railway')),
  state text not null default 'Maharashtra',
  district text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists mahaflow_facilities_identity_idx
  on public.mahaflow_facilities (kind, lower(name), lower(district));

insert into public.mahaflow_facilities (name, kind, state, district, address, latitude, longitude)
values
  ('Baramati Bus Stand', 'bus', 'Maharashtra', 'Pune', 'Baramati Bus Stand, Baramati', 18.1512, 74.5777),
  ('Swargate Bus Stand', 'bus', 'Maharashtra', 'Pune', 'Swargate, Pune', 18.5018, 73.8636),
  ('Pune Railway Station', 'railway', 'Maharashtra', 'Pune', 'Agarkar Nagar, Pune', 18.5289, 73.8744),
  ('Daund Railway Station', 'railway', 'Maharashtra', 'Pune', 'Daund Junction, Daund', 18.4633, 74.5847)
on conflict do nothing;

alter table public.mahaflow_profiles add column if not exists facility_id uuid references public.mahaflow_facilities(id);
alter table public.mahaflow_access_codes add column if not exists facility_id uuid references public.mahaflow_facilities(id);
alter table public.mahaflow_cameras add column if not exists facility_id uuid references public.mahaflow_facilities(id);
alter table public.mahaflow_cameras add column if not exists protocol text not null default 'HLS';
alter table public.mahaflow_cameras add column if not exists updated_at timestamptz not null default now();
alter table public.mahaflow_cameras add column if not exists last_seen_at timestamptz;

update public.mahaflow_access_codes code
set facility_id = facility.id
from public.mahaflow_facilities facility
where code.facility_id is null
  and lower(code.location_name) = lower(facility.name)
  and code.network = facility.kind;

create table if not exists public.mahaflow_transport_services (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  facility_id uuid references public.mahaflow_facilities(id),
  mode text not null check (mode in ('bus','railway')),
  service_number text not null,
  service_name text not null,
  origin text not null,
  destination text not null,
  departure_time time not null,
  arrival_time time not null,
  bay_or_platform text,
  vehicle_registration text,
  driver_id text,
  capacity integer not null default 0 check (capacity >= 0),
  current_occupancy integer not null default 0 check (current_occupancy >= 0),
  status text not null default 'scheduled' check (status in ('scheduled','boarding','departed','delayed','cancelled')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, service_number)
);

create table if not exists public.mahaflow_crowd_readings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  facility_id uuid references public.mahaflow_facilities(id),
  camera_id uuid references public.mahaflow_cameras(id) on delete set null,
  zone text not null,
  people_count integer not null check (people_count >= 0),
  capacity integer not null default 0 check (capacity >= 0),
  crowd_level text not null check (crowd_level in ('Low','Moderate','High','Very High','Critical')),
  source text not null default 'manual' check (source in ('manual','camera','yolo26n')),
  model_version text,
  inference_latency_ms numeric,
  fps numeric,
  is_public boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);
create index if not exists mahaflow_crowd_readings_latest_idx
  on public.mahaflow_crowd_readings(facility_id, recorded_at desc);

create table if not exists public.mahaflow_crowd_predictions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  facility_id uuid references public.mahaflow_facilities(id),
  zone text not null,
  predicted_count integer not null check (predicted_count >= 0),
  crowd_level text not null check (crowd_level in ('Low','Moderate','High','Very High','Critical')),
  prediction_for timestamptz not null,
  model_version text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.mahaflow_saved_routes add column if not exists origin text;
alter table public.mahaflow_saved_routes add column if not exists destination text;
alter table public.mahaflow_saved_routes add column if not exists mode text;
alter table public.mahaflow_saved_routes add column if not exists service_number text;

create table if not exists public.mahaflow_user_settings (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'en' check (language in ('en','hi','mr')),
  theme text not null default 'system' check (theme in ('light','dark','system')),
  notifications_enabled boolean not null default true,
  crowd_alerts_enabled boolean not null default true,
  operating_hours_start time,
  operating_hours_end time,
  staff_alerts_enabled boolean not null default true,
  yolo_worker_url text,
  yolo_model_name text not null default 'YOLO26n',
  advanced_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.mahaflow_branding_settings (
  id boolean primary key default true check (id),
  app_name text not null default 'MahaFlow',
  tagline text not null default 'Smarter Travel. A Better Maharashtra.',
  primary_color text not null default '#0561DF',
  accent_color text not null default '#8B35E9',
  logo_url text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.mahaflow_branding_settings(id) values(true) on conflict do nothing;

create or replace function public.mahaflow_is_authority()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mahaflow_profiles
    where id = auth.uid() and role = 'authority' and status = 'active'
  );
$$;

create or replace function public.mahaflow_create_access_code(
  p_facility_id uuid,
  p_expires_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  facility public.mahaflow_facilities%rowtype;
  generated_code text;
  created public.mahaflow_access_codes%rowtype;
begin
  if not public.mahaflow_is_developer() then raise exception 'Developer access required'; end if;
  select * into facility from public.mahaflow_facilities where id = p_facility_id and status = 'active';
  if not found then raise exception 'Facility not found'; end if;
  generated_code := case when facility.kind = 'bus' then 'MFB-' else 'MFR-' end || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.mahaflow_access_codes(created_by, code, network, state, district, location_name, stand_address, expires_at, status, facility_id)
  values(auth.uid(), generated_code, facility.kind, facility.state, facility.district, facility.name, facility.address, now() + make_interval(days => greatest(1, least(coalesce(p_expires_days, 30), 90))), 'active', facility.id)
  returning * into created;
  return to_jsonb(created);
end;
$$;

create or replace function public.mahaflow_get_access_code_details(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare code_row public.mahaflow_access_codes%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into code_row from public.mahaflow_access_codes
  where code = upper(trim(p_code)) and status = 'active' and expires_at > now();
  if not found then raise exception 'Access code is invalid, expired, or already used'; end if;
  return jsonb_build_object('code', code_row.code, 'network', code_row.network, 'state', code_row.state, 'district', code_row.district, 'location_name', code_row.location_name, 'stand_address', code_row.stand_address, 'facility_id', code_row.facility_id);
end;
$$;

create or replace function public.mahaflow_complete_authority_onboarding(
  p_code text,
  p_display_name text,
  p_mobile text,
  p_organization text,
  p_designation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare code_row public.mahaflow_access_codes%rowtype;
declare user_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(p_display_name)) < 2 or length(trim(p_mobile)) < 8 then raise exception 'Complete name and mobile are required'; end if;
  select * into code_row from public.mahaflow_access_codes
  where code = upper(trim(p_code)) for update;
  if not found or code_row.status <> 'active' or code_row.expires_at <= now() then raise exception 'Access code is invalid, expired, or already used'; end if;
  select lower(email) into user_email from auth.users where id = auth.uid();
  if user_email in ('venomx2424@gmail.com', 'visionx2425@gmail.com') then raise exception 'Developer accounts cannot register as authorities'; end if;
  update public.mahaflow_profiles set
    display_name = trim(p_display_name), mobile = trim(p_mobile), email = user_email,
    state = code_row.state, district = code_row.district,
    organization = nullif(trim(p_organization), ''), designation = nullif(trim(p_designation), ''),
    facility_id = code_row.facility_id, access_code = code_row.code,
    role = 'authority', status = 'active', updated_at = now()
  where id = auth.uid();
  update public.mahaflow_access_codes set
    status = 'used', joined_name = trim(p_display_name), joined_email = user_email,
    joined_mobile = trim(p_mobile), joined_at = now()
  where id = code_row.id;
  return jsonb_build_object('role','authority','facility_id',code_row.facility_id,'network',code_row.network,'location_name',code_row.location_name);
end;
$$;

create or replace function public.mahaflow_list_authorities()
returns table(id uuid, display_name text, email text, mobile text, organization text, designation text, status text, facility_name text, network text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select profile.id, profile.display_name, profile.email, profile.mobile, profile.organization, profile.designation, profile.status, facility.name, facility.kind, profile.updated_at
  from public.mahaflow_profiles profile
  left join public.mahaflow_facilities facility on facility.id = profile.facility_id
  where public.mahaflow_is_developer() and profile.role = 'authority'
  order by profile.updated_at desc;
$$;

create or replace function public.mahaflow_set_authority_status(p_user_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mahaflow_is_developer() then raise exception 'Developer access required'; end if;
  if p_status not in ('active','suspended','banned') then raise exception 'Invalid status'; end if;
  update public.mahaflow_profiles set status = p_status, updated_at = now() where id = p_user_id and role = 'authority';
  return found;
end;
$$;

alter table public.mahaflow_facilities enable row level security;
alter table public.mahaflow_access_codes enable row level security;
alter table public.mahaflow_cameras enable row level security;
alter table public.mahaflow_transport_services enable row level security;
alter table public.mahaflow_crowd_readings enable row level security;
alter table public.mahaflow_crowd_predictions enable row level security;
alter table public.mahaflow_saved_routes enable row level security;
alter table public.mahaflow_user_settings enable row level security;
alter table public.mahaflow_branding_settings enable row level security;

drop policy if exists mahaflow_access_codes_creator on public.mahaflow_access_codes;
drop policy if exists mahaflow_access_codes_developer on public.mahaflow_access_codes;
create policy mahaflow_access_codes_developer on public.mahaflow_access_codes for all to authenticated using (public.mahaflow_is_developer()) with check (public.mahaflow_is_developer() and created_by = auth.uid());

drop policy if exists mahaflow_facilities_read on public.mahaflow_facilities;
drop policy if exists mahaflow_facilities_developer on public.mahaflow_facilities;
create policy mahaflow_facilities_read on public.mahaflow_facilities for select to authenticated using (true);
create policy mahaflow_facilities_developer on public.mahaflow_facilities for all to authenticated using (public.mahaflow_is_developer()) with check (public.mahaflow_is_developer());

drop policy if exists mahaflow_cameras_owner on public.mahaflow_cameras;
drop policy if exists mahaflow_cameras_authority on public.mahaflow_cameras;
create policy mahaflow_cameras_authority on public.mahaflow_cameras for all to authenticated using ((owner_user_id = auth.uid() and public.mahaflow_is_authority()) or public.mahaflow_is_developer()) with check ((owner_user_id = auth.uid() and public.mahaflow_is_authority()) or public.mahaflow_is_developer());

drop policy if exists mahaflow_transport_read on public.mahaflow_transport_services;
drop policy if exists mahaflow_transport_manage on public.mahaflow_transport_services;
create policy mahaflow_transport_read on public.mahaflow_transport_services for select to authenticated using (active or owner_user_id = auth.uid() or public.mahaflow_is_developer());
create policy mahaflow_transport_manage on public.mahaflow_transport_services for all to authenticated using ((owner_user_id = auth.uid() and public.mahaflow_is_authority()) or public.mahaflow_is_developer()) with check ((owner_user_id = auth.uid() and public.mahaflow_is_authority()) or public.mahaflow_is_developer());

drop policy if exists mahaflow_crowd_readings_read on public.mahaflow_crowd_readings;
drop policy if exists mahaflow_crowd_readings_manage on public.mahaflow_crowd_readings;
create policy mahaflow_crowd_readings_read on public.mahaflow_crowd_readings for select to authenticated using (is_public or owner_user_id = auth.uid() or public.mahaflow_is_developer());
create policy mahaflow_crowd_readings_manage on public.mahaflow_crowd_readings for all to authenticated using ((owner_user_id = auth.uid() and public.mahaflow_is_authority()) or public.mahaflow_is_developer()) with check ((owner_user_id = auth.uid() and public.mahaflow_is_authority()) or public.mahaflow_is_developer());

drop policy if exists mahaflow_crowd_predictions_read on public.mahaflow_crowd_predictions;
drop policy if exists mahaflow_crowd_predictions_manage on public.mahaflow_crowd_predictions;
create policy mahaflow_crowd_predictions_read on public.mahaflow_crowd_predictions for select to authenticated using (is_public or owner_user_id = auth.uid() or public.mahaflow_is_developer());
create policy mahaflow_crowd_predictions_manage on public.mahaflow_crowd_predictions for all to authenticated using ((owner_user_id = auth.uid() and public.mahaflow_is_authority()) or public.mahaflow_is_developer()) with check ((owner_user_id = auth.uid() and public.mahaflow_is_authority()) or public.mahaflow_is_developer());

drop policy if exists mahaflow_saved_routes_owner on public.mahaflow_saved_routes;
create policy mahaflow_saved_routes_owner on public.mahaflow_saved_routes for all to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists mahaflow_user_settings_owner on public.mahaflow_user_settings;
create policy mahaflow_user_settings_owner on public.mahaflow_user_settings for all to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists mahaflow_branding_read on public.mahaflow_branding_settings;
drop policy if exists mahaflow_branding_developer on public.mahaflow_branding_settings;
create policy mahaflow_branding_read on public.mahaflow_branding_settings for select to authenticated using (true);
create policy mahaflow_branding_developer on public.mahaflow_branding_settings for all to authenticated using (public.mahaflow_is_developer()) with check (public.mahaflow_is_developer());

grant select on public.mahaflow_facilities, public.mahaflow_transport_services, public.mahaflow_crowd_readings, public.mahaflow_crowd_predictions, public.mahaflow_branding_settings to authenticated;
grant select, insert, update, delete on public.mahaflow_access_codes, public.mahaflow_cameras, public.mahaflow_transport_services, public.mahaflow_crowd_readings, public.mahaflow_crowd_predictions, public.mahaflow_saved_routes, public.mahaflow_user_settings, public.mahaflow_facilities, public.mahaflow_branding_settings to authenticated;
revoke all on function public.mahaflow_create_access_code(uuid, integer) from public, anon;
revoke all on function public.mahaflow_get_access_code_details(text) from public, anon;
revoke all on function public.mahaflow_complete_authority_onboarding(text, text, text, text, text) from public, anon;
revoke all on function public.mahaflow_list_authorities() from public, anon;
revoke all on function public.mahaflow_set_authority_status(uuid, text) from public, anon;
grant execute on function public.mahaflow_create_access_code(uuid, integer) to authenticated;
grant execute on function public.mahaflow_get_access_code_details(text) to authenticated;
grant execute on function public.mahaflow_complete_authority_onboarding(text, text, text, text, text) to authenticated;
grant execute on function public.mahaflow_list_authorities() to authenticated;
grant execute on function public.mahaflow_set_authority_status(uuid, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.mahaflow_crowd_readings;
exception when duplicate_object then null;
end $$;

commit;