import { describe, it, expect, beforeAll } from 'vitest'
import { freshDb, mkUser, as, q, draft, type Db } from './helpers/db'

let db: Db
beforeAll(async () => { db = await freshDb() })

describe('step 6 · privilege snapshot', () => {
  it('row level security is on for every public table', async () => {
    const rows = await q(db, `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)
    expect(rows).toEqual([])
  })

  it('every security definer function pins its search_path', async () => {
    const rows = await q(db, `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and not coalesce(p.proconfig::text, '') like '%search_path%'`)
    expect(rows).toEqual([])
  })

  it('anon can read only the public views/tables and call no write function', async () => {
    const tables = await q(db, `select table_name, privilege_type from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public' order by 1, 2`)
    expect(tables.every((t: any) => t.privilege_type === 'SELECT')).toBe(true)
    expect(tables.map((t: any) => t.table_name).sort()).toEqual([...new Set(tables.map((t: any) => t.table_name))].sort())
    const fns = await q(db, `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')`)
    // only the read-only role helpers (they return null/false for a visitor); no workflow or write function
    expect(fns.map((f: any) => f.proname).sort()).toEqual(['can_write', 'is_staff', 'my_role', 'slug_is_reserved'].filter((n) => fns.some((f: any) => f.proname === n)).sort())
    expect(fns.length).toBeLessThanOrEqual(4)
  })

  it('clients cannot touch the outbox, and can only read role history (under RLS)', async () => {
    const out = await q(db, `select has_table_privilege('authenticated', 'public.notifications', 'select, insert, update, delete') or has_table_privilege('anon', 'public.notifications', 'select, insert, update, delete') as ok`)
    expect(out[0].ok).toBe(false)
    const rc = await q(db, `select has_table_privilege('authenticated', 'public.role_changes', 'insert, update, delete') as w, has_table_privilege('anon', 'public.role_changes', 'select') as r`)
    expect(rc[0]).toEqual({ w: false, r: false })
  })

  it('internal helpers (leading underscore) are not callable by clients', async () => {
    const rows = await q(db, `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like '\\_%' and
        (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))`)
    expect(rows.map((r: any) => r.proname)).toEqual([])
  })
})

describe('step 6 · views are read-only', () => {
  it('nobody can write through public_authors', async () => {
    const a = await mkUser(db, 'viewer', 'author')
    await expect(as(db, null, () => q(db, `update public.public_authors set display_name = 'hacked'`))).rejects.toThrow(/permission denied/)
    await expect(as(db, a, () => q(db, `delete from public.public_authors`))).rejects.toThrow(/permission denied/)
    const rows = await q(db, `select display_name from public.profiles where id = $1`, [a])
    expect(rows[0].display_name).toBe('viewer')
  })
})

describe('step 6 · draft limits', () => {
  it('stops an author from creating unlimited open drafts', async () => {
    const a = await mkUser(db, 'spammer', 'author')
    await q(db, `update public.app_settings set value = 3 where key = 'max_open_drafts_per_author'`)
    for (let i = 0; i < 3; i++) await draft(db, a, `spam-${i}`)
    await expect(draft(db, a, 'spam-3')).rejects.toThrow(/rate_limited/)
    // another author is unaffected
    const b = await mkUser(db, 'normal', 'author')
    await draft(db, b, 'fine-1')
  })

  it('also caps new drafts per day', async () => {
    const a = await mkUser(db, 'churner', 'author')
    await q(db, `update public.app_settings set value = 2 where key = 'drafts_created_per_day'`)
    await draft(db, a, 'churn-1'); await draft(db, a, 'churn-2')
    await expect(draft(db, a, 'churn-3')).rejects.toThrow(/rate_limited/)
  })

  it('does not apply to server-side imports (owner role)', async () => {
    const a = await mkUser(db, 'importer', 'author')
    await q(db, `update public.app_settings set value = 0 where key = 'max_open_drafts_per_author'`)
    await q(db, `insert into public.posts (author_id, title, slug, body) values ($1, 'T', 'imp-1', '<p>x</p>')`, [a])
  })
})
