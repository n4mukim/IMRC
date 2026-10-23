import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Real Postgres (PGlite, WASM) with a small shim of what Supabase provides:
 * the anon / authenticated roles, auth.users, auth.uid(), and Supabase's default table privileges.
 * Migrations are applied exactly as they will be in production.
 */
export async function freshDb() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create schema auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      email_confirmed_at timestamptz,
      raw_user_meta_data jsonb not null default '{}'
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;

    -- Supabase hands out broad default privileges; our migrations must narrow them again.
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `)
  const dir = join(__dirname, '../../supabase/migrations')
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'))
  }
  return db
}

export type Db = Awaited<ReturnType<typeof freshDb>>
export type Role = 'pending' | 'author' | 'trusted_author' | 'reviewer' | 'admin'

/** Create an auth user (the signup trigger makes a PENDING profile), then set the role as the superuser.
 *  By default the e-mail is already verified and the application is complete. */
export async function mkUser(
  db: Db, name: string, role: Role = 'pending', meta: Record<string, string> = {}, opts: { verified?: boolean } = {},
) {
  const email = `${name}@example.org`
  const full = { display_name: name, bio: 'Counsellor', affiliation: 'A clinic', motivation: 'I want to share what I have learned. '.repeat(2), ...meta }
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ($1, ${opts.verified === false ? 'null' : 'now()'}, $2::jsonb) returning id`,
    [email, JSON.stringify(full)],
  )
  const id = rows[0].id
  if (role !== 'pending') {
    await db.query(`update public.profiles set role = $2, application_status = 'approved' where id = $1`, [id, role])
  }
  return id
}

/** Run something as a signed-in client (role "authenticated", JWT sub = userId) or as anon (userId = null). */
export async function as<T>(db: Db, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${userId ?? ''}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

export const q = (db: Db, sql: string, params: unknown[] = []) => db.query<any>(sql, params).then((r) => r.rows)

/** Insert a draft as the given user and return its id. */
export async function draft(db: Db, userId: string, slug: string, title = 'A title') {
  const rows = await as(db, userId, () =>
    q(db, `insert into public.posts (author_id, title, slug, body) values ($1, $2, $3, '<p>Body</p>') returning id`, [userId, title, slug]),
  )
  return rows[0].id as string
}
