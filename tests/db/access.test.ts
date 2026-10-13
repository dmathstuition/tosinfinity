import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { ANON, as, authUser, createDatabase, refused, seedWorld, SERVICE, sql, user, type World } from './harness';

/**
 * Access boundaries between the Owner, students, parents, signed-in strangers and the
 * public. Every query here runs as the role and user it names, through the same RLS
 * policies the live site uses.
 */
let db: PGlite;
let w: World;
const ids: Record<string, string> = {};

beforeAll(async () => {
  db = await createDatabase();
  w = await seedWorld(db);
  const owner = user(w.owner);
  const one = async (q: string, p: unknown[] = []) => (await as<{ id: string }>(db, owner, q, p))[0]!.id;

  // One class, register entry, graded piece of work, report and invoice per student.
  for (const [name, sid] of [['alice', w.alice], ['bob', w.bob], ['cara', w.cara]] as const) {
    const cls = await one(`insert into classes (title, starts_at, duration_minutes, delivery, venue) values ($1, now() + interval '1 day', 60, 'home', $2) returning id`, [`${name} class`, `${name} home address`]);
    await as(db, owner, `insert into class_students (class_id, student_id) values ($1, $2)`, [cls, sid]);
    await as(db, owner, `insert into attendance (class_id, student_id, status, actual_minutes, billable) values ($1, $2, 'present', 60, true)`, [cls, sid]);
    const asg = await one(`insert into assignments (title, kind, published) values ($1, 'written', true) returning id`, [`${name} homework`]);
    await as(db, owner, `insert into assignment_students (assignment_id, student_id) values ($1, $2)`, [asg, sid]);
    await as(db, owner, `insert into submissions (assignment_id, student_id, body, score, status) values ($1, $2, 'my answer', 80, 'graded')`, [asg, sid]);
    await as(db, owner, `insert into reports (student_id, period_start, period_end, status) values ($1, '2026-01-01', '2026-01-31', 'published')`, [sid]);
    await as(db, owner, `insert into reports (student_id, period_start, period_end, status) values ($1, '2026-02-01', '2026-02-28', 'draft')`, [sid]);
    const inv = await one(`insert into invoices (number, student_id, period_start, period_end, currency, status, due_date) values ($1, $2, '2026-01-01', '2026-01-31', 'NGN', 'draft', '2026-02-07') returning id`, [`INV-T-${name}`, sid]);
    await as(db, owner, `insert into invoice_items (invoice_id, description, quantity, unit_minor, amount_minor) values ($1, 'Tuition', 1, 500000, 500000)`, [inv]);
    await as(db, owner, `update invoices set status = 'unpaid', issued_at = now() where id = $1`, [inv]);
    await as(db, owner, `insert into student_notes (student_id, body) values ($1, 'private teaching note')`, [sid]);
    ids[`${name}Class`] = cls;
    ids[`${name}Assignment`] = asg;
    ids[`${name}Invoice`] = inv;
  }
});

const count = async (who: Parameters<typeof as>[1], table: string, where = 'true') =>
  (await as<{ n: number }>(db, who, `select count(*)::int as n from ${table} where ${where}`))[0]!.n;

describe('students', () => {
  it('see their own records and nobody else’s', async () => {
    const alice = user(w.alice);
    for (const table of ['attendance', 'submissions', 'reports', 'invoices', 'class_students', 'assignment_students']) {
      expect(await count(alice, table, `student_id = '${w.alice}'`), table).toBeGreaterThan(0);
      expect(await count(alice, table, `student_id <> '${w.alice}'`), table).toBe(0);
    }
    expect(await count(alice, 'classes')).toBe(1);
    expect(await count(alice, 'assignments')).toBe(1);
    expect(await count(alice, 'invoice_items')).toBe(1);
  });

  it('cannot read another student by asking for their ID directly', async () => {
    const alice = user(w.alice);
    expect(await as(db, alice, `select id from profiles where id = $1`, [w.bob])).toEqual([]);
    expect(await as(db, alice, `select id from invoices where id = $1`, [ids.bobInvoice])).toEqual([]);
    expect(await as(db, alice, `select id from classes where id = $1`, [ids.bobClass])).toEqual([]);
    expect(await as(db, alice, `select id from assignments where id = $1`, [ids.bobAssignment])).toEqual([]);
  });

  it('never see draft reports, draft invoices, private notes or applications', async () => {
    const alice = user(w.alice);
    expect(await count(alice, 'reports', `status = 'draft'`)).toBe(0);
    expect(await count(alice, 'student_notes')).toBe(0);
    expect(await count(alice, 'applications')).toBe(0);
    expect(await count(alice, 'audit_log')).toBe(0);
    expect(await count(alice, 'blog_subscribers')).toBe(0);
  });

  it('cannot change their own role, billing or marks', async () => {
    const alice = user(w.alice);
    await as(db, alice, `update profiles set role = 'owner', hourly_rate_minor = 1 where id = $1`, [w.alice]);
    await as(db, alice, `update submissions set score = 100 where student_id = $1`, [w.alice]);
    const p = await sql<{ role: string; hourly_rate_minor: number | null }>(db, `select role, hourly_rate_minor from profiles where id = $1`, [w.alice]);
    expect(p[0]).toEqual({ role: 'student', hourly_rate_minor: null });
    expect((await sql<{ score: string }>(db, `select score from submissions where student_id = $1`, [w.alice]))[0]!.score).toBe('80.00');
    // Self-service edits are limited to name and phone.
    await as(db, alice, `select update_own_profile('Alice A', '0800')`);
    expect((await sql<{ full_name: string }>(db, `select full_name from profiles where id = $1`, [w.alice]))[0]!.full_name).toBe('Alice A');
  });

  it('cannot insert records for themselves or others', async () => {
    const alice = user(w.alice);
    expect(await refused(db, alice, `insert into attendance (class_id, student_id, status) values ($1, $2, 'present')`, [ids.bobClass, w.alice])).toMatch(/row-level security/);
    expect(await refused(db, alice, `insert into invoices (number, student_id, period_start, period_end, currency) values ('X', $1, '2026-01-01', '2026-01-02', 'NGN')`, [w.alice])).toMatch(/row-level security/);
    expect(await refused(db, alice, `insert into notifications (user_id, title) values ($1, 'spoof')`, [w.bob])).toMatch(/row-level security/);
  });
});

describe('parents', () => {
  it('with two children see both, and only those two', async () => {
    const parent = user(w.parentAB);
    const visible = await as<{ id: string }>(db, parent, `select id from profiles where role = 'student' order by full_name`);
    expect(visible.map((r) => r.id).sort()).toEqual([w.alice, w.bob].sort());
    for (const table of ['attendance', 'submissions', 'invoices']) {
      expect(await count(parent, table, `student_id = '${w.alice}'`), table).toBe(1);
      expect(await count(parent, table, `student_id = '${w.bob}'`), table).toBe(1);
      expect(await count(parent, table, `student_id = '${w.cara}'`), table).toBe(0);
    }
    expect(await count(parent, 'reports')).toBe(2); // published only, one per child
  });

  it('cannot reach an unlinked child by changing the ID in a request', async () => {
    const parent = user(w.parentAB);
    expect(await as(db, parent, `select id from profiles where id = $1`, [w.cara])).toEqual([]);
    expect(await as(db, parent, `select id from invoices where id = $1`, [ids.caraInvoice])).toEqual([]);
    expect(await as(db, parent, `select id from classes where id = $1`, [ids.caraClass])).toEqual([]);
    expect((await as<{ ok: boolean }>(db, parent, `select can_view_student($1) as ok`, [w.cara]))[0]!.ok).toBe(false);
  });

  it('cannot link themselves to a child', async () => {
    const parent = user(w.parentAB);
    expect(await refused(db, parent, `insert into parent_student_links (parent_id, student_id, verified_at) values ($1, $2, now())`, [w.parentAB, w.cara])).toMatch(/row-level security/);
    expect(await refused(db, parent, `select link_parent($1, $2, 'P', 'p@example.test', '', 'parent')`, [w.parentAB, w.cara])).toMatch(/not authorised/);
  });

  it('lose access immediately when the link is unverified or removed', async () => {
    await sql(db, `update parent_student_links set verified_at = null where parent_id = $1 and student_id = $2`, [w.parentAB, w.bob]);
    expect(await count(user(w.parentAB), 'invoices', `student_id = '${w.bob}'`)).toBe(0);
    await sql(db, `update parent_student_links set verified_at = now() where parent_id = $1 and student_id = $2`, [w.parentAB, w.bob]);
    expect(await count(user(w.parentAB), 'invoices', `student_id = '${w.bob}'`)).toBe(1);
  });

  it('cannot see private notes or alter anything', async () => {
    const parent = user(w.parentAB);
    expect(await count(parent, 'student_notes')).toBe(0);
    await as(db, parent, `update attendance set status = 'absent' where student_id = $1`, [w.alice]);
    expect((await sql<{ status: string }>(db, `select status from attendance where student_id = $1`, [w.alice]))[0]!.status).toBe('present');
  });
});

describe('inactive accounts and strangers', () => {
  it('a signed-in user with no profile sees nothing private', async () => {
    const stranger = user(w.stranger);
    for (const table of ['attendance', 'submissions', 'invoices', 'reports', 'classes', 'messages', 'applications', 'student_notes']) {
      expect(await count(stranger, table), table).toBe(0);
    }
  });

  it('a deactivated parent loses access to their children', async () => {
    await sql(db, `update profiles set status = 'inactive' where id = $1`, [w.parentC]);
    expect(await count(user(w.parentC), 'invoices')).toBe(0);
    await sql(db, `update profiles set status = 'active' where id = $1`, [w.parentC]);
    expect(await count(user(w.parentC), 'invoices')).toBe(1);
  });

  it('a second Owner cannot be created', async () => {
    const other = await authUser(db, 'second.owner@example.test');
    await expect(sql(db, `insert into profiles (id, role, full_name, email) values ($1, 'owner', 'Second', 'second.owner@example.test')`, [other])).rejects.toThrow(/profiles_single_owner/);
  });
});

describe('the public (not signed in)', () => {
  it('can read only published public content', async () => {
    await sql(db, `insert into blog_posts (slug, title, status, publish_at) values ('live', 'Live', 'published', now() - interval '1 hour'), ('draft', 'Draft', 'draft', null), ('future', 'Future', 'published', now() + interval '1 day')`);
    await sql(db, `update programmes set is_published = false where slug = 'biology'`);
    expect((await as<{ slug: string }>(db, ANON, `select slug from blog_posts`)).map((r) => r.slug)).toEqual(['live']);
    expect(await count(ANON, 'programmes')).toBe(11);
    expect(await count(ANON, 'settings', `not is_public`)).toBe(0);
    expect(await count(ANON, 'settings')).toBeGreaterThan(0);
    for (const table of ['profiles', 'invoices', 'payments', 'attendance', 'messages', 'notifications', 'audit_log']) {
      expect(await count(ANON, table), table).toBe(0);
    }
  });

  it('can submit an application but can never read applications', async () => {
    await as(db, ANON, `insert into applications (student_name, school_year, guardian_name, guardian_email, guardian_phone, guardian_relationship, delivery, consent_at)
                        values ('New Learner', 'JSS1', 'A Guardian', 'g@example.test', '08000000000', 'mother', 'online', now())`);
    expect(await count(ANON, 'applications')).toBe(0);
    expect((await sql<{ n: number }>(db, `select count(*)::int as n from applications`))[0]!.n).toBe(1);
    // The Owner is notified by the database, not by the browser.
    expect((await sql<{ n: number }>(db, `select count(*)::int as n from notifications where user_id = $1 and title = 'New application'`, [w.owner]))[0]!.n).toBe(1);
  });

  it('cannot submit a pre-approved application or one with internal fields set', async () => {
    const base = `insert into applications (student_name, school_year, guardian_name, guardian_email, guardian_phone, guardian_relationship, delivery, consent_at`;
    const vals = `values ('X', 'JSS1', 'G', 'g@example.test', '08000000000', 'mother', 'online', now()`;
    expect(await refused(db, ANON, `${base}, status) ${vals}, 'approved')`)).toMatch(/row-level security/);
    expect(await refused(db, ANON, `${base}, internal_notes) ${vals}, 'injected')`)).toMatch(/row-level security/);
  });

  it('cannot call privileged database functions', async () => {
    expect(await refused(db, ANON, `select next_student_code()`)).toMatch(/permission denied/);
    expect(await refused(db, ANON, `select email_for_student_code('TA-2026-001')`)).toMatch(/permission denied/);
    expect(await refused(db, ANON, `select auth_user_id_by_email('owner@example.test')`)).toMatch(/permission denied/);
    expect(await refused(db, user(w.alice), `select email_for_student_code('TA-2026-001')`)).toMatch(/permission denied/);
    expect(await refused(db, user(w.alice), `select check_rate_limit('k', 1, 60)`)).toMatch(/permission denied/);
    expect(await refused(db, user(w.alice), `select next_invoice_number()`)).toMatch(/not authorised/);
    expect(await refused(db, user(w.alice), `select write_audit('x', 'y', null)`)).toMatch(/not authorised/);
    expect(await refused(db, user(w.alice), `select owner_notify_family($1, 't', 'b', '/x')`, [w.bob])).toMatch(/not authorised/);
  });

  it('student-ID sign-in lookup works for the server only', async () => {
    const code = (await sql<{ student_code: string }>(db, `select student_code from profiles where id = $1`, [w.alice]))[0]!.student_code;
    expect(code).toMatch(/^TA-\d{4}-\d{3}$/);
    expect((await as<{ email: string }>(db, SERVICE, `select email_for_student_code($1) as email`, [code.toLowerCase()]))[0]!.email).toBe('alice@example.test');
  });
});

describe('messages and notifications', () => {
  it('a family member reads and writes only their own conversation, as themselves', async () => {
    const tA = (await as<{ id: string }>(db, user(w.alice), `insert into message_threads (participant_id) values ($1) returning id`, [w.alice]))[0]!.id;
    const tB = (await as<{ id: string }>(db, user(w.bob), `insert into message_threads (participant_id) values ($1) returning id`, [w.bob]))[0]!.id;
    await as(db, user(w.alice), `insert into messages (thread_id, sender_id, body) values ($1, $2, 'hello from alice')`, [tA, w.alice]);
    await as(db, user(w.owner), `insert into messages (thread_id, sender_id, body) values ($1, $2, 'reply to bob')`, [tB, w.owner]);

    expect(await count(user(w.alice), 'messages')).toBe(1);
    expect(await count(user(w.bob), 'messages')).toBe(1);
    expect(await count(user(w.parentAB), 'messages')).toBe(0); // parents do not see their child’s conversation
    expect(await count(user(w.owner), 'messages')).toBe(2);

    expect(await refused(db, user(w.alice), `insert into messages (thread_id, sender_id, body) values ($1, $2, 'into bob thread')`, [tB, w.alice])).toMatch(/row-level security/);
    expect(await refused(db, user(w.alice), `insert into messages (thread_id, sender_id, body) values ($1, $2, 'impersonating owner')`, [tA, w.owner])).toMatch(/row-level security/);
    expect(await refused(db, user(w.alice), `insert into message_threads (participant_id) values ($1)`, [w.bob])).toMatch(/row-level security/);
    expect(await refused(db, user(w.alice), `select mark_thread_read($1)`, [tB])).toMatch(/not authorised/);

    // Database-raised notifications: the Owner for Alice’s message, Bob for the Owner’s reply.
    expect(await count(user(w.owner), 'notifications', `title = 'New message' and user_id = '${w.owner}'`)).toBe(1);
    expect(await count(user(w.bob), 'notifications', `title = 'New message'`)).toBe(1);
    // The message text is never copied into a notification.
    expect((await sql<{ n: number }>(db, `select count(*)::int as n from notifications where body ilike '%reply to bob%' or body ilike '%hello from alice%'`))[0]!.n).toBe(0);
  });

  it('a user can mark their own notifications read but cannot rewrite or reassign them', async () => {
    const bob = user(w.bob);
    await as(db, bob, `update notifications set read_at = now() where user_id = $1`, [w.bob]);
    expect(await count(bob, 'notifications', 'read_at is null')).toBe(0);
    expect(await refused(db, bob, `update notifications set title = 'changed' where user_id = $1`, [w.bob])).toMatch(/permission denied/);
    expect(await refused(db, bob, `update notifications set user_id = $1`, [w.alice])).toMatch(/permission denied/);
    expect(await count(bob, 'notifications', `user_id <> '${w.bob}'`)).toBe(0);
  });

  it('announcements reach only their audience', async () => {
    const owner = user(w.owner);
    const all = (await as<{ id: string }>(db, owner, `insert into notices (title, body, audience, published_at) values ('Students', 'x', 'all_students', now()) returning id`))[0]!.id;
    const sel = (await as<{ id: string }>(db, owner, `insert into notices (title, body, audience, published_at) values ('Just Cara', 'x', 'selected', now()) returning id`))[0]!.id;
    await as(db, owner, `insert into notice_recipients (notice_id, profile_id) values ($1, $2)`, [sel, w.cara]);
    await as(db, owner, `insert into notices (title, body, audience) values ('Unpublished', 'x', 'everyone')`);
    const titles = async (uid: string) => (await as<{ title: string }>(db, user(uid), `select title from notices order by title`)).map((r) => r.title);
    expect(await titles(w.alice)).toEqual(['Students']);
    expect(await titles(w.cara)).toEqual(['Just Cara', 'Students']);
    expect(await titles(w.parentAB)).toEqual([]);
    expect(all).toBeTruthy();
  });
});

describe('private file storage', () => {
  it('families can read only their own student’s files; uploads are confined to the student’s own assignment folder', async () => {
    await sql(db, `insert into storage.objects (bucket_id, name) values
      ('submissions', $1), ('submissions', $2), ('reports', $3), ('student-documents', $4)`,
      [`${w.alice}/${ids.aliceAssignment}/work.pdf`, `${w.bob}/${ids.bobAssignment}/work.pdf`, `${w.cara}/report.pdf`, `${w.cara}/id.pdf`]);
    const names = async (uid: string) => (await as<{ name: string }>(db, user(uid), `select name from storage.objects order by name`)).map((r) => r.name);

    expect(await names(w.alice)).toEqual([`${w.alice}/${ids.aliceAssignment}/work.pdf`]);
    expect((await names(w.parentAB)).length).toBe(2); // Alice’s and Bob’s submissions
    expect((await names(w.parentC)).length).toBe(2); // Cara’s report and document
    expect(await names(w.stranger)).toEqual([]);
    expect((await as(db, ANON, `select name from storage.objects`)).length).toBe(0);
    expect((await names(w.owner)).length).toBe(4);

    // Allowed: own folder, own published assignment.
    await as(db, user(w.alice), `insert into storage.objects (bucket_id, name) values ('submissions', $1)`, [`${w.alice}/${ids.aliceAssignment}/second.pdf`]);
    // Refused: someone else’s folder, someone else’s assignment, or a different private bucket.
    expect(await refused(db, user(w.alice), `insert into storage.objects (bucket_id, name) values ('submissions', $1)`, [`${w.bob}/${ids.bobAssignment}/x.pdf`])).toMatch(/row-level security/);
    expect(await refused(db, user(w.alice), `insert into storage.objects (bucket_id, name) values ('submissions', $1)`, [`${w.alice}/${ids.bobAssignment}/x.pdf`])).toMatch(/row-level security/);
    expect(await refused(db, user(w.alice), `insert into storage.objects (bucket_id, name) values ('reports', $1)`, [`${w.alice}/fake.pdf`])).toMatch(/row-level security/);
    expect(await refused(db, user(w.parentAB), `insert into storage.objects (bucket_id, name) values ('submissions', $1)`, [`${w.alice}/${ids.aliceAssignment}/p.pdf`])).toMatch(/row-level security/);
  });

  it('private learning materials are visible only to students they are shared with', async () => {
    const owner = user(w.owner);
    const m = (await as<{ id: string }>(db, owner, `insert into materials (title, bucket, path) values ('Worksheet', 'materials', 'ws.pdf') returning id`))[0]!.id;
    await as(db, owner, `insert into materials (title, bucket, path) values ('Public handout', 'handouts', 'h.pdf')`);
    await as(db, owner, `insert into material_students (material_id, student_id) values ($1, $2)`, [m, w.alice]);
    await sql(db, `insert into storage.objects (bucket_id, name) values ('materials', 'ws.pdf')`);
    const titles = async (who: Parameters<typeof as>[1]) => (await as<{ title: string }>(db, who, `select title from materials order by title`)).map((r) => r.title);
    expect(await titles(user(w.alice))).toEqual(['Public handout', 'Worksheet']);
    expect(await titles(user(w.parentAB))).toEqual(['Public handout', 'Worksheet']);
    expect(await titles(user(w.cara))).toEqual(['Public handout']);
    expect(await titles(ANON)).toEqual(['Public handout']);
    const file = async (uid: string) => (await as(db, user(uid), `select 1 from storage.objects where bucket_id = 'materials' and name = 'ws.pdf'`)).length;
    expect(await file(w.alice)).toBe(1);
    expect(await file(w.cara)).toBe(0);
  });
});
