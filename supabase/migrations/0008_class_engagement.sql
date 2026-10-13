-- Lesson room: attendance confirmation, questions, quick checks (polls), understanding
-- check-ins, lesson recap and per-class materials. Works for home and online classes.
-- Idempotent.

alter table public.classes add column if not exists recap text;
alter table public.classes add column if not exists homework text;
alter table public.classes add column if not exists recording_url text;
alter table public.classes add column if not exists recap_at timestamptz;
alter table public.classes add column if not exists tutor_en_route_at timestamptz;

-- "I'll be there" / "I can't make it", given by the student or a verified parent.
create table if not exists public.class_rsvps (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  response text not null check (response in ('attending','not_attending')),
  note text check (char_length(note) <= 300),
  responded_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- A learner's question about a lesson. Private between that learner (and their
-- parents) and the tutor, even in a shared class.
create table if not exists public.class_questions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 3 and 1000),
  answer text check (char_length(answer) <= 3000),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists class_questions_class_idx on public.class_questions (class_id, created_at);

-- Quick checks the tutor opens during a lesson. correct_index is optional and is
-- never sent to learners while the check is open.
create table if not exists public.class_polls (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  question text not null check (char_length(question) between 3 and 500),
  options jsonb not null,
  correct_index int check (correct_index >= 0),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists class_polls_class_idx on public.class_polls (class_id, created_at);

create table if not exists public.class_poll_answers (
  poll_id uuid not null references public.class_polls(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  choice int not null check (choice >= 0),
  created_at timestamptz not null default now(),
  primary key (poll_id, student_id)
);

-- After the lesson: how well the learner feels they understood (1 = lost … 4 = confident).
create table if not exists public.class_feedback (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  understanding smallint not null check (understanding between 1 and 4),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- Materials attached to one lesson; visible to the learners in that class.
create table if not exists public.class_materials (
  class_id uuid not null references public.classes(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  primary key (class_id, material_id)
);

alter table public.class_rsvps enable row level security;
alter table public.class_questions enable row level security;
alter table public.class_polls enable row level security;
alter table public.class_poll_answers enable row level security;
alter table public.class_feedback enable row level security;
alter table public.class_materials enable row level security;

create or replace function public.student_in_class(p_class uuid, p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_students where class_id = p_class and student_id = p_student);
$$;

-- ---------------------------------------------------------------------------
-- Policies. Learners never write these tables directly; they go through the
-- functions below, which check class membership and timing.
-- ---------------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['class_rsvps','class_questions','class_polls','class_poll_answers','class_feedback','class_materials'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated
                    using (public.is_owner()) with check (public.is_owner())', t);
    execute format('drop policy if exists family_read on public.%I', t);
  end loop;
end $$;

create policy family_read on public.class_rsvps for select to authenticated
  using (public.can_view_student(student_id));
create policy family_read on public.class_questions for select to authenticated
  using (public.can_view_student(student_id));
create policy family_read on public.class_feedback for select to authenticated
  using (public.can_view_student(student_id));
create policy family_read on public.class_poll_answers for select to authenticated
  using (student_id = auth.uid());
create policy family_read on public.class_materials for select to authenticated
  using (exists (select 1 from public.class_students cs
                 where cs.class_id = class_materials.class_id and public.can_view_student(cs.student_id)));
-- class_polls: Owner only. Learners read polls through get_class_polls().

-- Materials become visible when attached to a class the learner is in.
drop policy if exists family_read on public.materials;
create policy family_read on public.materials for select to authenticated
  using (bucket = 'handouts'
         or exists (select 1 from public.material_students ms
                    where ms.material_id = id and public.can_view_student(ms.student_id))
         or exists (select 1 from public.student_enrolments e
                    where e.programme_id = materials.programme_id and e.status = 'active'
                      and public.can_view_student(e.student_id))
         or exists (select 1 from public.class_materials cm
                    join public.class_students cs on cs.class_id = cm.class_id
                    where cm.material_id = materials.id and public.can_view_student(cs.student_id)));

-- ---------------------------------------------------------------------------
-- Learner actions
-- ---------------------------------------------------------------------------
create or replace function public.set_class_rsvp(p_class uuid, p_student uuid, p_response text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.classes%rowtype; v_owner uuid := public.owner_id();
begin
  if auth.uid() is null or not (auth.uid() = p_student or public.is_parent_of(p_student)) then
    raise exception 'not authorised';
  end if;
  if not public.student_in_class(p_class, p_student) then raise exception 'not authorised'; end if;
  if p_response not in ('attending','not_attending') then raise exception 'invalid response'; end if;
  select * into c from public.classes where id = p_class;
  if c.status <> 'scheduled' or c.starts_at < now() then
    raise exception 'this class has already started or is no longer scheduled';
  end if;
  insert into public.class_rsvps (class_id, student_id, response, note, responded_by, updated_at)
  values (p_class, p_student, p_response, nullif(left(trim(coalesce(p_note, '')), 300), ''), auth.uid(), now())
  on conflict (class_id, student_id) do update
    set response = excluded.response, note = excluded.note, responded_by = excluded.responded_by, updated_at = now();
  if p_response = 'not_attending' and v_owner is not null then
    insert into public.notifications (user_id, title, body, href)
    values (v_owner, 'A learner cannot attend', c.title, '/owner/classes/' || p_class || '/room');
  end if;
end $$;

create or replace function public.ask_class_question(p_class uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_owner uuid := public.owner_id(); v_title text;
begin
  if auth.uid() is null or not public.student_in_class(p_class, auth.uid()) then raise exception 'not authorised'; end if;
  if (select count(*) from public.class_questions where class_id = p_class and student_id = auth.uid()) >= 20 then
    raise exception 'question limit reached for this class';
  end if;
  select title into v_title from public.classes where id = p_class and status <> 'cancelled';
  if v_title is null then raise exception 'this class is not available'; end if;
  insert into public.class_questions (class_id, student_id, body)
  values (p_class, auth.uid(), trim(p_body)) returning id into v_id;
  if v_owner is not null then
    insert into public.notifications (user_id, title, body, href)
    values (v_owner, 'Question about a lesson', v_title, '/owner/classes/' || p_class || '/room');
  end if;
  return v_id;
end $$;

create or replace function public.answer_class_poll(p_poll uuid, p_choice int)
returns void language plpgsql security definer set search_path = public as $$
declare p public.class_polls%rowtype;
begin
  select * into p from public.class_polls where id = p_poll;
  if not found or auth.uid() is null or not public.student_in_class(p.class_id, auth.uid()) then
    raise exception 'not authorised';
  end if;
  if p.status <> 'open' then raise exception 'this quick check is closed'; end if;
  if p_choice < 0 or p_choice >= jsonb_array_length(p.options) then raise exception 'invalid choice'; end if;
  begin
    insert into public.class_poll_answers (poll_id, student_id, choice) values (p_poll, auth.uid(), p_choice);
  exception when unique_violation then
    raise exception 'you have already answered';
  end;
end $$;

-- Polls for a class as the caller may see them. While a check is open a learner gets
-- the question, options and their own choice only. The correct answer and the totals
-- appear once the tutor closes it. The Owner always sees everything.
create or replace function public.get_class_polls(p_class uuid)
returns table (id uuid, question text, options jsonb, status text, my_choice int, correct_index int, counts jsonb, answers int, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare v_owner boolean := public.is_owner();
begin
  if not (v_owner or public.student_in_class(p_class, auth.uid())) then raise exception 'not authorised'; end if;
  return query
    select p.id, p.question, p.options, p.status,
           (select a.choice from public.class_poll_answers a where a.poll_id = p.id and a.student_id = auth.uid()),
           case when v_owner or p.status = 'closed' then p.correct_index end,
           case when v_owner or p.status = 'closed' then
             (select coalesce(jsonb_agg(coalesce(t.n, 0) order by g.i), '[]'::jsonb)
                from generate_series(0, jsonb_array_length(p.options) - 1) as g(i)
                left join (select a.choice, count(*)::int as n from public.class_poll_answers a
                            where a.poll_id = p.id group by a.choice) t on t.choice = g.i)
           end,
           case when v_owner or p.status = 'closed' then
             (select count(*)::int from public.class_poll_answers a where a.poll_id = p.id)
           end,
           p.created_at
      from public.class_polls p where p.class_id = p_class order by p.created_at desc;
end $$;

create or replace function public.submit_class_feedback(p_class uuid, p_understanding int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.classes%rowtype;
begin
  if auth.uid() is null or not public.student_in_class(p_class, auth.uid()) then raise exception 'not authorised'; end if;
  if p_understanding not between 1 and 4 then raise exception 'invalid rating'; end if;
  select * into c from public.classes where id = p_class;
  if c.status = 'cancelled' or c.starts_at > now() then raise exception 'feedback opens once the lesson has started'; end if;
  insert into public.class_feedback (class_id, student_id, understanding, comment)
  values (p_class, auth.uid(), p_understanding, nullif(left(trim(coalesce(p_comment, '')), 1000), ''))
  on conflict (class_id, student_id) do update
    set understanding = excluded.understanding, comment = excluded.comment, created_at = now();
end $$;

-- Tell the family when the tutor answers a question.
create or replace function public.on_question_answered() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.answer is not null and old.answer is distinct from new.answer then
    perform public.notify_family(new.student_id, 'Your question was answered',
      (select title from public.classes where id = new.class_id), '/classes/' || new.class_id);
  end if;
  return new;
end $$;
drop trigger if exists class_questions_answered on public.class_questions;
create trigger class_questions_answered after update on public.class_questions
  for each row execute function public.on_question_answered();

revoke execute on function public.student_in_class(uuid, uuid), public.set_class_rsvp(uuid, uuid, text, text),
  public.ask_class_question(uuid, text), public.answer_class_poll(uuid, int), public.get_class_polls(uuid),
  public.submit_class_feedback(uuid, int, text) from public, anon;
grant execute on function public.student_in_class(uuid, uuid), public.set_class_rsvp(uuid, uuid, text, text),
  public.ask_class_question(uuid, text), public.answer_class_poll(uuid, int), public.get_class_polls(uuid),
  public.submit_class_feedback(uuid, int, text) to authenticated, service_role;
