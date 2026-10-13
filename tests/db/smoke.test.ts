import { describe, expect, it } from 'vitest';
import { applyMigrations, createDatabase, migrationFiles, sql } from './harness';

describe('migrations', () => {
  it('apply cleanly, enable RLS everywhere, and can be re-run (idempotent)', async () => {
    const db = await createDatabase();
    const withoutRls = async () =>
      (await sql<{ tablename: string }>(db, `select tablename from pg_tables where schemaname = 'public' and not rowsecurity`)).map((t) => t.tablename);

    expect(migrationFiles().length).toBeGreaterThanOrEqual(7);
    // After a single run, every table in the exposed schema has Row Level Security on.
    expect(await withoutRls()).toEqual([]);

    await applyMigrations(db); // second run must not error or duplicate anything
    expect(await withoutRls()).toEqual([]);
    const count = async (table: string) => (await sql<{ n: number }>(db, `select count(*)::int as n from public.${table}`))[0]!.n;
    expect(await count('programmes')).toBe(12);
    expect(await count('settings')).toBeGreaterThanOrEqual(8);
  });

  it('seeds the flyer contact numbers and no invented email, prices or testimonials', async () => {
    const db = await createDatabase();
    const get = async (key: string) => (await sql<{ value: any }>(db, 'select value from public.settings where key = $1', [key]))[0]!.value;
    const academy = await get('academy');
    expect(academy.phones).toEqual(['07015879377', '09031521922']);
    expect(academy.email).toBe('');
    expect((await get('pricing')).plans).toEqual([]);
    expect(await get('testimonials')).toEqual([]);
  });
});
