-- Server-side quiz timing. The start time is recorded in the database when the
-- student opens the questions, so it cannot be altered from the browser. Idempotent.

create table if not exists public.quiz_starts (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt int not null,
  started_at timestamptz not null default now(),
  primary key (assignment_id, student_id, attempt)
);
alter table public.quiz_starts enable row level security;
drop policy if exists owner_all on public.quiz_starts;
create policy owner_all on public.quiz_starts for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
drop policy if exists own_read on public.quiz_starts;
create policy own_read on public.quiz_starts for select to authenticated using (student_id = auth.uid());

-- Records (once) when the current attempt began and returns that time.
create or replace function public.start_quiz(p_assignment uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_attempt int; v_started timestamptz; a public.assignments%rowtype;
begin
  if not public.student_has_assignment(p_assignment, auth.uid()) then raise exception 'not authorised'; end if;
  select * into a from public.assignments where id = p_assignment;
  if a.kind not in ('quiz','timed') then raise exception 'not a quiz'; end if;
  select coalesce(max(attempt), 0) + 1 into v_attempt
    from public.submissions where assignment_id = p_assignment and student_id = auth.uid();
  if v_attempt > 1 and not a.allow_resubmission then raise exception 'this quiz has already been submitted'; end if;
  insert into public.quiz_starts (assignment_id, student_id, attempt) values (p_assignment, auth.uid(), v_attempt)
  on conflict do nothing;
  select started_at into v_started from public.quiz_starts
   where assignment_id = p_assignment and student_id = auth.uid() and attempt = v_attempt;
  return v_started;
end $$;

-- submit_quiz now takes the start time from quiz_starts; p_started_at is ignored.
create or replace function public.submit_quiz(p_assignment uuid, p_answers jsonb, p_started_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a public.assignments%rowtype; v_attempt int; v_raw numeric := 0; v_max numeric := 0;
        v_score numeric; v_id uuid; q record; v_started timestamptz;
begin
  if not public.student_has_assignment(p_assignment, auth.uid()) then raise exception 'not authorised'; end if;
  select * into a from public.assignments where id = p_assignment;
  if a.kind not in ('quiz','timed') then raise exception 'not a quiz'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'invalid answers'; end if;

  select coalesce(max(attempt), 0) + 1 into v_attempt
    from public.submissions where assignment_id = p_assignment and student_id = auth.uid();
  if v_attempt > 1 and not a.allow_resubmission then raise exception 'this quiz has already been submitted'; end if;
  select started_at into v_started from public.quiz_starts
   where assignment_id = p_assignment and student_id = auth.uid() and attempt = v_attempt;

  for q in select * from public.quiz_questions where assignment_id = p_assignment loop
    v_max := v_max + q.marks;
    if (p_answers ->> q.id::text) ~ '^[0-9]{1,2}$' and (p_answers ->> q.id::text)::int = q.correct_index then
      v_raw := v_raw + q.marks;
    end if;
  end loop;
  v_score := case when v_max > 0 then round(v_raw / v_max * a.max_marks, 2) else 0 end;

  insert into public.submissions (assignment_id, student_id, attempt, answers, started_at,
                                  auto_score, score, status, graded_at)
  values (p_assignment, auth.uid(), v_attempt, p_answers, v_started, v_score, v_score, 'graded', now())
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.start_quiz(uuid) from public, anon;
grant execute on function public.start_quiz(uuid) to authenticated;
