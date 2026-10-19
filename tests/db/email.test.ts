import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';
import { ANON, as, createDatabase, refused, SERVICE, seedWorld, sql, user, type World } from './harness';

/** Email log and email preferences (with the secret-token link). */
let db: PGlite;
let w: World;

beforeAll(async () => {
  db = await createDatabase();
  w = await seedWorld(db);
});

describe('email preferences', () => {
  it('a token from an email link reads (masked) and changes only its own address', async () => {
    const rows = await as<{ token: string }>(db, SERVICE, `insert into email_preferences (email) values ('parent.ab@example.test') returning token`);
    const token = rows[0]!.token;
    const read = await as<Record<string, unknown>>(db, ANON, `select * from get_email_preferences($1)`, [token]);
    expect(read).toEqual([{ email: 'p•••@example.test', reminders: true, updates: true, reports: true }]);

    expect((await as<{ ok: boolean }>(db, ANON, `select set_email_preferences($1, false, true, false) as ok`, [token]))[0]!.ok).toBe(true);
    const row = (await sql<Record<string, boolean>>(db, `select reminders, updates, reports from email_preferences where email = 'parent.ab@example.test'`))[0];
    expect(row).toEqual({ reminders: false, updates: true, reports: false });

    // A made-up token changes nothing and reveals nothing.
    const fake = '00000000-0000-4000-8000-000000000000';
    expect(await as(db, ANON, `select * from get_email_preferences($1)`, [fake])).toEqual([]);
    expect((await as<{ ok: boolean }>(db, ANON, `select set_email_preferences($1, true, true, true) as ok`, [fake]))[0]!.ok).toBe(false);
  });

  it('the table itself is not readable by families or the public', async () => {
    expect(await as(db, ANON, `select * from email_preferences`).catch(() => [])).toEqual([]);
    expect(await as(db, user(w.alice), `select * from email_preferences`)).toEqual([]);
    expect((await as(db, user(w.owner), `select * from email_preferences`)).length).toBeGreaterThan(0);
    // A family member cannot change anyone's row directly (RLS hides every row from them).
    await as(db, user(w.alice), `update email_preferences set reports = true`);
    expect((await sql<{ reports: boolean }>(db, `select reports from email_preferences where email = 'parent.ab@example.test'`))[0]!.reports).toBe(false);
  });

  it('signed-in people manage their own address only', async () => {
    expect(await as(db, user(w.alice), `select * from my_email_preferences()`)).toEqual([{ reminders: true, updates: true, reports: true }]);
    await as(db, user(w.alice), `select set_my_email_preferences(true, false, false)`);
    const row = (await sql<Record<string, boolean>>(db, `select reminders, updates, reports from email_preferences where email = 'alice@example.test'`))[0];
    expect(row).toEqual({ reminders: true, updates: false, reports: false });
    expect(await refused(db, user(w.stranger), `select * from my_email_preferences()`)).toMatch(/not authorised/);
    expect(await refused(db, ANON, `select set_my_email_preferences(true, true, true)`)).toMatch(/permission denied|not authorised/);
  });

  it('account deletion forgets the address', async () => {
    await as(db, SERVICE, `select erase_account($1)`, [w.cara]);
    await sql(db, `insert into email_preferences (email) values ('someone.else@example.test')`);
    expect((await sql(db, `select 1 from email_preferences where email = 'cara@example.test'`)).length).toBe(0);
    // Cara had a row only if one was created; create, then erase Bob to check the delete path.
    await sql(db, `insert into email_preferences (email) values ('bob@example.test')`);
    await as(db, SERVICE, `select erase_account($1)`, [w.bob]);
    expect((await sql(db, `select 1 from email_preferences where email = 'bob@example.test'`)).length).toBe(0);
    expect((await sql(db, `select 1 from email_preferences where email = 'someone.else@example.test'`)).length).toBe(1);
  });
});

describe('email log', () => {
  it('only the Owner can read it, and nobody can write it from the app', async () => {
    await as(db, SERVICE, `insert into email_log (template, category, recipient, status, provider) values ('weeklyReport', 'reports', 'parent.ab@example.test', 'sent', 'relay')`);
    expect((await as(db, user(w.owner), `select * from email_log`)).length).toBe(1);
    expect(await as(db, user(w.alice), `select * from email_log`)).toEqual([]);
    expect(await as(db, user(w.parentAB), `select * from email_log`)).toEqual([]);
    expect(await refused(db, user(w.owner), `insert into email_log (template, category, recipient, status, provider) values ('x', 'essential', 'a@b.c', 'sent', 'x')`)).toMatch(/row-level security/);
  });
});
