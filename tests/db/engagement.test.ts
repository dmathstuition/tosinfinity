import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, refused, seedWorld, sql, user, type World } from './harness';

/** Lesson-room participation: confirmations, questions, quick checks, check-ins, class materials. */
let db: PGlite;
let w: World;
let shared: string; // future class with Alice and Bob
let past: string; // class that has already started, Alice only
let caraClass: string;

beforeAll(async () => {
  db = await createDatabase();
  w = await seedWorld(db);
  const owner = user(w.owner);
  const mk = async (title: string, when: string, students: string[]) => {
    const id = (await as<{ id: string }>(db, owner, `insert into classes (title, starts_at, duration_minutes, delivery) values ($1, now() + $2::interval, 60, 'online') returning id`, [title, when]))[0]!.id;
    for (const s of students) await as(db, owner, `insert into class_students (class_id, student_id) values ($1, $2)`, [id, s]);
    return id;
  };
  shared = await mk('Shared lesson', '2 days', [w.alice, w.bob]);
  past = await mk('Earlier lesson', '-2 hours', [w.alice]);
  caraClass = await mk('Cara lesson', '1 day', [w.cara]);
});

const scalar = async <T>(q: string, p: unknown[] = []) => Object.values((await sql<Record<string, T>>(db, q, p))[0] ?? {})[0] as T;

describe('attendance confirmation', () => {
  it('a student or their verified parent can confirm, and the latest answer replaces the earlier one', async () => {
    await as(db, user(w.alice), `select set_class_rsvp($1, $2, 'attending')`, [shared, w.alice]);
    await as(db, user(w.parentAB), `select set_class_rsvp($1, $2, 'not_attending', 'Dentist appointment')`, [shared, w.alice]);
    const row = (await sql<Record<string, string>>(db, `select response, note, responded_by from class_rsvps where class_id = $1 and student_id = $2`, [shared, w.alice]))[0]!;
    expect(row).toEqual({ response: 'not_attending', note: 'Dentist appointment', responded_by: w.parentAB });
    expect(await scalar<number>(`select count(*)::int from class_rsvps where class_id = $1 and student_id = $2`, [shared, w.alice])).toBe(1);
    // The tutor is told when someone cannot attend.
    expect(await scalar<number>(`select count(*)::int from notifications where user_id = $1 and title = 'A learner cannot attend'`, [w.owner])).toBe(1);
  });

  it('nobody can answer for a learner they are not responsible for, or for a class the learner is not in', async () => {
    expect(await refused(db, user(w.bob), `select set_class_rsvp($1, $2, 'attending')`, [shared, w.alice])).toMatch(/not authorised/);
    expect(await refused(db, user(w.parentC), `select set_class_rsvp($1, $2, 'attending')`, [shared, w.alice])).toMatch(/not authorised/);
    expect(await refused(db, user(w.alice), `select set_class_rsvp($1, $2, 'attending')`, [caraClass, w.alice])).toMatch(/not authorised/);
    expect(await refused(db, user(w.stranger), `select set_class_rsvp($1, $2, 'attending')`, [shared, w.alice])).toMatch(/not authorised/);
    expect(await refused(db, user(w.alice), `insert into class_rsvps (class_id, student_id, response) values ($1, $2, 'attending')`, [caraClass, w.alice])).toMatch(/row-level security/);
  });

  it('cannot be changed once the lesson has started', async () => {
    expect(await refused(db, user(w.alice), `select set_class_rsvp($1, $2, 'attending')`, [past, w.alice])).toMatch(/already started/);
  });

  it('is visible to the family and the tutor only', async () => {
    const count = async (uid: string) => (await as(db, user(uid), `select 1 from class_rsvps where class_id = $1`, [shared])).length;
    expect(await count(w.alice)).toBe(1);
    expect(await count(w.parentAB)).toBe(1);
    expect(await count(w.bob)).toBe(0); // same class, different learner
    expect(await count(w.parentC)).toBe(0);
    expect(await count(w.owner)).toBe(1);
  });
});

describe('questions for the tutor', () => {
  it('stay private between the learner, their parents and the tutor, even in a shared class', async () => {
    await as(db, user(w.alice), `select ask_class_question($1, 'Why do we flip the fraction when dividing?')`, [shared]);
    await as(db, user(w.bob), `select ask_class_question($1, 'Can we revise negative numbers?')`, [shared]);
    const bodies = async (uid: string) => (await as<{ body: string }>(db, user(uid), `select body from class_questions where class_id = $1 order by body`, [shared])).map((r) => r.body);
    expect(await bodies(w.alice)).toEqual(['Why do we flip the fraction when dividing?']);
    expect(await bodies(w.bob)).toEqual(['Can we revise negative numbers?']);
    expect((await bodies(w.parentAB)).length).toBe(2); // parent of both
    expect(await bodies(w.cara)).toEqual([]);
    expect((await bodies(w.owner)).length).toBe(2);
  });

  it('can only be asked by a learner in that class, within limits', async () => {
    expect(await refused(db, user(w.cara), `select ask_class_question($1, 'Let me in')`, [shared])).toMatch(/not authorised/);
    expect(await refused(db, user(w.parentAB), `select ask_class_question($1, 'Asking as a parent')`, [shared])).toMatch(/not authorised/);
    expect(await refused(db, user(w.alice), `select ask_class_question($1, 'x')`, [shared])).toMatch(/check constraint/);
    expect(await refused(db, user(w.alice), `insert into class_questions (class_id, student_id, body, answer) values ($1, $2, 'Forged question', 'Forged answer')`, [shared, w.alice])).toMatch(/row-level security/);
  });

  it('a learner cannot write the answer; when the tutor answers, the family is notified', async () => {
    await as(db, user(w.alice), `update class_questions set answer = 'I answered myself' where student_id = $1`, [w.alice]);
    expect(await scalar<string | null>(`select answer from class_questions where student_id = $1`, [w.alice])).toBeNull();
    await as(db, user(w.owner), `update class_questions set answer = 'Dividing is multiplying by the reciprocal.', answered_at = now() where student_id = $1`, [w.alice]);
    expect((await as<{ answer: string }>(db, user(w.alice), `select answer from class_questions`))[0]!.answer).toContain('reciprocal');
    expect(await scalar<string>(`select href from notifications where user_id = $1 and title = 'Your question was answered'`, [w.alice])).toBe(`/portal/classes/${shared}`);
    expect(await scalar<string>(`select href from notifications where user_id = $1 and title = 'Your question was answered'`, [w.parentAB])).toBe(`/parent/classes/${shared}`);
  });
});

describe('quick checks (polls)', () => {
  let poll: string;
  type PollRow = { id: string; status: string; my_choice: number | null; correct_index: number | null; counts: number[] | null; answers: number | null };
  const polls = async (uid: string) => as<PollRow>(db, user(uid), `select * from get_class_polls($1)`, [shared]);

  beforeAll(async () => {
    poll = (await as<{ id: string }>(db, user(w.owner), `insert into class_polls (class_id, question, options, correct_index) values ($1, 'What is 3/4 as a decimal?', '["0.34","0.75","0.43"]', 1) returning id`, [shared]))[0]!.id;
  });

  it('hide the correct answer and the totals from learners while open', async () => {
    expect((await as(db, user(w.alice), `select * from class_polls`)).length).toBe(0); // no direct table access
    await as(db, user(w.alice), `select answer_class_poll($1, 0)`, [poll]);
    const mine = (await polls(w.alice))[0]!;
    expect(mine).toMatchObject({ status: 'open', my_choice: 0, correct_index: null, counts: null, answers: null });
    // Another learner in the class cannot see Alice's choice.
    expect((await polls(w.bob))[0]!.my_choice).toBeNull();
    expect((await as(db, user(w.bob), `select * from class_poll_answers`)).length).toBe(0);
    // The tutor sees results as they come in.
    expect((await polls(w.owner))[0]).toMatchObject({ correct_index: 1, counts: [1, 0, 0], answers: 1 });
  });

  it('accept one answer per learner, only from the class, only a valid option', async () => {
    expect(await refused(db, user(w.alice), `select answer_class_poll($1, 1)`, [poll])).toMatch(/already answered/);
    expect(await refused(db, user(w.cara), `select answer_class_poll($1, 1)`, [poll])).toMatch(/not authorised/);
    expect(await refused(db, user(w.parentAB), `select answer_class_poll($1, 1)`, [poll])).toMatch(/not authorised/);
    expect(await refused(db, user(w.bob), `select answer_class_poll($1, 7)`, [poll])).toMatch(/invalid choice/);
    expect(await refused(db, user(w.cara), `select * from get_class_polls($1)`, [shared])).toMatch(/not authorised/);
    expect(await refused(db, user(w.bob), `insert into class_poll_answers (poll_id, student_id, choice) values ($1, $2, 1)`, [poll, w.bob])).toMatch(/row-level security/);
    await as(db, user(w.bob), `select answer_class_poll($1, 1)`, [poll]);
  });

  it('reveal the answer and anonymous totals once closed, and take no more answers', async () => {
    await as(db, user(w.owner), `update class_polls set status = 'closed', closed_at = now() where id = $1`, [poll]);
    expect((await polls(w.alice))[0]).toMatchObject({ status: 'closed', my_choice: 0, correct_index: 1, counts: [1, 1, 0], answers: 2 });
    const late = (await as<{ id: string }>(db, user(w.owner), `insert into class_polls (class_id, question, options, status) values ($1, 'Closed check', '["a","b"]', 'closed') returning id`, [shared]))[0]!.id;
    expect(await refused(db, user(w.alice), `select answer_class_poll($1, 0)`, [late])).toMatch(/closed/);
    // A learner cannot reopen or edit a check.
    await as(db, user(w.alice), `update class_polls set status = 'open', correct_index = 0`);
    expect(await scalar<string>(`select status from class_polls where id = $1`, [poll])).toBe('closed');
  });
});

describe('understanding check-in', () => {
  it('opens once the lesson has started and can be revised', async () => {
    expect(await refused(db, user(w.alice), `select submit_class_feedback($1, 3, null)`, [shared])).toMatch(/once the lesson has started/);
    await as(db, user(w.alice), `select submit_class_feedback($1, 2, 'Lost on the last example')`, [past]);
    await as(db, user(w.alice), `select submit_class_feedback($1, 3, null)`, [past]);
    expect((await sql(db, `select understanding, comment from class_feedback where class_id = $1`, [past]))[0]).toEqual({ understanding: 3, comment: null });
  });

  it('accepts only the learner’s own rating from 1 to 4', async () => {
    expect(await refused(db, user(w.alice), `select submit_class_feedback($1, 9, null)`, [past])).toMatch(/invalid rating/);
    expect(await refused(db, user(w.bob), `select submit_class_feedback($1, 4, null)`, [past])).toMatch(/not authorised/);
    expect((await as(db, user(w.bob), `select 1 from class_feedback`)).length).toBe(0);
    expect((await as(db, user(w.parentAB), `select 1 from class_feedback`)).length).toBe(1);
  });
});

describe('materials attached to a lesson', () => {
  it('are visible to learners in that class and nobody else', async () => {
    const owner = user(w.owner);
    const m = (await as<{ id: string }>(db, owner, `insert into materials (title, bucket, path) values ('Lesson worksheet', 'materials', 'lesson-ws.pdf') returning id`))[0]!.id;
    await as(db, owner, `insert into class_materials (class_id, material_id) values ($1, $2)`, [shared, m]);
    await sql(db, `insert into storage.objects (bucket_id, name) values ('materials', 'lesson-ws.pdf')`);
    const sees = async (uid: string) => (await as(db, user(uid), `select 1 from materials where id = $1`, [m])).length;
    const file = async (uid: string) => (await as(db, user(uid), `select 1 from storage.objects where name = 'lesson-ws.pdf'`)).length;
    for (const uid of [w.alice, w.bob, w.parentAB]) {
      expect(await sees(uid), uid).toBe(1);
      expect(await file(uid), uid).toBe(1);
    }
    for (const uid of [w.cara, w.parentC, w.stranger]) {
      expect(await sees(uid), uid).toBe(0);
      expect(await file(uid), uid).toBe(0);
    }
    expect((await as(db, user(w.cara), `select 1 from class_materials`)).length).toBe(0);
    expect(await refused(db, user(w.alice), `insert into class_materials (class_id, material_id) values ($1, $2)`, [caraClass, m])).toMatch(/row-level security/);
  });
});

describe('lesson recap', () => {
  it('is written by the tutor and readable by learners in the class only', async () => {
    await as(db, user(w.owner), `update classes set recap = 'We covered equivalent fractions.', homework = 'Exercise 4, questions 1-6', recap_at = now() where id = $1`, [shared]);
    expect((await as<{ recap: string }>(db, user(w.bob), `select recap from classes where id = $1`, [shared]))[0]!.recap).toContain('equivalent fractions');
    expect((await as(db, user(w.cara), `select recap from classes where id = $1`, [shared])).length).toBe(0);
    await as(db, user(w.alice), `update classes set recap = 'edited by a learner' where id = $1`, [shared]);
    expect(await scalar<string>(`select recap from classes where id = $1`, [shared])).toBe('We covered equivalent fractions.');
  });
});
