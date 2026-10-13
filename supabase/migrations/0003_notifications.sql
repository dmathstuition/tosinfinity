-- In-app notifications raised by the database, so they cannot be forged or skipped
-- by a client. Idempotent.

create or replace function public.owner_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where role = 'owner' limit 1;
$$;

create or replace function public.area_for(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select case role when 'owner' then '/owner' when 'student' then '/portal' else '/parent' end
    from public.profiles where id = p_user;
$$;

-- Notify a student and every verified parent.
create or replace function public.notify_family(p_student uuid, p_title text, p_body text, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, title, body, href)
  select p_student, p_title, p_body, '/portal' || p_path
  union all
  select l.parent_id, p_title, p_body, '/parent' || p_path
    from public.parent_student_links l where l.student_id = p_student and l.verified_at is not null;
end $$;

-- New message → notify the other party. The body is never copied into the notification.
create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_participant uuid; v_owner uuid := public.owner_id();
begin
  select participant_id into v_participant from public.message_threads where id = new.thread_id;
  if new.sender_id = v_participant then
    if v_owner is not null then
      insert into public.notifications (user_id, title, body, href)
      values (v_owner, 'New message', (select full_name from public.profiles where id = new.sender_id),
              '/owner/messages/' || new.thread_id);
    end if;
  else
    insert into public.notifications (user_id, title, body, href)
    values (v_participant, 'New message', 'You have a new message from Tosinfinity Academy.',
            public.area_for(v_participant) || '/messages');
  end if;
  return new;
end $$;
drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute function public.on_message_insert();

-- Submission received → Owner. Graded → family.
create or replace function public.on_submission_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text; v_owner uuid := public.owner_id();
begin
  select title into v_title from public.assignments where id = new.assignment_id;
  if tg_op = 'INSERT' and new.status = 'submitted' and v_owner is not null then
    insert into public.notifications (user_id, title, body, href)
    values (v_owner, 'Work submitted', v_title, '/owner/assignments/' || new.assignment_id);
  elsif tg_op = 'UPDATE' and new.status = 'graded' and old.status is distinct from 'graded' then
    perform public.notify_family(new.student_id, 'Work marked', v_title, '/assignments');
  end if;
  return new;
end $$;
drop trigger if exists submissions_notify on public.submissions;
create trigger submissions_notify after insert or update on public.submissions
  for each row execute function public.on_submission_change();

-- Payment recorded → family and Owner.
create or replace function public.on_payment_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_student uuid; v_number text; v_owner uuid := public.owner_id();
begin
  select student_id, number into v_student, v_number from public.invoices where id = new.invoice_id;
  perform public.notify_family(v_student, 'Payment received', 'Invoice ' || v_number, '/invoices');
  if new.method = 'paystack' and v_owner is not null then
    insert into public.notifications (user_id, title, body, href)
    values (v_owner, 'Online payment received', 'Invoice ' || v_number, '/owner/billing/' || new.invoice_id);
  end if;
  return new;
end $$;
drop trigger if exists payments_notify on public.payments;
create trigger payments_notify after insert on public.payments
  for each row execute function public.on_payment_insert();

-- New application or contact message → Owner.
create or replace function public.on_enquiry_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid := public.owner_id();
begin
  if v_owner is null then return new; end if;
  if tg_table_name = 'applications' then
    insert into public.notifications (user_id, title, body, href)
    values (v_owner, 'New application', new.student_name, '/owner/applications/' || new.id);
  else
    insert into public.notifications (user_id, title, body, href)
    values (v_owner, 'New contact message', new.name, '/owner/applications?tab=messages');
  end if;
  return new;
end $$;
drop trigger if exists applications_notify on public.applications;
create trigger applications_notify after insert on public.applications
  for each row execute function public.on_enquiry_insert();
drop trigger if exists contact_notify on public.contact_messages;
create trigger contact_notify after insert on public.contact_messages
  for each row execute function public.on_enquiry_insert();

revoke execute on function public.owner_id(), public.area_for(uuid),
  public.notify_family(uuid, text, text, text) from public, anon, authenticated;
-- The Owner calls notify_family() from server actions (invoices, reports, classes).
create or replace function public.owner_notify_family(p_student uuid, p_title text, p_body text, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'not authorised'; end if;
  perform public.notify_family(p_student, left(p_title, 120), left(p_body, 300), p_path);
end $$;
revoke execute on function public.owner_notify_family(uuid, text, text, text) from public, anon;
grant execute on function public.owner_notify_family(uuid, text, text, text) to authenticated;
