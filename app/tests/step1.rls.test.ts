import { describe, it, expect, beforeEach } from 'vitest'
import { freshDb, mkUser, as, q, draft, type Db } from './helpers/db'

let db: Db
let pending: string, author: string, trusted: string, reviewerA: string, reviewerB: string, admin: string

beforeEach(async () => {
  db = await freshDb()
  pending = await mkUser(db, 'pending')
  author = await mkUser(db, 'author', 'author')
  trusted = await mkUser(db, 'trusted', 'trusted_author')
  reviewerA = await mkUser(db, 'reviewer_a', 'reviewer')
  reviewerB = await mkUser(db, 'reviewer_b', 'reviewer')
  admin = await mkUser(db, 'admin', 'admin')
})

const rpc = (user: string | null, sql: string, params: unknown[] = []) => as(db, user, () => q(db, sql, params))
const status = async (postId: string) => (await q(db, `select status from public.posts where id = $1`, [postId]))[0].status

describe('REQUIRED: an author cannot publish directly', () => {
  it('cannot insert a post that is already published', async () => {
    await expect(rpc(author, `insert into public.posts (author_id, title, slug, body, status) values ($1,'t','s','b','published')`, [author])).rejects.toThrow(/permission denied/i)
  })
  it('cannot flip a draft to published with a plain UPDATE', async () => {
    const id = await draft(db, author, 'my-post')
    await expect(rpc(author, `update public.posts set status = 'published' where id = $1`, [id])).rejects.toThrow(/permission denied|forbidden/i)
    expect(await status(id)).toBe('draft')
  })
  it('cannot set published_at or move a post to another author', async () => {
    const id = await draft(db, author, 'my-post')
    await expect(rpc(author, `update public.posts set published_at = now() where id = $1`, [id])).rejects.toThrow(/permission denied|forbidden/i)
    await expect(rpc(author, `update public.posts set author_id = $2 where id = $1`, [id, trusted])).rejects.toThrow(/permission denied|forbidden/i)
  })
  it('submitting sends it to pending_review, never to published', async () => {
    const id = await draft(db, author, 'my-post')
    const r = await rpc(author, `select public.submit_post($1) as s`, [id])
    expect(r[0].s).toBe('pending_review')
    expect(await status(id)).toBe('pending_review')
  })
  it('after submitting, the author can no longer edit the post', async () => {
    const id = await draft(db, author, 'my-post')
    await rpc(author, `select public.submit_post($1)`, [id])
    const r = await rpc(author, `update public.posts set title = 'changed' where id = $1 returning id`, [id])
    expect(r).toHaveLength(0)
  })
})

describe('REQUIRED: a reviewer cannot approve their own post', () => {
  it('reviewer submits → pending_review (not auto-published)', async () => {
    const id = await draft(db, reviewerA, 'reviewer-post')
    const r = await rpc(reviewerA, `select public.submit_post($1) as s`, [id])
    expect(r[0].s).toBe('pending_review')
  })
  it('the same reviewer is refused on approve, request_changes and reject', async () => {
    const id = await draft(db, reviewerA, 'reviewer-post')
    await rpc(reviewerA, `select public.submit_post($1)`, [id])
    for (const action of ['approve', 'request_changes', 'reject']) {
      await expect(rpc(reviewerA, `select public.review_post($1, $2::public.review_action, 'note')`, [id, action])).rejects.toThrow(/own post/i)
    }
    expect(await status(id)).toBe('pending_review')
  })
  it('a DIFFERENT reviewer can approve it, and the audit log records who', async () => {
    const id = await draft(db, reviewerA, 'reviewer-post')
    await rpc(reviewerA, `select public.submit_post($1)`, [id])
    const r = await rpc(reviewerB, `select public.review_post($1, 'approve') as s`, [id])
    expect(r[0].s).toBe('published')
    const log = await q(db, `select reviewer_id, actor_id, action from public.post_reviews where post_id = $1 order by id`, [id])
    expect(log.map((l: any) => l.action)).toEqual(['submit', 'approve'])
    expect(log[1].reviewer_id).toBe(reviewerB)
  })
  it('an admin can approve a reviewer’s post', async () => {
    const id = await draft(db, reviewerA, 'reviewer-post')
    await rpc(reviewerA, `select public.submit_post($1)`, [id])
    expect((await rpc(admin, `select public.review_post($1, 'approve') as s`, [id]))[0].s).toBe('published')
  })
})

describe('REQUIRED: a non-reviewer cannot call approve endpoints', () => {
  it.each([
    ['pending', () => pending],
    ['author', () => author],
    ['trusted_author', () => trusted],
  ])('%s is refused by review_post, review_revision, review_application and set_user_role', async (_n, who) => {
    const u = who()
    const id = await draft(db, author, `p-${String(_n).replace(/_/g, '-')}`)
    await rpc(author, `select public.submit_post($1)`, [id])
    await expect(rpc(u, `select public.review_post($1, 'approve')`, [id])).rejects.toThrow(/forbidden/i)
    await expect(rpc(u, `select public.review_revision(gen_random_uuid(), 'approve')`)).rejects.toThrow(/forbidden/i)
    await expect(rpc(u, `select public.review_application($1, true)`, [pending])).rejects.toThrow(/forbidden/i)
    await expect(rpc(u, `select public.set_user_role($1, 'trusted_author')`, [author])).rejects.toThrow(/forbidden/i)
    await expect(rpc(u, `select public.set_user_active($1, false)`, [author])).rejects.toThrow(/forbidden/i)
    expect(await status(id)).toBe('pending_review')
  })
  it('anonymous visitors cannot call any workflow function', async () => {
    await expect(rpc(null, `select public.review_post(gen_random_uuid(), 'approve')`)).rejects.toThrow(/permission denied/i)
    await expect(rpc(null, `select public.submit_post(gen_random_uuid())`)).rejects.toThrow(/permission denied/i)
    await expect(rpc(null, `select public.review_application(gen_random_uuid(), true)`)).rejects.toThrow(/permission denied/i)
  })
  it('nobody but the database owner can call bootstrap_admin', async () => {
    await expect(rpc(admin, `select public.bootstrap_admin('author@example.org')`)).rejects.toThrow(/permission denied/i)
  })
})

describe('roles cannot be self-assigned', () => {
  it('a user cannot raise their own role or reactivate themselves, but can edit their bio', async () => {
    await expect(rpc(pending, `update public.profiles set role = 'admin' where id = $1`, [pending])).rejects.toThrow(/permission denied|forbidden/i)
    await expect(rpc(pending, `update public.profiles set application_status = 'approved' where id = $1`, [pending])).rejects.toThrow(/permission denied|forbidden/i)
    await expect(rpc(pending, `update public.profiles set active = true where id = $1`, [pending])).rejects.toThrow(/permission denied|forbidden/i)
    const ok = await rpc(pending, `update public.profiles set bio = 'Hello' where id = $1 returning bio`, [pending])
    expect(ok[0].bio).toBe('Hello')
  })
  it('signup metadata can never set a role', async () => {
    const id = await mkUser(db, 'sneaky', 'pending', { role: 'admin' })
    expect((await q(db, `select role from public.profiles where id = $1`, [id]))[0].role).toBe('pending')
  })
  it('a pending account cannot create posts', async () => {
    await expect(rpc(pending, `insert into public.posts (author_id, title, slug, body) values ($1,'t','s','b')`, [pending])).rejects.toThrow(/row-level security/i)
  })
  it('motivation must be 50–500 characters when given', async () => {
    await expect(mkUser(db, 'short', 'pending', { motivation: 'too short' })).rejects.toThrow()
    const ok = await mkUser(db, 'longenough', 'pending', { motivation: 'x'.repeat(60) })
    expect(ok).toBeTruthy()
  })
})

describe('author applications and promotion', () => {
  it('a reviewer approves an application → author; the change is logged', async () => {
    await rpc(reviewerA, `select public.review_application($1, true, 'welcome')`, [pending])
    expect((await q(db, `select role, application_status from public.profiles where id = $1`, [pending]))[0]).toEqual({ role: 'author', application_status: 'approved' })
    expect((await q(db, `select count(*)::int n from public.role_changes where user_id = $1`, [pending]))[0].n).toBe(1)
  })
  it('a rejected application stays pending/blocked and cannot post', async () => {
    await rpc(reviewerA, `select public.review_application($1, false, 'not a fit')`, [pending])
    expect((await q(db, `select role, application_status from public.profiles where id = $1`, [pending]))[0]).toEqual({ role: 'pending', application_status: 'rejected' })
    await expect(rpc(pending, `insert into public.posts (author_id, title, slug, body) values ($1,'t','s','b')`, [pending])).rejects.toThrow()
  })
  it('a reviewer can switch author ↔ trusted_author but cannot make reviewers or admins', async () => {
    await rpc(reviewerA, `select public.set_user_role($1, 'trusted_author', 'good work')`, [author])
    expect((await q(db, `select role from public.profiles where id = $1`, [author]))[0].role).toBe('trusted_author')
    await expect(rpc(reviewerA, `select public.set_user_role($1, 'reviewer')`, [author])).rejects.toThrow(/forbidden/i)
    await expect(rpc(reviewerA, `select public.set_user_role($1, 'admin')`, [author])).rejects.toThrow(/forbidden/i)
    await expect(rpc(reviewerA, `select public.set_user_role($1, 'author')`, [reviewerB])).rejects.toThrow(/forbidden/i)
  })
  it('only an admin can assign reviewer, and nobody can change their own role', async () => {
    await rpc(admin, `select public.set_user_role($1, 'reviewer')`, [author])
    expect((await q(db, `select role from public.profiles where id = $1`, [author]))[0].role).toBe('reviewer')
    await expect(rpc(admin, `select public.set_user_role($1, 'author')`, [admin])).rejects.toThrow(/own role/i)
  })
  it('an admin can demote another admin', async () => {
    const admin2 = await mkUser(db, 'admin2', 'admin')
    await rpc(admin, `select public.set_user_role($1, 'author')`, [admin2])
    expect((await q(db, `select role from public.profiles where id = $1`, [admin2]))[0].role).toBe('author')
  })
  it('a deactivated user loses all access immediately', async () => {
    const id = await draft(db, author, 'p1')
    await rpc(reviewerA, `select public.set_user_active($1, false, 'spam')`, [author])
    await expect(rpc(author, `select public.submit_post($1)`, [id])).rejects.toThrow(/forbidden/i)
    await expect(rpc(author, `insert into public.posts (author_id, title, slug, body) values ($1,'t','s2','b')`, [author])).rejects.toThrow()
    await rpc(reviewerA, `select public.set_user_active($1, true)`, [author])
    expect((await rpc(author, `select public.submit_post($1) as s`, [id]))[0].s).toBe('pending_review')
  })
  it('a reviewer cannot deactivate another reviewer', async () => {
    await expect(rpc(reviewerA, `select public.set_user_active($1, false)`, [reviewerB])).rejects.toThrow(/forbidden/i)
  })
})

describe('post lifecycle', () => {
  it('trusted_author publishes immediately and the audit log says auto_publish', async () => {
    const id = await draft(db, trusted, 'trusted-post')
    expect((await rpc(trusted, `select public.submit_post($1) as s`, [id]))[0].s).toBe('published')
    expect((await q(db, `select action from public.post_reviews where post_id = $1`, [id]))[0].action).toBe('auto_publish')
  })
  it('changes_requested → author edits → resubmits → pending_review', async () => {
    const id = await draft(db, author, 'p')
    await rpc(author, `select public.submit_post($1)`, [id])
    await expect(rpc(reviewerA, `select public.review_post($1, 'request_changes')`, [id])).rejects.toThrow(/note/i)
    await rpc(reviewerA, `select public.review_post($1, 'request_changes', 'please cite a source')`, [id])
    expect(await status(id)).toBe('changes_requested')
    expect((await rpc(author, `update public.posts set body = '<p>fixed</p>' where id = $1 returning id`, [id])).length).toBe(1)
    expect((await rpc(author, `select public.submit_post($1) as s`, [id]))[0].s).toBe('pending_review')
  })
  it('reject and unpublish need a note; unpublish takes a live post down', async () => {
    const id = await draft(db, author, 'p')
    await rpc(author, `select public.submit_post($1)`, [id])
    await rpc(reviewerA, `select public.review_post($1, 'approve')`, [id])
    await expect(rpc(reviewerB, `select public.review_post($1, 'unpublish')`, [id])).rejects.toThrow(/note/i)
    await rpc(reviewerB, `select public.review_post($1, 'unpublish', 'contains a testimonial')`, [id])
    expect(await status(id)).toBe('unpublished')
  })
  it('editing a published post: author → pending revision, live text unchanged; trusted → live at once', async () => {
    const a = await draft(db, author, 'a-post'); await rpc(author, `select public.submit_post($1)`, [a]); await rpc(reviewerA, `select public.review_post($1,'approve')`, [a])
    const rid = (await rpc(author, `select public.edit_published_post($1,'New title',null,'<p>new</p>',null,'{}') as r`, [a]))[0].r
    expect(rid).toBeTruthy()
    expect((await q(db, `select title from public.posts where id = $1`, [a]))[0].title).toBe('A title')
    await rpc(reviewerA, `select public.review_revision($1, 'approve')`, [rid])
    expect((await q(db, `select title from public.posts where id = $1`, [a]))[0].title).toBe('New title')

    const t = await draft(db, trusted, 't-post'); await rpc(trusted, `select public.submit_post($1)`, [t])
    expect((await rpc(trusted, `select public.edit_published_post($1,'Live now',null,'<p>x</p>',null,'{}') as r`, [t]))[0].r).toBeNull()
    expect((await q(db, `select title from public.posts where id = $1`, [t]))[0].title).toBe('Live now')
  })
  it('a reviewer cannot approve their own revision', async () => {
    const id = await draft(db, reviewerA, 'rp'); await rpc(reviewerA, `select public.submit_post($1)`, [id]); await rpc(reviewerB, `select public.review_post($1,'approve')`, [id])
    const rid = (await rpc(reviewerA, `select public.edit_published_post($1,'v2',null,'<p>v2</p>',null,'{}') as r`, [id]))[0].r
    await expect(rpc(reviewerA, `select public.review_revision($1,'approve')`, [rid])).rejects.toThrow(/own revision/i)
    await rpc(reviewerB, `select public.review_revision($1,'approve')`, [rid])
  })
  it('submissions are rate-limited per author per day', async () => {
    for (let i = 0; i < 5; i++) { const id = await draft(db, author, `rl-${i}`); await rpc(author, `select public.submit_post($1)`, [id]) }
    const id = await draft(db, author, 'rl-6')
    await expect(rpc(author, `select public.submit_post($1)`, [id])).rejects.toThrow(/rate_limited/)
  })
  it('incomplete posts cannot be submitted', async () => {
    const rows = await rpc(author, `insert into public.posts (author_id) values ($1) returning id`, [author])
    await expect(rpc(author, `select public.submit_post($1)`, [rows[0].id])).rejects.toThrow(/incomplete/)
  })
})

describe('who can see what (RLS)', () => {
  it('anon and other authors see only published posts; owners and staff see more', async () => {
    const mine = await draft(db, author, 'mine')
    const live = await draft(db, trusted, 'live'); await rpc(trusted, `select public.submit_post($1)`, [live])
    expect((await rpc(null, `select slug from public.posts order by slug`)).map((r: any) => r.slug)).toEqual(['live'])
    expect((await rpc(trusted, `select slug from public.posts order by slug`)).map((r: any) => r.slug)).toEqual(['live'])
    expect((await rpc(author, `select slug from public.posts order by slug`)).map((r: any) => r.slug)).toEqual(['live', 'mine'])
    expect((await rpc(reviewerA, `select slug from public.posts order by slug`)).map((r: any) => r.slug)).toEqual(['live', 'mine'])
    expect(mine).toBeTruthy()
  })
  it('unpublished posts disappear from the public', async () => {
    const id = await draft(db, trusted, 'gone'); await rpc(trusted, `select public.submit_post($1)`, [id])
    await rpc(reviewerA, `select public.review_post($1,'unpublish','policy')`, [id])
    expect(await rpc(null, `select 1 from public.posts where id = $1`, [id])).toHaveLength(0)
  })
  it('profiles: users see only themselves, staff see everyone, anon sees nothing', async () => {
    expect(await rpc(author, `select id from public.profiles`)).toHaveLength(1)
    expect((await rpc(reviewerA, `select id from public.profiles`)).length).toBe(6)
    await expect(rpc(null, `select id from public.profiles`)).rejects.toThrow(/permission denied/i)
  })
  it('the public author card exposes no email and only authors with published posts', async () => {
    const id = await draft(db, trusted, 'live'); await rpc(trusted, `select public.submit_post($1)`, [id])
    const rows = await rpc(null, `select * from public.public_authors`)
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows[0])).not.toContain('email')
  })
  it('authors cannot read the audit log of other people’s posts, or write to it', async () => {
    const id = await draft(db, trusted, 'x'); await rpc(trusted, `select public.submit_post($1)`, [id])
    expect(await rpc(author, `select * from public.post_reviews`)).toHaveLength(0)
    await expect(rpc(author, `insert into public.post_reviews (post_id, actor_id, action) values ($1,$2,'approve')`, [id, author])).rejects.toThrow(/permission denied/i)
    await expect(rpc(admin, `insert into public.role_changes (user_id, changed_by, new_role) values ($1,$1,'admin')`, [admin])).rejects.toThrow(/permission denied/i)
  })
})
