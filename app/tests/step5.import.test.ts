import { describe, it, expect, beforeEach } from 'vitest'
import { freshDb, mkUser, as, q, type Db } from './helpers/db'

let db: Db, admin: string, author: string
beforeEach(async () => {
  db = await freshDb()
  admin = await mkUser(db, 'admin', 'admin')
  author = await mkUser(db, 'author', 'author')
})
const rpc = (u: string | null, sql: string, p: unknown[] = []) => as(db, u, () => q(db, sql, p))

describe('reserved addresses', () => {
  it.each(['write', 'post', 'join', 'review', 'dashboard', 'feed', 'index'])('"%s" cannot be used as a post address', async (slug) => {
    await expect(rpc(author, `insert into public.posts (author_id, title, slug, body) values ($1,'t',$2,'b')`, [author, slug])).rejects.toThrow(/slug_not_reserved|check constraint/i)
  })
  it('ordinary addresses are fine', async () => {
    expect(await rpc(author, `insert into public.posts (author_id, title, slug, body) values ($1,'t','my-first-post','b') returning id`, [author])).toHaveLength(1)
  })
})

describe('import_article (admin-only, service use)', () => {
  const call = (who: string | null, args = `'Old article','old-article','<p>Body</p>','2024-03-05T10:00:00Z'`) =>
    rpc(who, `select public.import_article($1, ${args}) as id`, [admin])

  it('imports a PUBLISHED post attributed to the admin, keeping the original date, and is public', async () => {
    const owner = await q(db, `select public.import_article($1,'Old article','old-article','<p>Body</p>','2024-03-05T10:00:00Z','https://cdn.test/c.webp','{culture}','A summary') as id`, [admin])
    const row = (await q(db, `select author_id, status, published_at, cover_image_url, tags, excerpt from public.posts where id = $1`, [owner[0].id]))[0]
    expect(row.author_id).toBe(admin)
    expect(row.status).toBe('published')
    expect(new Date(row.published_at).toISOString()).toBe('2024-03-05T10:00:00.000Z')
    expect(row.tags).toEqual(['culture'])
    expect(await rpc(null, `select slug from public.posts`)).toEqual([{ slug: 'old-article' }])
    expect((await q(db, `select action, note from public.post_reviews`))[0]).toEqual({ action: 'auto_publish', note: 'import' })
  })
  it('running it twice does not duplicate', async () => {
    const a = await q(db, `select public.import_article($1,'T','same-slug','<p>b</p>',now()) as id`, [admin])
    const b = await q(db, `select public.import_article($1,'T','same-slug','<p>b</p>',now()) as id`, [admin])
    expect(a[0].id).toBe(b[0].id)
    expect((await q(db, `select count(*)::int n from public.posts`))[0].n).toBe(1)
  })
  it('refuses a non-admin owner, unsafe html, and reserved addresses', async () => {
    await expect(q(db, `select public.import_article($1,'T','x','<p>b</p>',now())`, [author])).rejects.toThrow(/active admin/)
    await expect(q(db, `select public.import_article($1,'T','evil','<script>alert(1)</script>',now())`, [admin])).rejects.toThrow(/unsafe_html/)
    await expect(q(db, `select public.import_article($1,'T','write','<p>b</p>',now())`, [admin])).rejects.toThrow(/reserved|check constraint/i)
  })
  it('no browser role can call it, even an admin', async () => {
    for (const u of [null, author, admin]) await expect(call(u)).rejects.toThrow(/permission denied/i)
  })
})
