-- Account-creation helpers used by Owner workflows. Idempotent.

-- Find an existing login by email (service role only) so accounts are never duplicated.
create or replace function public.auth_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke execute on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

-- Create a student profile for an auth user (Owner adds a student directly, or CSV import).
create or replace function public.create_student_profile(p_user uuid, p_email text, p_fields jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not (public.is_owner() or auth.role() = 'service_role') then raise exception 'not authorised'; end if;
  if exists (select 1 from public.profiles where id = p_user) then
    raise exception 'this email already belongs to an account';
  end if;
  if coalesce(trim(p_fields ->> 'full_name'), '') = '' then raise exception 'full name is required'; end if;
  v_code := public.next_student_code();
  insert into public.profiles (id, role, full_name, email, phone, student_code, date_of_birth, school_year,
                               curriculum, location, learning_needs, goals, delivery)
  values (p_user, 'student', trim(p_fields ->> 'full_name'), lower(trim(p_email)),
          nullif(trim(p_fields ->> 'phone'), ''), v_code,
          nullif(p_fields ->> 'date_of_birth', '')::date, nullif(trim(p_fields ->> 'school_year'), ''),
          nullif(trim(p_fields ->> 'curriculum'), ''), nullif(trim(p_fields ->> 'location'), ''),
          nullif(trim(p_fields ->> 'learning_needs'), ''), nullif(trim(p_fields ->> 'goals'), ''),
          nullif(p_fields ->> 'delivery', ''));
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'student.created', 'profile', p_user::text, jsonb_build_object('student_code', v_code));
  return v_code;
end $$;

-- Create (or reuse) a parent profile and link it to a student as a verified relationship.
-- Only the Owner can do this, which is what makes the link "Owner-approved".
create or replace function public.link_parent(
  p_parent_user uuid, p_student uuid, p_full_name text, p_email text, p_phone text, p_relationship text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_owner() or auth.role() = 'service_role') then raise exception 'not authorised'; end if;
  if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
    raise exception 'student not found';
  end if;
  insert into public.profiles (id, role, full_name, email, phone)
  values (p_parent_user, 'parent', trim(p_full_name), lower(trim(p_email)), nullif(trim(p_phone), ''))
  on conflict (id) do nothing;
  if not exists (select 1 from public.profiles where id = p_parent_user and role = 'parent') then
    raise exception 'that email belongs to a student or owner account and cannot be linked as a parent';
  end if;
  insert into public.parent_student_links (parent_id, student_id, relationship, verified_at)
  values (p_parent_user, p_student, coalesce(nullif(trim(p_relationship), ''), 'parent'), now())
  on conflict (parent_id, student_id) do update set verified_at = now(), relationship = excluded.relationship;
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), 'parent.linked', 'profile', p_student::text, jsonb_build_object('parent_id', p_parent_user));
end $$;

revoke execute on function public.create_student_profile(uuid, text, jsonb),
  public.link_parent(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.create_student_profile(uuid, text, jsonb),
  public.link_parent(uuid, uuid, text, text, text, text) to authenticated, service_role;
