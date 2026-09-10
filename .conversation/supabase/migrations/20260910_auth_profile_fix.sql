begin;

alter table public.mahaflow_profiles add column if not exists email text;
alter table public.mahaflow_profiles add column if not exists state text;
alter table public.mahaflow_profiles add column if not exists district text;
alter table public.mahaflow_profiles add column if not exists organization text;
alter table public.mahaflow_profiles add column if not exists designation text;
alter table public.mahaflow_profiles add column if not exists status text not null default 'active';

create or replace function public.mahaflow_is_developer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('venomx2424@gmail.com', 'visionx2425@gmail.com')
    and exists (
      select 1 from public.mahaflow_profiles
      where id = auth.uid() and role = 'developer' and status = 'active'
    );
$$;

create or replace function public.mahaflow_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mahaflow_profiles (id, display_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, 'MahaFlow user'), '@', 1)),
    lower(new.email),
    case
      when lower(new.email) in ('venomx2424@gmail.com', 'visionx2425@gmail.com') then 'developer'
      else 'passenger'
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(nullif(excluded.display_name, ''), public.mahaflow_profiles.display_name),
        role = case
          when excluded.email in ('venomx2424@gmail.com', 'visionx2425@gmail.com') then 'developer'
          when public.mahaflow_profiles.role = 'developer' then 'passenger'
          else public.mahaflow_profiles.role
        end,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists mahaflow_on_auth_user_created on auth.users;
create trigger mahaflow_on_auth_user_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute procedure public.mahaflow_handle_new_user();

insert into public.mahaflow_profiles (id, display_name, email, role)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', split_part(coalesce(email, 'MahaFlow user'), '@', 1)),
  lower(email),
  case
    when lower(email) in ('venomx2424@gmail.com', 'visionx2425@gmail.com') then 'developer'
    else 'passenger'
  end
from auth.users
on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(nullif(excluded.display_name, ''), public.mahaflow_profiles.display_name);

update public.mahaflow_profiles profile
set role = case
  when lower(auth_user.email) in ('venomx2424@gmail.com', 'visionx2425@gmail.com') then 'developer'
  else 'passenger'
end,
email = lower(auth_user.email),
updated_at = now()
from auth.users auth_user
where profile.id = auth_user.id
  and (profile.role = 'developer' or lower(auth_user.email) in ('venomx2424@gmail.com', 'visionx2425@gmail.com'));

drop policy if exists mahaflow_profiles_owner on public.mahaflow_profiles;
drop policy if exists mahaflow_profiles_read on public.mahaflow_profiles;
drop policy if exists mahaflow_profiles_update on public.mahaflow_profiles;
create policy mahaflow_profiles_read on public.mahaflow_profiles
  for select to authenticated
  using (id = auth.uid() or public.mahaflow_is_developer());
create policy mahaflow_profiles_update on public.mahaflow_profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on public.mahaflow_profiles from anon;
revoke insert, delete, update on public.mahaflow_profiles from authenticated;
grant select on public.mahaflow_profiles to authenticated;
grant update (display_name, mobile, state, district, organization, designation, updated_at) on public.mahaflow_profiles to authenticated;

commit;