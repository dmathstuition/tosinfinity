import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { ANON, as, authUser, createDatabase, refused, seedWorld, SERVICE, sql, user, type World } from './harness';

/** Business workflows whose integrity is enforced in the database. */
let db: PGlite;
let w: World;

beforeAll(async () => {
  db = await createDatabase();
  w = await seedWorld(db);
});

const scalar = async <T>(query: string, params: unknown[] = []) => Object.values((await sql<Record<string, T>>(db, query, params))[0] ?? {})[0] as T;

describe('application approval', () => {
  const newApplication = async (guardianEmail = 'guardian@example.test') =>
    (await sql<{ id: string }>(db, `insert into applications (student_name, school_year, guardian_name, guardian_email, guardian_phone, guardian_relationship, delivery, consent_at, challenges, desired_outcomes)
       values ('Dayo Learner', 'SS1', 'Guardian One', $1, '08011111111', 'father', 'home', now(), 'fractions', 'pass WAEC') returning id`, [guardianEmail]))[0]!.id;

  it('creates the student, a sequential student ID and a verified parent link in one step', async () => {
    const app = await newApplication();
    const student = await authUser(db, 'dayo@example.test');
    const parent = await authUser(db, 'guardian@example.test');
    const before = await scalar<number>(`select count(*)::int from profiles where role = 'student'`);
    const code = (await as<{ code: string }>(db, user(w.owner), `select approve_application($1, $2, 'dayo@example.test', $3) as code`, [app, student, parent]))[0]!.code;

    expect(code).toMatch(new RegExp(`^TA-${new Date().getFullYear()}-\\d{3}$`));
    expect(Number(code.slice(-3))).toBe(before + 1);
    const profile = (await sql<Record<string, string>>(db, `select role, full_name, student_code, learning_needs, goals, delivery from profiles where id = $1`, [student]))[0]!;
    expect(profile).toMatchObject({ role: 'student', full_name: 'Dayo Learner', student_code: code, learning_needs: 'fractions', goals: 'pass WAEC', delivery: 'home' });
    expect(await scalar<string>(`select role from profiles where id = $1`, [parent])).toBe('parent');
    expect(await scalar<boolean>(`select verified_at is not null from parent_student_links where parent_id = $1 and student_id = $2`, [parent, student])).toBe(true);
    expect((await sql<{ status: string; student_id: string }>(db, `select status, student_id from applications where id = $1`, [app]))[0]).toEqual({ status: 'approved', student_id: student });
    expect(await scalar<number>(`select count(*)::int from audit_log where action = 'application.approved' and entity_id = $1`, [app])).toBe(1);
    // The new parent sees exactly this one child.
    expect((await as(db, user(parent), `select id from profiles where role = 'student'`)).length).toBe(1);
  });

  it('cannot be approved twice, so no duplicate profile is ever created', async () => {
    const app = await newApplication('guardian2@example.test');
    const student = await authUser(db, 'twice@example.test');
    await as(db, user(w.owner), `select approve_application($1, $2, 'twice@example.test', null)`, [app, student]);
    const again = await authUser(db, 'twice.again@example.test');
    expect(await refused(db, user(w.owner), `select approve_application($1, $2, 'twice.again@example.test', null)`, [app, again])).toMatch(/already approved/);
    expect(await scalar<number>(`select count(*)::int from profiles where id = $1`, [again])).toBe(0);
  });

  it('rolls back completely when any part fails', async () => {
    const app = await newApplication('alice@example.test'); // guardian email belongs to a STUDENT account
    const student = await authUser(db, 'rollback@example.test');
    const codesBefore = await scalar<number>(`select last_value from student_code_counters where year = extract(year from now())::int`);
    expect(await refused(db, user(w.owner), `select approve_application($1, $2, 'rollback@example.test', $3)`, [app, student, w.alice])).toMatch(/non-parent account/);
    expect(await scalar<number>(`select count(*)::int from profiles where id = $1`, [student])).toBe(0);
    expect(await scalar<string>(`select status from applications where id = $1`, [app])).toBe('new');
    expect(await scalar<number>(`select last_value from student_code_counters where year = extract(year from now())::int`)).toBe(codesBefore);
  });

  it('refuses a student login that already has a profile, and anyone who is not the Owner', async () => {
    const app = await newApplication('guardian3@example.test');
    expect(await refused(db, user(w.owner), `select approve_application($1, $2, 'bob@example.test', null)`, [app, w.bob])).toMatch(/already has a profile/);
    const student = await authUser(db, 'sneaky@example.test');
    for (const who of [user(w.alice), user(w.parentAB), user(w.stranger)]) {
      expect(await refused(db, who, `select approve_application($1, $2, 'sneaky@example.test', null)`, [app, student])).toMatch(/not authorised/);
    }
    expect(await refused(db, ANON, `select approve_application($1, $2, 'sneaky@example.test', null)`, [app, student])).toMatch(/permission denied/);
  });

  it('an existing parent is linked to a second child without creating a duplicate account', async () => {
    const before = await scalar<number>(`select count(*)::int from profiles where role = 'parent'`);
    await as(db, user(w.owner), `select link_parent($1, $2, 'Ignored Name', 'parent.c@example.test', '', 'guardian')`, [w.parentC, w.alice]);
    expect(await scalar<number>(`select count(*)::int from profiles where role = 'parent'`)).toBe(before);
    expect((await as(db, user(w.parentC), `select id from profiles where role = 'student'`)).length).toBe(2);
    await sql(db, `delete from parent_student_links where parent_id = $1 and student_id = $2`, [w.parentC, w.alice]);
  });
});

describe('invoices and the payments ledger', () => {
  let invoice: string;
  const owner = () => user(w.owner);
  const state = async (id = invoice) => {
    const r = (await sql<{ status: string; total_minor: unknown; paid_minor: unknown }>(db, `select status, total_minor, paid_minor from invoices where id = $1`, [id]))[0]!;
    return { status: r.status, total: Number(r.total_minor), paid: Number(r.paid_minor) };
  };

  beforeAll(async () => {
    invoice = (await as<{ id: string }>(db, owner(), `insert into invoices (number, student_id, period_start, period_end, currency, due_date) values (next_invoice_number(), $1, '2026-03-01', '2026-03-31', 'NGN', current_date + 7) returning id`, [w.alice]))[0]!.id;
    await as(db, owner(), `insert into invoice_items (invoice_id, description, quantity, unit_minor, amount_minor) values ($1, 'Lessons', 4, 250000, 1000000), ($1, 'Discount', 1, -100000, -100000)`, [invoice]);
  });

  it('numbers invoices sequentially and derives the total from the line items', async () => {
    expect(await scalar<string>(`select number from invoices where id = $1`, [invoice])).toMatch(/^INV-\d{4}-\d{4}$/);
    expect((await state()).total).toBe(900000);
  });

  it('keeps drafts hidden from the family and refuses payments against them', async () => {
    expect((await as(db, user(w.alice), `select id from invoices where id = $1`, [invoice])).length).toBe(0);
    expect((await as(db, user(w.parentAB), `select id from invoice_items where invoice_id = $1`, [invoice])).length).toBe(0);
    expect(await refused(db, owner(), `select credit_payment($1, 1000, 'NGN', 'cash', 'DRAFT-PAY')`, [invoice])).toMatch(/draft invoice/);
  });

  it('locks amounts once issued', async () => {
    await as(db, owner(), `update invoices set status = 'unpaid', issued_at = now() where id = $1`, [invoice]);
    expect((await as(db, user(w.alice), `select id from invoices where id = $1`, [invoice])).length).toBe(1);
    expect(await refused(db, owner(), `insert into invoice_items (invoice_id, description, quantity, unit_minor, amount_minor) values ($1, 'Late extra', 1, 5, 5)`, [invoice])).toMatch(/only be changed while the invoice is a draft/);
    expect(await refused(db, owner(), `delete from invoice_items where invoice_id = $1`, [invoice])).toMatch(/only be changed while the invoice is a draft/);
    expect(await refused(db, owner(), `update invoices set total_minor = 1 where id = $1`, [invoice])).toMatch(/total of an issued invoice cannot change/);
    expect(await refused(db, owner(), `update invoices set student_id = $2 where id = $1`, [invoice, w.bob])).toMatch(/cannot be altered/);
    expect(await refused(db, owner(), `update invoices set status = 'draft' where id = $1`, [invoice])).toMatch(/cannot return to draft/);
    expect(await refused(db, owner(), `delete from invoices where id = $1`, [invoice])).toMatch(/kept for audit/);
  });

  it('a family member cannot forge, alter or delete a payment, or mark an invoice paid', async () => {
    for (const who of [user(w.alice), user(w.parentAB)]) {
      expect(await refused(db, who, `insert into payments (invoice_id, amount_minor, currency, method, reference) values ($1, 900000, 'NGN', 'cash', 'FORGED')`, [invoice])).toMatch(/row-level security/);
      expect(await refused(db, who, `select credit_payment($1, 900000, 'NGN', 'cash', 'FORGED-RPC')`, [invoice])).toMatch(/not authorised/);
      await as(db, who, `update invoices set status = 'paid', paid_minor = 900000 where id = $1`, [invoice]);
    }
    expect(await state()).toMatchObject({ status: 'unpaid', paid: 0 });
    expect(await scalar<number>(`select count(*)::int from payments where invoice_id = $1`, [invoice])).toBe(0);
  });

  it('records a manual part-payment with who entered it, and an audit entry', async () => {
    const credited = (await as<{ ok: boolean }>(db, owner(), `select credit_payment($1, 400000, 'NGN', 'bank_transfer', 'MAN-1', now(), 'first half') as ok`, [invoice]))[0]!.ok;
    expect(credited).toBe(true);
    expect(await state()).toMatchObject({ status: 'partially_paid', paid: 400000 });
    expect(await scalar<string>(`select recorded_by from payments where reference = 'MAN-1'`)).toBe(w.owner);
    expect(await scalar<number>(`select count(*)::int from audit_log where action = 'payment.recorded' and entity_id = $1`, [invoice])).toBe(1);
    // The family can see the receipt and is notified.
    expect((await as(db, user(w.parentAB), `select reference from payments where invoice_id = $1`, [invoice])).length).toBe(1);
    expect(await scalar<number>(`select count(*)::int from notifications where user_id = $1 and title = 'Payment received'`, [w.alice])).toBe(1);
  });

  it('credits a gateway payment exactly once, however many times the webhook is delivered', async () => {
    // Only the server (service role) may record a gateway payment.
    expect(await refused(db, owner(), `select credit_payment($1, 500000, 'NGN', 'paystack', 'TA-GATEWAY-REF')`, [invoice])).toMatch(/recorded by the server only/);
    const deliver = async () => (await as<{ ok: boolean }>(db, SERVICE, `select credit_payment($1, 500000, 'NGN', 'paystack', 'TA-GATEWAY-REF') as ok`, [invoice]))[0]!.ok;
    expect(await deliver()).toBe(true);
    expect(await deliver()).toBe(false); // duplicate delivery
    expect(await deliver()).toBe(false); // and again
    expect(await scalar<number>(`select count(*)::int from payments where reference = 'TA-GATEWAY-REF'`)).toBe(1);
    expect(await state()).toMatchObject({ status: 'paid', paid: 900000 });
  });

  it('refuses a payment in the wrong currency or for an unknown invoice', async () => {
    expect(await refused(db, SERVICE, `select credit_payment($1, 100, 'USD', 'paystack', 'WRONG-CCY')`, [invoice])).toMatch(/currency mismatch/);
    expect(await refused(db, SERVICE, `select credit_payment(gen_random_uuid(), 100, 'NGN', 'paystack', 'NO-INVOICE')`)).toMatch(/invoice not found/);
  });

  it('keeps the ledger append-only, even for the Owner and the server', async () => {
    // The Owner has no policy allowing edits, so a direct attempt changes nothing…
    await as(db, owner(), `update payments set amount_minor = 1 where reference = 'MAN-1'`);
    await as(db, owner(), `delete from payments where reference = 'MAN-1'`);
    // …and even the server, which bypasses RLS, is stopped by the trigger.
    for (const stmt of [`update payments set amount_minor = 1 where reference = 'MAN-1'`, `delete from payments where reference = 'MAN-1'`]) {
      expect(await refused(db, SERVICE, stmt)).toMatch(/append-only/);
    }
    expect(Number(await scalar(`select amount_minor from payments where reference = 'MAN-1'`))).toBe(400000);
  });

  it('corrects mistakes with an adjustment row instead of an edit', async () => {
    await as(db, owner(), `select credit_payment($1, -100000, 'NGN', 'adjustment', 'ADJ-1', now(), 'transfer was 3,000 not 4,000')`, [invoice]);
    expect(await state()).toMatchObject({ status: 'partially_paid', paid: 800000 });
    expect(await scalar<number>(`select count(*)::int from payments where invoice_id = $1`, [invoice])).toBe(3);
  });

  it('cannot cancel an invoice that has payments, or reopen a cancelled one', async () => {
    expect(await refused(db, owner(), `update invoices set status = 'cancelled' where id = $1`, [invoice])).toMatch(/with payments cannot be cancelled/);
    const other = (await as<{ id: string }>(db, owner(), `insert into invoices (number, student_id, period_start, period_end, currency, due_date, status) values (next_invoice_number(), $1, '2026-04-01', '2026-04-30', 'NGN', current_date, 'draft') returning id`, [w.bob]))[0]!.id;
    await as(db, owner(), `insert into invoice_items (invoice_id, description, quantity, unit_minor, amount_minor) values ($1, 'Tuition', 1, 100, 100)`, [other]);
    await as(db, owner(), `update invoices set status = 'unpaid' where id = $1`, [other]);
    await as(db, owner(), `update invoices set status = 'cancelled' where id = $1`, [other]);
    expect(await refused(db, owner(), `update invoices set status = 'unpaid' where id = $1`, [other])).toMatch(/cannot be reopened/);
    expect(await refused(db, owner(), `select credit_payment($1, 100, 'NGN', 'cash', 'ON-CANCELLED')`, [other])).toMatch(/cancelled invoice/);
  });

  it('allows only one tuition invoice per student per period (scheduled-job idempotency)', async () => {
    const insert = `insert into invoices (number, student_id, kind, period_start, period_end, currency) values (next_invoice_number(), $1, 'tuition', '2026-05-01', '2026-05-31', 'NGN')`;
    await as(db, SERVICE, insert, [w.cara]);
    expect(await refused(db, SERVICE, insert, [w.cara])).toMatch(/invoices_period_key/);
    await as(db, SERVICE, insert, [w.bob]); // a different student is fine
    // A cancelled invoice frees the period so a corrected one can be raised.
    await sql(db, `delete from invoices where student_id = $1 and period_start = '2026-05-01'`, [w.cara]);
    await as(db, SERVICE, insert, [w.cara]);
  });

  it('a student with financial history cannot be hard-deleted', async () => {
    await expect(sql(db, `delete from profiles where id = $1`, [w.alice])).rejects.toThrow(/foreign key|violates/);
  });
});

describe('assignments and quizzes', () => {
  let quiz: string;
  let written: string;
  const q: string[] = [];
  const owner = () => user(w.owner);

  beforeAll(async () => {
    quiz = (await as<{ id: string }>(db, owner(), `insert into assignments (title, kind, max_marks, published, allow_resubmission) values ('Algebra quiz', 'quiz', 10, true, false) returning id`))[0]!.id;
    written = (await as<{ id: string }>(db, owner(), `insert into assignments (title, kind, max_marks, published, allow_resubmission) values ('Essay', 'written', 20, true, true) returning id`))[0]!.id;
    for (const a of [quiz, written]) await as(db, owner(), `insert into assignment_students (assignment_id, student_id) values ($1, $2)`, [a, w.alice]);
    for (const [i, correct] of [1, 0, 2, 3].entries()) {
      q.push((await as<{ id: string }>(db, owner(), `insert into quiz_questions (assignment_id, position, prompt, options, correct_index, marks) values ($1, $2, $3, '["a","b","c","d"]', $4, 1) returning id`, [quiz, i + 1, `Question ${i + 1}`, correct]))[0]!.id);
    }
  });

  it('never sends correct answers to a student', async () => {
    expect((await as(db, user(w.alice), `select * from quiz_questions`)).length).toBe(0);
    const questions = await as<Record<string, unknown>>(db, user(w.alice), `select * from get_quiz_questions($1)`, [quiz]);
    expect(questions.length).toBe(4);
    expect(Object.keys(questions[0]!).sort()).toEqual(['id', 'marks', 'options', 'prompt', 'question_position']);
    expect(JSON.stringify(questions)).not.toContain('correct');
  });

  it('refuses a student who was not set the quiz, and unpublished work', async () => {
    expect(await refused(db, user(w.bob), `select * from get_quiz_questions($1)`, [quiz])).toMatch(/not authorised/);
    expect(await refused(db, user(w.bob), `select submit_quiz($1, '{}')`, [quiz])).toMatch(/not authorised/);
    expect(await refused(db, user(w.parentAB), `select submit_quiz($1, '{}')`, [quiz])).toMatch(/not authorised/);
    await as(db, owner(), `update assignments set published = false where id = $1`, [quiz]);
    expect((await as(db, user(w.alice), `select id from assignments where id = $1`, [quiz])).length).toBe(0);
    expect(await refused(db, user(w.alice), `select start_quiz($1)`, [quiz])).toMatch(/not authorised/);
    await as(db, owner(), `update assignments set published = true where id = $1`, [quiz]);
  });

  it('marks a quiz in the database, records the server-side start time, and stores the attempt', async () => {
    const started = (await as<{ t: string }>(db, user(w.alice), `select start_quiz($1) as t`, [quiz]))[0]!.t;
    // Asking again does not reset the clock.
    expect((await as<{ t: string }>(db, user(w.alice), `select start_quiz($1) as t`, [quiz]))[0]!.t).toEqual(started);
    const answers = JSON.stringify({ [q[0]!]: 1, [q[1]!]: 0, [q[2]!]: 0, [q[3]!]: 'not-a-number' }); // 2 of 4 correct
    const id = (await as<{ id: string }>(db, user(w.alice), `select submit_quiz($1, $2::jsonb, '1999-01-01') as id`, [quiz, answers]))[0]!.id;
    const sub = (await sql<Record<string, string>>(db, `select score, auto_score, status, attempt, started_at from submissions where id = $1`, [id]))[0]!;
    expect(sub).toMatchObject({ score: '5.00', auto_score: '5.00', status: 'graded', attempt: 1 });
    // The start time supplied by the browser (1999) is ignored in favour of the recorded one.
    expect(new Date(sub.started_at!).getFullYear()).toBe(new Date().getFullYear());
  });

  it('blocks a second attempt unless resubmission is allowed', async () => {
    expect(await refused(db, user(w.alice), `select submit_quiz($1, '{}')`, [quiz])).toMatch(/already been submitted/);
    expect(await refused(db, user(w.alice), `select start_quiz($1)`, [quiz])).toMatch(/already been submitted/);
    await as(db, owner(), `update assignments set allow_resubmission = true where id = $1`, [quiz]);
    await as(db, user(w.alice), `select submit_quiz($1, $2::jsonb)`, [quiz, JSON.stringify({ [q[0]!]: 1, [q[1]!]: 0, [q[2]!]: 2, [q[3]!]: 3 })]);
    const attempts = await sql<{ attempt: number; score: string }>(db, `select attempt, score from submissions where assignment_id = $1 order by attempt`, [quiz]);
    expect(attempts).toEqual([{ attempt: 1, score: '5.00' }, { attempt: 2, score: '10.00' }]); // history kept
  });

  it('accepts written work only from the assigned student, with a file path inside their own folder', async () => {
    expect(await refused(db, user(w.alice), `select submit_written($1, '', null)`, [written])).toMatch(/nothing to submit/);
    expect(await refused(db, user(w.alice), `select submit_written($1, 'x', $2)`, [written, `${w.bob}/${written}/steal.pdf`])).toMatch(/invalid file path/);
    expect(await refused(db, user(w.bob), `select submit_written($1, 'not mine', null)`, [written])).toMatch(/not authorised/);
    expect(await refused(db, user(w.alice), `select submit_written($1, 'wrong kind', null)`, [quiz])).toMatch(/not a written assignment/);
    const id = (await as<{ id: string }>(db, user(w.alice), `select submit_written($1, 'My essay', $2) as id`, [written, `${w.alice}/${written}/essay.pdf`]))[0]!.id;
    expect((await sql<Record<string, unknown>>(db, `select status, score, attempt from submissions where id = $1`, [id]))[0]).toEqual({ status: 'submitted', score: null, attempt: 1 });
    expect(await scalar<number>(`select count(*)::int from notifications where user_id = $1 and title = 'Work submitted'`, [w.owner])).toBeGreaterThan(0);
    // Students cannot insert a submission directly (which could carry a score).
    expect(await refused(db, user(w.alice), `insert into submissions (assignment_id, student_id, attempt, score, status) values ($1, $2, 9, 20, 'graded')`, [written, w.alice])).toMatch(/row-level security/);
  });

  it('notifies the family when the Owner marks the work', async () => {
    await as(db, owner(), `update submissions set score = 17, feedback = 'Good structure', status = 'graded', graded_at = now() where assignment_id = $1 and student_id = $2`, [written, w.alice]);
    expect(await scalar<number>(`select count(*)::int from notifications where title = 'Work marked' and user_id = $1`, [w.alice])).toBe(1);
    expect(await scalar<number>(`select count(*)::int from notifications where title = 'Work marked' and user_id = $1`, [w.parentAB])).toBe(1);
    expect(await scalar<string>(`select href from notifications where title = 'Work marked' and user_id = $1`, [w.parentAB])).toBe('/parent/assignments');
    expect((await as<{ feedback: string }>(db, user(w.parentAB), `select feedback from submissions where assignment_id = $1`, [written]))[0]!.feedback).toBe('Good structure');
  });
});

describe('scheduling and attendance', () => {
  it('prevents an accidental duplicate session and one register row per student', async () => {
    const owner = user(w.owner);
    const insert = `insert into classes (title, starts_at, duration_minutes, delivery) values ('SS1 Maths', '2026-06-01T15:00:00Z', 60, 'online') returning id`;
    const cls = (await as<{ id: string }>(db, owner, insert))[0]!.id;
    expect(await refused(db, owner, insert)).toMatch(/classes_no_duplicate/);
    await as(db, owner, `update classes set status = 'cancelled' where id = $1`, [cls]);
    await as(db, owner, insert); // a cancelled session no longer blocks the slot

    await as(db, owner, `insert into attendance (class_id, student_id, status, actual_minutes, billable) values ($1, $2, 'absent', 0, false)`, [cls, w.alice]);
    expect(await refused(db, owner, `insert into attendance (class_id, student_id, status) values ($1, $2, 'present')`, [cls, w.alice])).toMatch(/attendance_class_id_student_id_key/);
    expect(await refused(db, owner, `insert into attendance (class_id, student_id, status) values ($1, $2, 'asleep')`, [cls, w.bob])).toMatch(/check constraint/);
  });
});

describe('rate limiting and audit', () => {
  it('allows up to the limit in a window, then refuses', async () => {
    const hit = async () => (await as<{ ok: boolean }>(db, SERVICE, `select check_rate_limit('login:test', 3, 3600) as ok`))[0]!.ok;
    expect([await hit(), await hit(), await hit(), await hit(), await hit()]).toEqual([true, true, true, false, false]);
  });

  it('keeps the audit log permanent', async () => {
    await as(db, user(w.owner), `select write_audit('test.action', 'thing', 'abc', '{"k": 1}')`);
    for (const who of [user(w.owner), SERVICE]) {
      expect(await refused(db, who, `delete from audit_log where action = 'test.action'`).catch(() => 'row-level security')).toMatch(/cannot be changed|row-level security|permission denied/);
    }
    expect(await refused(db, SERVICE, `update audit_log set action = 'x'`)).toMatch(/cannot be changed/);
    expect(await scalar<number>(`select count(*)::int from audit_log where action = 'test.action'`)).toBe(1);
  });
});
