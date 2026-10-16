import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { as, createDatabase, refused, SERVICE, seedWorld, sql, user, type World } from './harness';

/** Class board, timed quick checks with points, topic reports, behaviour notes and account deletion. */
let db: PGlite;
let w: World;
let lesson: string; // Alice and Bob
let caraClass: string;
let board: string;
let page: string;
let library: string;

beforeAll(async () => {
  db = await createDatabase();
  w = await seedWorld(db);
  const owner = user(w.owner);
  const mk = async (title: string, students: string[]) => {
    const id = (await as<{ id: string }>(db, owner, `insert into classes (title, starts_at, duration_minutes, delivery) values ($1, now() + interval '1 day', 60, 'home') returning id`, [title]))[0]!.id;
    for (const s of students) await as(db, owner, `insert into class_students (class_id, student_id) values ($1, $2)`, [id, s]);
    return id;
  };
  lesson = await mk('Fractions', [w.alice, w.bob]);
  caraClass = await mk('Cara lesson', [w.cara]);
  board = (await as<{ id: string }>(db, owner, `insert into boards (class_id, title) values ($1, 'Fractions board') returning id`, [lesson]))[0]!.id;
  page = (await as<{ id: string }>(db, owner, `insert into board_pages (board_id, background) values ($1, 'grid') returning id`, [board]))[0]!.id;
  await as(db, owner, `insert into board_state (board_id, page_id) values ($1, $2)`, [board, page]);
  await as(db, owner, `insert into board_events (board_id, page_id, kind, data) values ($1, $2, 'pen', '{"points":[[0.1,0.1],[0.2,0.2]]}')`, [board, page]);
  library = (await as<{ id: string }>(db, owner, `insert into boards (title) values ('Saved lesson') returning id`))[0]!.id;
});

const scalar = async <T>(q: string, p: unknown[] = []) => Object.values((await sql<Record<string, T>>(db, q, p))[0] ?? {})[0] as T;

describe('class board', () => {
  it('learners in the class and their parents can watch; others cannot', async () => {
    const sees = async (uid: string) => (await as(db, user(uid), `select 1 from board_events where board_id = $1`, [board])).length;
    expect(await sees(w.alice)).toBe(1);
    expect(await sees(w.bob)).toBe(1);
    expect(await sees(w.parentAB)).toBe(1);
    expect(await sees(w.cara)).toBe(0);
    expect(await sees(w.parentC)).toBe(0);
    expect(await sees(w.stranger)).toBe(0);
  });

  it('only the Owner can draw, change pages or see the lesson library', async () => {
    expect(await refused(db, user(w.alice), `insert into board_events (board_id, page_id, kind, data) values ($1, $2, 'clear', '{}')`, [board, page])).toMatch(/row-level security/);
    await as(db, user(w.alice), `update board_state set page_id = null where board_id = $1`, [board]);
    expect(await scalar<string>(`select page_id from board_state where board_id = $1`, [board])).toBe(page);
    expect((await as(db, user(w.alice), `select 1 from boards where id = $1`, [library])).length).toBe(0);
    expect((await as(db, user(w.owner), `select 1 from boards where id = $1`, [library])).length).toBe(1);
  });

  it('answer boards: a learner answers once per question (later answers replace), and sees only their own', async () => {
    const prompt = (await as<{ id: string }>(db, user(w.owner), `insert into board_prompts (board_id, question) values ($1, 'Draw 3/4') returning id`, [board]))[0]!.id;
    await as(db, user(w.alice), `select submit_board_response($1, '[{"points":[[0,0]]}]', 'three quarters')`, [prompt]);
    await as(db, user(w.alice), `select submit_board_response($1, '[{"points":[[1,1]]}]', 'changed my mind')`, [prompt]);
    await as(db, user(w.bob), `select submit_board_response($1, '[]', 'Bob answer')`, [prompt]);
    const mine = async (uid: string) => (await as<{ text_answer: string }>(db, user(uid), `select text_answer from board_responses where prompt_id = $1 order by text_answer`, [prompt])).map((r) => r.text_answer);
    expect(await mine(w.alice)).toEqual(['changed my mind']);
    expect(await mine(w.bob)).toEqual(['Bob answer']);
    expect((await mine(w.owner)).length).toBe(2);

    expect(await refused(db, user(w.cara), `select submit_board_response($1, '[]')`, [prompt])).toMatch(/not authorised/);
    expect(await refused(db, user(w.parentAB), `select submit_board_response($1, '[]')`, [prompt])).toMatch(/not authorised/);
    expect(await refused(db, user(w.alice), `select submit_board_response($1, '{"x":1}')`, [prompt])).toMatch(/invalid answer/);
    expect(await refused(db, user(w.alice), `insert into board_responses (prompt_id, board_id, student_id) values ($1, $2, $3)`, [prompt, board, w.bob])).toMatch(/row-level security/);
    await as(db, user(w.owner), `update board_prompts set status = 'closed' where id = $1`, [prompt]);
    expect(await refused(db, user(w.alice), `select submit_board_response($1, '[]')`, [prompt])).toMatch(/closed/);
  });
});

describe('timed quick checks with points', () => {
  it('scores correct answers, lists first names and initials only, and only for checks with points on', async () => {
    const owner = user(w.owner);
    const timed = (await as<{ id: string }>(db, owner, `insert into class_polls (class_id, question, options, correct_index, time_limit_seconds, points, created_at) values ($1, 'Half of 8?', '["2","4"]', 1, 20, true, now() - interval '5 seconds') returning id`, [lesson]))[0]!.id;
    const noPoints = (await as<{ id: string }>(db, owner, `insert into class_polls (class_id, question, options, correct_index) values ($1, 'Warm-up question', '["a","b"]', 0) returning id`, [lesson]))[0]!.id;
    await as(db, user(w.alice), `select answer_class_poll($1, 1)`, [timed]);
    await as(db, user(w.bob), `select answer_class_poll($1, 0)`, [timed]);
    await as(db, user(w.alice), `select answer_class_poll($1, 0)`, [noPoints]);
    expect(await as(db, user(w.alice), `select * from get_class_leaderboard($1)`, [lesson])).toEqual([]); // nothing closed yet
    await as(db, owner, `update class_polls set status = 'closed' where class_id = $1`, [lesson]);

    const board = await as<{ rank: number; display_name: string; points: number; is_me: boolean }>(db, user(w.alice), `select * from get_class_leaderboard($1)`, [lesson]);
    expect(board.map((r) => [r.rank, r.display_name, r.is_me])).toEqual([[1, 'Alice', true], [2, 'Bob', false]]);
    expect(board[0]!.points).toBeGreaterThanOrEqual(500);
    expect(board[0]!.points).toBeLessThanOrEqual(1000);
    expect(board[1]!.points).toBe(0);
    expect(await refused(db, user(w.cara), `select * from get_class_leaderboard($1)`, [lesson])).toMatch(/not authorised/);
  });

  it('refuses answers after the time limit', async () => {
    const late = (await as<{ id: string }>(db, user(w.owner), `insert into class_polls (class_id, question, options, correct_index, time_limit_seconds, created_at) values ($1, 'Too late?', '["y","n"]', 0, 5, now() - interval '30 seconds') returning id`, [lesson]))[0]!.id;
    expect(await refused(db, user(w.alice), `select answer_class_poll($1, 0)`, [late])).toMatch(/time is up/);
  });
});

describe('placement test topic report', () => {
  it('breaks a quiz result down by topic for the family and Owner only', async () => {
    const owner = user(w.owner);
    const quiz = (await as<{ id: string }>(db, owner, `insert into assignments (title, kind, max_marks, published) values ('Placement test', 'quiz', 3, true) returning id`))[0]!.id;
    await as(db, owner, `insert into assignment_students (assignment_id, student_id) values ($1, $2)`, [quiz, w.alice]);
    const q = async (topic: string | null, correct: number) =>
      (await as<{ id: string }>(db, owner, `insert into quiz_questions (assignment_id, prompt, options, correct_index, topic) values ($1, 'Q', '["a","b"]', $2, $3) returning id`, [quiz, correct, topic]))[0]!.id;
    const a1 = await q('Fractions', 0), a2 = await q('Fractions', 1), a3 = await q(null, 0);
    const sub = (await as<{ id: string }>(db, user(w.alice), `select submit_quiz($1, $2::jsonb) as id`, [quiz, JSON.stringify({ [a1]: 0, [a2]: 0, [a3]: 0 })]))[0]!.id;
    const rows = await as(db, user(w.parentAB), `select * from get_topic_breakdown($1)`, [sub]);
    expect(rows).toEqual([{ topic: 'Fractions', correct: 1, total: 2 }, { topic: 'General', correct: 1, total: 1 }]);
    expect(await refused(db, user(w.bob), `select * from get_topic_breakdown($1)`, [sub])).toMatch(/not authorised/);
    expect(await refused(db, user(w.parentC), `select * from get_topic_breakdown($1)`, [sub])).toMatch(/not authorised/);
  });
});

describe('behaviour notes', () => {
  it('the Owner records them, the family sees and is notified, nobody else sees them', async () => {
    await as(db, user(w.owner), `insert into behaviour_notes (student_id, kind, category, note, points) values ($1, 'merit', 'Great effort', 'Kept going on hard questions', 2)`, [w.alice]);
    const sees = async (uid: string) => (await as(db, user(uid), `select 1 from behaviour_notes where student_id = $1`, [w.alice])).length;
    expect(await sees(w.alice)).toBe(1);
    expect(await sees(w.parentAB)).toBe(1);
    expect(await sees(w.bob)).toBe(0);
    expect(await sees(w.parentC)).toBe(0);
    expect(await scalar<number>(`select count(*)::int from notifications where user_id = $1 and title = 'Merit awarded'`, [w.parentAB])).toBe(1);
    expect(await refused(db, user(w.alice), `insert into behaviour_notes (student_id, kind, category) values ($1, 'merit', 'Self-awarded')`, [w.alice])).toMatch(/row-level security/);
  });
});

describe('account deletion', () => {
  it('can only be run by the server, never for the Owner', async () => {
    for (const who of [w.alice, w.owner, w.parentC]) {
      expect(await refused(db, user(who), `select erase_account($1)`, [who])).toMatch(/permission denied|not authorised/);
    }
    expect(await refused(db, SERVICE, `select erase_account($1)`, [w.owner])).toMatch(/owner account/);
  });

  it('removes personal and learning data but keeps invoices and payments, unlinked from the name', async () => {
    const owner = user(w.owner);
    await as(db, owner, `insert into attendance (class_id, student_id, status) values ($1, $2, 'present')`, [caraClass, w.cara]);
    const inv = (await as<{ id: string }>(db, owner, `insert into invoices (number, student_id, period_start, period_end, currency) values ('INV-T-1', $1, current_date, current_date, 'NGN') returning id`, [w.cara]))[0]!.id;
    await as(db, owner, `insert into behaviour_notes (student_id, kind, category) values ($1, 'concern', 'Late')`, [w.cara]);

    await as(db, SERVICE, `select erase_account($1)`, [w.cara]);

    const p = (await sql<Record<string, unknown>>(db, `select full_name, email, phone, status from profiles where id = $1`, [w.cara]))[0]!;
    expect(p).toMatchObject({ full_name: 'Deleted account', phone: null, status: 'inactive' });
    expect(p.email).toMatch(/^deleted\+.*@invalid\.invalid$/);
    for (const t of ['attendance', 'class_students', 'behaviour_notes', 'parent_student_links']) {
      expect(await scalar<number>(`select count(*)::int from ${t} where student_id = $1`, [w.cara]), t).toBe(0);
    }
    expect(await scalar<number>(`select count(*)::int from invoices where id = $1`, [inv])).toBe(1);
    expect(await scalar<number>(`select count(*)::int from audit_log where action = 'account.erased' and entity_id = $1`, [w.cara])).toBe(1);
    // Cara's parent keeps their own account but is no longer linked to her.
    expect((await as(db, user(w.parentC), `select 1 from profiles where id = $1`, [w.cara])).length).toBe(0);
  });

  it('deleting a parent keeps their children’s attendance confirmations', async () => {
    await as(db, user(w.parentAB), `select set_class_rsvp($1, $2, 'attending')`, [lesson, w.bob]);
    await as(db, SERVICE, `select erase_account($1)`, [w.parentAB]);
    expect(await scalar<string | null>(`select responded_by from class_rsvps where class_id = $1 and student_id = $2`, [lesson, w.bob])).toBeNull();
    expect(await scalar<number>(`select count(*)::int from parent_student_links where parent_id = $1`, [w.parentAB])).toBe(0);
  });
});
