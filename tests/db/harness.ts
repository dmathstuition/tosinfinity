import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

/**
 * Runs the project's real migrations in an in-process Postgres (PGlite), with a small
 * stand-in for the parts Supabase provides: the anon / authenticated / service_role
 * roles, auth.users, auth.uid(), auth.role() and the storage schema.
 * Requests are simulated the way PostgREST does it: SET ROLE plus JWT claim settings.
 */
const SUPABASE_SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1] $$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');

export function migrationFiles(): string[] {
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

export async function createDatabase(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_SHIM);
  await applyMigrations(db);
  return db;
}

export async function applyMigrations(db: PGlite): Promise<void> {
  for (const file of migrationFiles()) {
    try {
      await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }
}

export type Who = { role: 'anon' | 'authenticated' | 'service_role'; uid?: string };
export const ANON: Who = { role: 'anon' };
export const SERVICE: Who = { role: 'service_role' };
export const user = (uid: string): Who => ({ role: 'authenticated', uid });

/** Run SQL as a given requester. Always resets to the superuser afterwards. */
export async function as<T = Record<string, unknown>>(db: PGlite, who: Who, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`
    select set_config('request.jwt.claim.sub', '${who.uid ?? ''}', false);
    select set_config('request.jwt.claim.role', '${who.role}', false);
    set role ${who.role};
  `);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false);`);
  }
}

/** Expect the statement to be refused; returns the database's error message. */
export async function refused(db: PGlite, who: Who, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await as(db, who, sql, params);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error(`Expected the database to refuse: ${sql}`);
}

export async function sql<T = Record<string, unknown>>(db: PGlite, text: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(text, params)).rows;
}

/** Create a login in auth.users (what the admin API does) and return its id. */
export async function authUser(db: PGlite, email: string): Promise<string> {
  const rows = await sql<{ id: string }>(db, 'insert into auth.users (email) values ($1) returning id', [email]);
  return rows[0]!.id;
}

export type World = { owner: string; alice: string; bob: string; cara: string; parentAB: string; parentC: string; stranger: string };

/**
 * A small academy: one Owner; students Alice, Bob and Cara; a parent linked to Alice
 * and Bob (two children); another parent linked to Cara; and a signed-in stranger
 * with no profile at all.
 */
export async function seedWorld(db: PGlite): Promise<World> {
  const owner = await authUser(db, 'owner@example.test');
  await sql(db, `insert into public.profiles (id, role, full_name, email) values ($1, 'owner', 'Owner', 'owner@example.test')`, [owner]);
  const mk = async (name: string) => {
    const id = await authUser(db, `${name.toLowerCase()}@example.test`);
    await as(db, user(owner), `select public.create_student_profile($1, $2, $3)`, [id, `${name.toLowerCase()}@example.test`, JSON.stringify({ full_name: name })]);
    return id;
  };
  const alice = await mk('Alice');
  const bob = await mk('Bob');
  const cara = await mk('Cara');
  const parentAB = await authUser(db, 'parent.ab@example.test');
  const parentC = await authUser(db, 'parent.c@example.test');
  const link = (parent: string, student: string, email: string) =>
    as(db, user(owner), `select public.link_parent($1, $2, 'A Parent', $3, '', 'parent')`, [parent, student, email]);
  await link(parentAB, alice, 'parent.ab@example.test');
  await link(parentAB, bob, 'parent.ab@example.test');
  await link(parentC, cara, 'parent.c@example.test');
  const stranger = await authUser(db, 'stranger@example.test');
  return { owner, alice, bob, cara, parentAB, parentC, stranger };
}
