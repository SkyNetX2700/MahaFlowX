-- Run after schema.sql in the Supabase SQL Editor.
-- These functions are SECURITY DEFINER and lock access-code rows atomically.

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and status = 'active' $$;

create or replace function public.generate_access_code(p_kind public.facility_kind, p_facility_id uuid, p_expires_at timestamptz)
returns public.access_codes language plpgsql security definer set search_path = public
as $$
declare result public.access_codes; candidate text;
begin
  if public.current_app_role() <> 'developer' then raise exception 'developer role required'; end if;
  if not exists (select 1 from public.facilities where id = p_facility_id and kind = p_kind) then raise exception 'facility type mismatch'; end if;
  loop
    candidate := p_kind::text || '-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6));
    exit when not exists (select 1 from public.access_codes where code = candidate);
  end loop;
  insert into public.access_codes(code, kind, facility_id, expires_at)
  values (candidate, p_kind, p_facility_id, p_expires_at)
  returning * into result;
  return result;
end $$;

create or replace function public.consume_authority_code(p_code text, p_full_name text, p_mobile text, p_organization text, p_designation text, p_state text, p_district text)
returns public.authority_profiles language plpgsql security definer set search_path = public
as $$
declare selected public.access_codes; result public.authority_profiles;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into selected from public.access_codes where code = upper(trim(p_code)) for update;
  if selected.id is null or selected.status <> 'UNUSED' or selected.expires_at <= now() then raise exception 'code unavailable'; end if;
  if exists (select 1 from public.authority_profiles where user_id = auth.uid()) then raise exception 'authority profile already exists'; end if;
  insert into public.profiles(id, full_name, email, mobile, role)
  values (auth.uid(), p_full_name, (select email from auth.users where id = auth.uid()), p_mobile, 'authority')
  on conflict (id) do update set full_name=excluded.full_name, mobile=excluded.mobile, role='authority';
  update public.access_codes set status='USED', used_at=now(), used_by=auth.uid() where id=selected.id;
  insert into public.authority_profiles(user_id, facility_id, organization, designation, code_used)
  values (auth.uid(), selected.facility_id, p_organization, p_designation, selected.id)
  returning * into result;
  return result;
end $$;

revoke all on function public.generate_access_code(public.facility_kind, uuid, timestamptz) from public;
revoke all on function public.consume_authority_code(text, text, text, text, text, text, text) from public;
grant execute on function public.generate_access_code(public.facility_kind, uuid, timestamptz) to authenticated;
grant execute on function public.consume_authority_code(text, text, text, text, text, text, text) to authenticated;

create policy "developer manages access codes" on public.access_codes for all using (public.current_app_role() = 'developer') with check (public.current_app_role() = 'developer');
create policy "authority facility camera writes" on public.cameras for all using (facility_id in (select public.my_facility_ids()) or public.current_app_role() = 'developer') with check (facility_id in (select public.my_facility_ids()) or public.current_app_role() = 'developer');
create policy "developer manages facilities" on public.facilities for all using (public.current_app_role() = 'developer') with check (public.current_app_role() = 'developer');
create policy "authority facility zones" on public.zones for all using (facility_id in (select public.my_facility_ids()) or public.current_app_role() = 'developer') with check (facility_id in (select public.my_facility_ids()) or public.current_app_role() = 'developer');
create policy "public processed crowd" on public.crowd_readings for select using (source = 'public' or facility_id in (select public.my_facility_ids()) or public.current_app_role() = 'developer');

-- The access-code consume function is the only authority-registration write path.
-- Camera streams should store a secret_ref, never a stream credential or URL secret.