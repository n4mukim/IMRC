import { describe, it, expect, beforeEach } from 'vitest'
import { freshDb, mkUser, as, q, draft, type Db } from './helpers/db'

let db: Db
let author: string, trusted: string, revA: string, revB: string, admin: string
beforeEach(async () => {
  db = await freshDb()
  revA = await mkUser(db, 'reviewer_a', 'reviewer')
  revB = await mkUser(db, 'reviewer_b', 'reviewer')
  admin = await mkUser(db, 'admin', 'admin')
  author = await mkUser(db, 'author', 'author')
  trusted = await mkUser(db, 'trusted', 'trusted_author')
  await q(db, `delete from public.notifications`)
})
const rpc = (u: string | null, sql: string, p: unknown[] = []) => as(db, u, () => q(db, sql, p))
const notes = (tpl: string) => q(db, `select to_email, payload from public.notifications where template = $1 order by id`, [tpl])
const submit = async (who: string, slug: string) => { const id = await draft(db, who, slug, `Title of ${slug}`); await rpc(who, `select public.submit_post($1)`, [id]); return id }

describe('notifications to reviewers', () => {
  it('a new post pending review e-mails every other reviewer/admin, never the author', async () => {
    const id = await submit(author, 'p1')
    const n = await notes('post_pending')
    expect(n.map((x: any) => x.to_email).sort()).toEqual(['admin@example.org', 'reviewer_a@example.org', 'reviewer_b@example.org'])
    expect(n[0].payload).toMatchObject({ post_id: id, title: 'Title of p1', author_name: 'author' })
  })
  it('a reviewer’s own post does not notify themselves, only the others', async () => {
    await submit(revA, 'own')
    expect((await notes('post_pending')).map((x: any) => x.to_email).sort()).toEqual(['admin@example.org', 'reviewer_b@example.org'])
  })
  it('a trusted author publishing at once notifies reviewers so they can spot-check', async () => {
    await submit(trusted, 'trusted-post')
    expect((await notes('post_auto_published')).map((x: any) => x.to_email).sort()).toEqual(['admin@example.org', 'reviewer_a@example.org', 'reviewer_b@example.org'])
    expect(await notes('post_pending')).toHaveLength(0)
  })
  it('a trusted author editing a live post also notifies (edit = true)', async () => {
    const id = await submit(trusted, 'tp'); await q(db, `delete from public.notifications`)
    await rpc(trusted, `select public.edit_published_post($1,'T2',null,'<p>x</p>',null,'{}')`, [id])
    expect((await notes('post_auto_published'))[0].payload.edit).toBe(true)
  })
  it('an author’s edit to a live post notifies reviewers as revision_pending', async () => {
    const id = await submit(author, 'ap'); await rpc(revA, `select public.review_post($1,'approve')`, [id]); await q(db, `delete from public.notifications`)
    await rpc(author, `select public.edit_published_post($1,'New',null,'<p>n</p>',null,'{}')`, [id])
    expect(await notes('revision_pending')).toHaveLength(3)
  })
  it('deactivated reviewers are not e-mailed', async () => {
    await rpc(admin, `select public.set_user_active($1,false)`, [revB])
    await submit(author, 'p2')
    expect((await notes('post_pending')).map((x: any) => x.to_email).sort()).toEqual(['admin@example.org', 'reviewer_a@example.org'])
  })
})

describe('notifications to authors carry the reviewer’s note', () => {
  it.each([
    ['approve', 'post_approved', 'Lovely piece'],
    ['request_changes', 'post_changes_requested', 'Please cite a source'],
    ['reject', 'post_rejected', 'Contains a testimonial'],
  ])('%s → %s', async (action, tpl, note) => {
    const id = await submit(author, `p-${action.replace('_', '-')}`)
    await rpc(revA, `select public.review_post($1, $2::public.review_action, $3)`, [id, action, note])
    const n = await notes(tpl)
    expect(n).toHaveLength(1)
    expect(n[0].to_email).toBe('author@example.org')
    expect(n[0].payload.note).toBe(note)
    expect(n[0].payload.title).toMatch(/^Title of p-/)
  })
  it('unpublish e-mails the author with the note', async () => {
    const id = await submit(trusted, 'live'); await q(db, `delete from public.notifications`)
    await rpc(revA, `select public.review_post($1,'unpublish','Policy breach')`, [id])
    expect((await notes('post_unpublished'))[0].payload.note).toBe('Policy breach')
  })
  it('approving without a note is fine and sends note = null', async () => {
    const id = await submit(author, 'q'); await rpc(revA, `select public.review_post($1,'approve')`, [id])
    expect((await notes('post_approved'))[0].payload.note).toBeNull()
  })
  it('revision decisions e-mail the author', async () => {
    const id = await submit(author, 'r'); await rpc(revA, `select public.review_post($1,'approve')`, [id])
    const rid = (await rpc(author, `select public.edit_published_post($1,'New',null,'<p>n</p>',null,'{}') as r`, [id]))[0].r
    await rpc(revB, `select public.review_revision($1,'request_changes','Add a source')`, [rid])
    expect((await notes('revision_changes_requested'))[0].payload.note).toBe('Add a source')
    await rpc(author, `select public.update_my_revision($1,'New v2',null,'<p>v2</p>',null,'{}')`, [rid])
    await rpc(revB, `select public.review_revision($1,'approve')`, [rid])
    expect(await notes('revision_approved')).toHaveLength(1)
  })
  it('the rules are unchanged: a reviewer still cannot review their own post, and non-reviewers still cannot review', async () => {
    const own = await submit(revA, 'own')
    await expect(rpc(revA, `select public.review_post($1,'approve')`, [own])).rejects.toThrow(/own post/)
    const other = await submit(author, 'other')
    await expect(rpc(author, `select public.review_post($1,'approve')`, [other])).rejects.toThrow(/forbidden/)
    expect(await notes('post_approved')).toHaveLength(0)
  })
})

describe('audit log', () => {
  it('staff see every action in order, newest first, with who did what', async () => {
    const id = await submit(author, 'audited')
    await rpc(revA, `select public.review_post($1,'request_changes','Add source')`, [id])
    await rpc(revA, `select public.set_user_role($1,'trusted_author','good')`, [author])
    const rows = await rpc(revB, `select kind, actor_name, subject, action, note from public.audit_log(50)`)
    expect(rows.map((r: any) => `${r.kind}:${r.action}`)).toEqual(['role:role_change · author → trusted_author', 'post:request_changes', 'post:submit'])
    expect(rows[0]).toMatchObject({ actor_name: 'reviewer_a', subject: 'author', note: 'good' })
    expect(rows[1]).toMatchObject({ actor_name: 'reviewer_a', subject: 'Title of audited', note: 'Add source' })
  })
  it('supports paging', async () => {
    for (let i = 0; i < 3; i++) await submit(i === 2 ? trusted : author, `p${i}`)
    expect(await rpc(revA, `select 1 from public.audit_log(2)`)).toHaveLength(2)
    expect((await rpc(revA, `select 1 from public.audit_log(50)`)).length).toBeGreaterThanOrEqual(3)
  })
  it('authors and anonymous visitors cannot read it, and the tables stay write-protected', async () => {
    await submit(author, 'x')
    expect(await rpc(author, `select * from public.audit_log(50)`)).toHaveLength(0)   // is_staff() gate: empty, not an error
    expect(await rpc(trusted, `select * from public.audit_log(50)`)).toHaveLength(0)
    await expect(rpc(null, `select * from public.audit_log(50)`)).rejects.toThrow(/permission denied/)
    await expect(rpc(revA, `update public.post_reviews set note = 'edited'`)).rejects.toThrow(/permission denied/)
    await expect(rpc(revA, `delete from public.role_changes`)).rejects.toThrow(/permission denied/)
  })
})

describe('“Ready for trust”', () => {
  const approved = async (who: string, n: number, slug: string) => { for (let i = 0; i < n; i++) { const id = await submit(who, `${slug}-${i}`); await rpc(revA, `select public.review_post($1,'approve')`, [id]) } }
  it('an author with 3 approved posts and no rejections is a candidate; 2 is not', async () => {
    await approved(author, 3, 'a')
    const two = await mkUser(db, 'two', 'author'); await approved(two, 2, 'b')
    const rows = await rpc(revA, `select display_name, approved_posts from public.trust_candidates()`)
    expect(rows).toEqual([{ display_name: 'author', approved_posts: 3 }])
  })
  it('a recent rejection disqualifies, an old one does not, and changes-requested never counts against', async () => {
    await approved(author, 3, 'a')
    const x = await submit(author, 'bad'); await rpc(revA, `select public.review_post($1,'request_changes','fix')`, [x])
    expect(await rpc(revA, `select 1 from public.trust_candidates()`)).toHaveLength(1)
    const y = await submit(author, 'bad2'); await rpc(revA, `select public.review_post($1,'reject','no')`, [y])
    expect(await rpc(revA, `select 1 from public.trust_candidates()`)).toHaveLength(0)
    await q(db, `update public.post_reviews set created_at = now() - interval '91 days' where action = 'reject'`)
    expect(await rpc(revA, `select 1 from public.trust_candidates()`)).toHaveLength(1)
  })
  it('promotion is one click, logged, and the person stops being a candidate; the thresholds are settings', async () => {
    await approved(author, 3, 'a')
    await rpc(revA, `select public.set_user_role($1,'trusted_author','ready for trust')`, [author])
    expect(await rpc(revA, `select 1 from public.trust_candidates()`)).toHaveLength(0)
    expect((await q(db, `select new_role, note from public.role_changes where user_id = $1`, [author]))[0]).toEqual({ new_role: 'trusted_author', note: 'ready for trust' })
    await q(db, `update public.app_settings set value = 1 where key = 'trust_min_approved_posts'`)
    await rpc(admin, `select public.set_user_role($1,'author')`, [author])
    expect(await rpc(revA, `select 1 from public.trust_candidates()`)).toHaveLength(1)
  })
  it('only staff can ask', async () => {
    expect(await rpc(author, `select * from public.trust_candidates()`)).toHaveLength(0)
    await expect(rpc(null, `select * from public.trust_candidates()`)).rejects.toThrow(/permission denied/)
  })
})
