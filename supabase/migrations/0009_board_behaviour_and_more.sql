-- Class board (live whiteboard with answer boards), timed quick checks with points,
-- quiz topics for placement-test reports, behaviour notes, and account deletion.
-- Idempotent.

-- ===========================================================================
-- Class board
-- A board belongs to one class (class_id set) or is a saved lesson in the Owner's
-- library (class_id null) that can be copied into a class.
-- Drawing is stored as an append-only event log: every pen stroke, erase and clear
-- is a new row. Late joiners and replays rebuild the board by reading the log in
-- order, and live viewers receive the same rows through Supabase Realtime.
-- ===========================================================================
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  class_id uuid unique references public.classes(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_pages (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  position int not null default 0,
  background text not null default 'blank' check (background in ('blank','grid','lined','axes','numberline','image')),
  image_path text,               -- object in the private "boards" bucket when background = 'image'
  created_at timestamptz not null default now()
);
create index if not exists board_pages_board_idx on public.board_pages (board_id, position);

create table if not exists public.board_events (
  id bigint generated always as identity primary key,
  board_id uuid not null references public.boards(id) on delete cascade,
  page_id uuid not null references public.board_pages(id) on delete cascade,
  kind text not null check (kind in ('pen','highlighter','line','arrow','rect','circle','text','protractor','fraction','erase','clear')),
  data jsonb not null,           -- points / position / text / ids to erase; coordinates are 0..1 of the page
  created_at timestamptz not null default now(),
  check (octet_length(data::text) <= 200000)
);
create index if not exists board_events_page_idx on public.board_events (page_id, id);

-- What learners are looking at right now: the teacher's page, an open answer-board
-- prompt, and a learner's answer shown to the class.
create table if not exists public.board_state (
  board_id uuid primary key references public.boards(id) on delete cascade,
  page_id uuid references public.board_pages(id) on delete set null,
  prompt_id uuid,
  spotlight jsonb,               -- { "name": "Ada O.", "strokes": [...] } chosen by the Owner
  timer_ends_at timestamptz,     -- a countdown everyone sees
  updated_at timestamptz not null default now()
);

-- Answer boards: the Owner asks; each learner answers on their own mini board.
create table if not exists public.board_prompts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 500),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.board_responses (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.board_prompts(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  strokes jsonb not null default '[]'::jsonb,
  text_answer text check (char_length(text_answer) <= 500),
  submitted_at timestamptz not null default now(),
  unique (prompt_id, student_id),
  check (octet_length(strokes::text) <= 100000)
);

alter table public.boards enable row level security;
alter table public.board_pages enable row level security;
alter table public.board_events enable row level security;
alter table public.board_state enable row level security;
alter table public.board_prompts enable row level security;
alter table public.board_responses enable row level security;

-- Can the caller view this board? Owner always; otherwise a learner in the board's
-- class, or a verified parent of one. Library boards (no class) are Owner-only.
create or replace function public.can_view_board(p_board uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner() or exists (
    select 1 from public.boards b
    join public.class_students cs on cs.class_id = b.class_id
    where b.id = p_board and public.can_view_student(cs.student_id));
$$;

do $$ declare t text; begin
  foreach t in array array['boards','board_pages','board_events','board_state','board_prompts','board_responses'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated
                    using (public.is_owner()) with check (public.is_owner())', t);
    execute format('drop policy if exists class_read on public.%I', t);
  end loop;
end $$;
create policy class_read on public.boards for select to authenticated using (public.can_view_board(id));
create policy class_read on public.board_pages for select to authenticated using (public.can_view_board(board_id));
create policy class_read on public.board_events for select to authenticated using (public.can_view_board(board_id));
create policy class_read on public.board_state for select to authenticated using (public.can_view_board(board_id));
create policy class_read on public.board_prompts for select to authenticated using (public.can_view_board(board_id));
-- A learner sees only their own answer board; the Owner sees all of them.
create policy class_read on public.board_responses for select to authenticated using (public.can_view_student(student_id));

create or replace function public.submit_board_response(p_prompt uuid, p_strokes jsonb, p_text text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p public.board_prompts%rowtype; v_class uuid;
begin
  select * into p from public.board_prompts where id = p_prompt;
  if not found then raise exception 'not authorised'; end if;
  select class_id into v_class from public.boards where id = p.board_id;
  if auth.uid() is null or v_class is null or not public.student_in_class(v_class, auth.uid()) then
    raise exception 'not authorised';
  end if;
  if p.status <> 'open' then raise exception 'this question is closed'; end if;
  if jsonb_typeof(p_strokes) <> 'array' then raise exception 'invalid answer'; end if;
  insert into public.board_responses (prompt_id, board_id, student_id, strokes, text_answer, submitted_at)
  values (p_prompt, p.board_id, auth.uid(), p_strokes, nullif(left(trim(coalesce(p_text, '')), 500), ''), now())
  on conflict (prompt_id, student_id) do update
    set strokes = excluded.strokes, text_answer = excluded.text_answer, submitted_at = now();
end $$;

-- Private bucket for slide images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boards', 'boards', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ta_board_owner on storage.objects;
create policy ta_board_owner on storage.objects for all to authenticated
  using (bucket_id = 'boards' and public.is_owner()) with check (bucket_id = 'boards' and public.is_owner());
drop policy if exists ta_board_read on storage.objects;
create policy ta_board_read on storage.objects for select to authenticated
  using (bucket_id = 'boards'
         and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and public.can_view_board(((storage.foldername(name))[1])::uuid));

-- ===========================================================================
-- Timed quick checks with points (a live quiz). A correct answer scores up to 1000
-- points, more for answering quickly; the class leaderboard shows first names only
-- and only when the Owner turned points on for that check.
-- ===========================================================================
alter table public.class_polls add column if not exists time_limit_seconds int check (time_limit_seconds between 5 and 600);
alter table public.class_polls add column if not exists points boolean not null default false;

create or replace function public.answer_class_poll(p_poll uuid, p_choice int)
returns void language plpgsql security definer set search_path = public as $$
declare p public.class_polls%rowtype;
begin
  select * into p from public.class_polls where id = p_poll;
  if not found or auth.uid() is null or not public.student_in_class(p.class_id, auth.uid()) then
    raise exception 'not authorised';
  end if;
  if p.status <> 'open' then raise exception 'this quick check is closed'; end if;
  -- Two seconds of grace for network delay.
  if p.time_limit_seconds is not null and now() > p.created_at + make_interval(secs => p.time_limit_seconds + 2) then
    raise exception 'time is up for this quick check';
  end if;
  if p_choice < 0 or p_choice >= jsonb_array_length(p.options) then raise exception 'invalid choice'; end if;
  begin
    insert into public.class_poll_answers (poll_id, student_id, choice) values (p_poll, auth.uid(), p_choice);
  exception when unique_violation then
    raise exception 'you have already answered';
  end;
end $$;

-- Same as before, plus the time limit and whether points are on (the return type
-- changes, so the function is dropped and recreated).
drop function if exists public.get_class_polls(uuid);
create function public.get_class_polls(p_class uuid)
returns table (id uuid, question text, options jsonb, status text, my_choice int, correct_index int, counts jsonb, answers int,
               created_at timestamptz, time_limit_seconds int, points boolean)
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
           p.created_at, p.time_limit_seconds, p.points
      from public.class_polls p where p.class_id = p_class order by p.created_at desc;
end $$;
revoke execute on function public.get_class_polls(uuid) from public, anon;
grant execute on function public.get_class_polls(uuid) to authenticated, service_role;

create or replace function public.get_class_leaderboard(p_class uuid)
returns table (rank int, display_name text, points int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_owner() or public.student_in_class(p_class, auth.uid())) then raise exception 'not authorised'; end if;
  return query
    with scored as (
      select a.student_id,
             sum(case when a.choice = p.correct_index then
                   case when p.time_limit_seconds is null then 1000
                        else greatest(500, round(1000 - 500 * least(1, extract(epoch from (a.created_at - p.created_at)) / p.time_limit_seconds)))::int end
                 else 0 end)::int as pts
        from public.class_poll_answers a
        join public.class_polls p on p.id = a.poll_id
       where p.class_id = p_class and p.points and p.status = 'closed' and p.correct_index is not null
       group by a.student_id)
    select (rank() over (order by s.pts desc))::int,
           split_part(pr.full_name, ' ', 1) || coalesce(' ' || left(nullif(split_part(pr.full_name, ' ', 2), ''), 1) || '.', ''),
           s.pts,
           s.student_id = auth.uid()
      from scored s join public.profiles pr on pr.id = s.student_id
     order by s.pts desc
     limit 10;
end $$;

-- ===========================================================================
-- Quiz topics: a placement or aptitude test reports results topic by topic.
-- ===========================================================================
alter table public.quiz_questions add column if not exists topic text check (char_length(topic) <= 80);

create or replace function public.get_topic_breakdown(p_submission uuid)
returns table (topic text, correct int, total int)
language plpgsql stable security definer set search_path = public as $$
declare s public.submissions%rowtype;
begin
  select * into s from public.submissions where id = p_submission;
  if not found or not public.can_view_student(s.student_id) then raise exception 'not authorised'; end if;
  return query
    select coalesce(nullif(q.topic, ''), 'General'),
           count(*) filter (where (s.answers ->> q.id::text) ~ '^[0-9]{1,2}$' and (s.answers ->> q.id::text)::int = q.correct_index)::int,
           count(*)::int
      from public.quiz_questions q
     where q.assignment_id = s.assignment_id
     group by 1 order by 1;
end $$;

-- ===========================================================================
-- Behaviour: merits and concerns the Owner records; the learner and parents see them.
-- ===========================================================================
create table if not exists public.behaviour_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  kind text not null check (kind in ('merit','concern')),
  category text not null check (char_length(category) between 2 and 60),
  note text check (char_length(note) <= 1000),
  points int not null default 1 check (points between 1 and 10),
  created_at timestamptz not null default now()
);
create index if not exists behaviour_student_idx on public.behaviour_notes (student_id, created_at desc);
alter table public.behaviour_notes enable row level security;
drop policy if exists owner_all on public.behaviour_notes;
create policy owner_all on public.behaviour_notes for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists family_read on public.behaviour_notes;
create policy family_read on public.behaviour_notes for select to authenticated using (public.can_view_student(student_id));

create or replace function public.on_behaviour_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_family(new.student_id,
    case when new.kind = 'merit' then 'Merit awarded' else 'Behaviour note' end, new.category, '/reports');
  return new;
end $$;
drop trigger if exists behaviour_notify on public.behaviour_notes;
create trigger behaviour_notify after insert on public.behaviour_notes
  for each row execute function public.on_behaviour_insert();

-- ===========================================================================
-- Account deletion. Called by the server (service role) after it has verified the
-- person's password and their typed confirmation. Personal and learning data are
-- removed. Invoices and payments are kept, as the law requires for financial
-- records, but are no longer linked to a name, email or phone number.
-- ===========================================================================
create or replace function public.erase_account(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if auth.role() <> 'service_role' then raise exception 'not authorised'; end if;
  select role into v_role from public.profiles where id = p_user;
  if v_role is null then raise exception 'account not found'; end if;
  if v_role = 'owner' then raise exception 'the owner account cannot be deleted this way'; end if;

  delete from public.message_threads where participant_id = p_user;            -- and their messages
  delete from public.notifications where user_id = p_user;
  delete from public.push_subscriptions where user_id = p_user;
  delete from public.parent_student_links where parent_id = p_user or student_id = p_user;
  delete from public.class_rsvps where student_id = p_user;
  update public.class_rsvps set responded_by = null where responded_by = p_user;
  delete from public.class_questions where student_id = p_user;
  delete from public.class_poll_answers where student_id = p_user;
  delete from public.class_feedback where student_id = p_user;
  delete from public.board_responses where student_id = p_user;
  delete from public.behaviour_notes where student_id = p_user;
  delete from public.submissions where student_id = p_user;
  delete from public.assignment_students where student_id = p_user;
  delete from public.attendance where student_id = p_user;
  delete from public.class_students where student_id = p_user;
  delete from public.material_students where student_id = p_user;
  delete from public.reports where student_id = p_user;
  delete from public.certificates where student_id = p_user;
  delete from public.student_enrolments where student_id = p_user;
  delete from public.student_notes where student_id = p_user;
  delete from public.guardian_links where student_id = p_user;
  delete from public.quiz_starts where student_id = p_user;
  -- email_preferences is created in 0010; plpgsql resolves the table when this runs.
  if to_regclass('public.email_preferences') is not null then
    execute 'delete from public.email_preferences where email = lower($1)' using (select email from public.profiles where id = p_user);
  end if;
  delete from public.applications where student_id = p_user
     or lower(guardian_email) = (select lower(email) from public.profiles where id = p_user and role = 'parent');

  update public.profiles set
    full_name = 'Deleted account', email = 'deleted+' || p_user || '@invalid.invalid', phone = null,
    date_of_birth = null, school_year = null, curriculum = null, location = null, learning_needs = null,
    goals = null, status = 'inactive'
  where id = p_user;

  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (null, 'account.erased', 'profile', p_user::text, jsonb_build_object('role', v_role));
end $$;

revoke execute on function public.can_view_board(uuid), public.submit_board_response(uuid, jsonb, text),
  public.get_class_leaderboard(uuid), public.get_topic_breakdown(uuid), public.erase_account(uuid) from public, anon;
grant execute on function public.can_view_board(uuid), public.submit_board_response(uuid, jsonb, text),
  public.get_class_leaderboard(uuid), public.get_topic_breakdown(uuid) to authenticated, service_role;
revoke execute on function public.erase_account(uuid) from authenticated;
grant execute on function public.erase_account(uuid) to service_role;

-- ===========================================================================
-- Live updates: publish board and quick-check changes through Supabase Realtime.
-- Realtime applies the same RLS policies to each subscriber.
-- ===========================================================================
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['board_events','board_pages','board_state','board_prompts','board_responses','class_polls'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
