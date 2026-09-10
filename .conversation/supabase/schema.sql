-- MahaFlow foundation schema. Run this in Supabase SQL Editor after creating a project.
create extension if not exists pgcrypto;

create type public.app_role as enum ('passenger','authority','developer');
create type public.facility_kind as enum ('MFB','MFR');
create type public.code_status as enum ('UNUSED','USED','DISABLED');
create type public.crowd_level as enum ('Low','Moderate','High','Very High','Critical');
create type public.camera_status as enum ('LIVE','CONNECTING','OFFLINE');

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, email text unique, mobile text, role public.app_role not null default 'passenger', status text not null default 'active', created_at timestamptz not null default now(), last_login_at timestamptz);
create table public.facilities (id uuid primary key default gen_random_uuid(), name text not null, kind public.facility_kind not null, district text, state text default 'Maharashtra', created_at timestamptz not null default now());
create table public.authority_profiles (user_id uuid primary key references public.profiles(id) on delete cascade, facility_id uuid not null references public.facilities(id), organization text, designation text, code_used uuid, registration_at timestamptz not null default now());
create table public.access_codes (id uuid primary key default gen_random_uuid(), code text unique not null, kind public.facility_kind not null, facility_id uuid not null references public.facilities(id), status public.code_status not null default 'UNUSED', created_at timestamptz not null default now(), expires_at timestamptz not null, used_at timestamptz, used_by uuid references public.profiles(id));
create table public.zones (id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.facilities(id) on delete cascade, name text not null, created_at timestamptz not null default now());
create table public.cameras (id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.facilities(id) on delete cascade, zone_id uuid references public.zones(id), name text not null, enabled boolean not null default true, status public.camera_status not null default 'OFFLINE', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.camera_streams (id uuid primary key default gen_random_uuid(), camera_id uuid unique not null references public.cameras(id) on delete cascade, protocol text not null check (protocol in ('HLS','WEBRTC')), secret_ref text not null, last_connected_at timestamptz);
create table public.crowd_readings (id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.facilities(id) on delete cascade, zone_id uuid not null references public.zones(id) on delete cascade, people_count integer not null check (people_count >= 0), level public.crowd_level not null, source text not null default 'manual', recorded_at timestamptz not null default now());
create table public.crowd_predictions (id uuid primary key default gen_random_uuid(), facility_id uuid not null references public.facilities(id) on delete cascade, zone_id uuid not null references public.zones(id) on delete cascade, predicted_count integer not null, level public.crowd_level not null, prediction_for timestamptz not null, model_version text, created_at timestamptz not null default now());
create table public.transport_services (id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('bus','rail')), service_number text not null, service_name text, origin text, destination text, facility_id uuid references public.facilities(id), departure_at timestamptz, arrival_at timestamptz, status text, delay_minutes integer default 0);
create table public.transport_updates (id uuid primary key default gen_random_uuid(), service_id uuid not null references public.transport_services(id) on delete cascade, message text not null, created_at timestamptz not null default now());
create table public.alerts (id uuid primary key default gen_random_uuid(), facility_id uuid references public.facilities(id), title text not null, body text not null, severity text not null, created_at timestamptz not null default now());
create table public.saved_routes (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, origin text not null, destination text not null, created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now());
create table public.branding_settings (id uuid primary key default gen_random_uuid(), app_name text not null default 'MahaFlow', logo_path text, favicon_path text, tagline text, primary_color text default '#0056D2', secondary_color text default '#00C2FF', updated_at timestamptz not null default now());
create table public.activity_logs (id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), action text not null, entity_type text not null, entity_id uuid, metadata jsonb, created_at timestamptz not null default now());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    lower(new.email),
    case
      when lower(new.email) in ('venomx2424@gmail.com', 'visionx2425@gmail.com') then 'developer'::public.app_role
      else 'passenger'::public.app_role
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role = case
          when excluded.email in ('venomx2424@gmail.com', 'visionx2425@gmail.com') then 'developer'::public.app_role
          when public.profiles.role = 'developer' then 'passenger'::public.app_role
          else public.profiles.role
        end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute procedure public.handle_new_user();

create index access_codes_status_idx on public.access_codes(status, expires_at);
create index cameras_facility_idx on public.cameras(facility_id);
create index crowd_readings_facility_time_idx on public.crowd_readings(facility_id, recorded_at desc);
create index activity_logs_created_idx on public.activity_logs(created_at desc);

alter table public.profiles enable row level security;
alter table public.authority_profiles enable row level security;
alter table public.access_codes enable row level security;
alter table public.cameras enable row level security;
alter table public.crowd_readings enable row level security;
alter table public.crowd_predictions enable row level security;
alter table public.saved_routes enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_developer() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='developer' and status='active') $$;
create or replace function public.my_facility_ids() returns setof uuid language sql stable security definer set search_path = public as $$ select facility_id from public.authority_profiles where user_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and role='authority' and status='active') $$;

create policy "profiles own or developer" on public.profiles for select using (id=auth.uid() or public.is_developer());
create policy "authority facility cameras" on public.cameras for select using (facility_id in (select public.my_facility_ids()) or public.is_developer());
create policy "public processed readings" on public.crowd_readings for select using (source = 'public' or facility_id in (select public.my_facility_ids()) or public.is_developer());
create policy "public processed predictions" on public.crowd_predictions for select using (facility_id in (select public.my_facility_ids()) or public.is_developer());
create policy "own saved routes" on public.saved_routes for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "own notifications" on public.notifications for all using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Access-code consume must be exposed through a SECURITY DEFINER Edge Function/RPC,
-- never through a client-side update. The function should lock the row FOR UPDATE,
-- validate UNUSED + expiry, attach auth.uid(), then mark USED atomically.