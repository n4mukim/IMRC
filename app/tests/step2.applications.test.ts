import { describe, it, expect, beforeEach } from 'vitest'
import { freshDb, mkUser, as, q, type Db } from './helpers/db'

let db: Db
let reviewerA: string, admin: string, author: string
beforeEach(async () => {
  db = await freshDb()
  reviewerA = await mkUser(db, 'reviewer_a', 'reviewer')
  await mkUser(db, 'reviewer_b', 'reviewer')
  admin = await mkUser(db, 'admin', 'admin')
  author = await mkUser(db, 'author', 'author')
  await q(db, `delete from public.notifications`) // ignore notices from the setup users above
})
const rpc = (u: string | null, sql: string, p: unknown[] = []) => as(db, u, () => q(db, sql, p))
const notes = (tpl?: string) => q(db, `select to_email, template, payload from public.notifications ${tpl ? `where template = '${tpl}'` : ''} order by id`)

describe('sign-up form rules', () => {
  it('the motivation must be 50–500 characters (checked by the database as well as the form)', async () => {
    await expect(mkUser(db, 'tooshort', 'pending', { motivation: 'because' })).rejects.toThrow()
    await expect(mkUser(db, 'toolong', 'pending', { motivation: 'x'.repeat(501) })).rejects.toThrow()
    expect(await mkUser(db, 'justright', 'pending', { motivation: 'x'.repeat(50) })).toBeTruthy()
  })
  it('a new account is always pending, whatever the sign-up data says', async () => {
    const id = await mkUser(db, 'sneaky', 'pending', { role: 'admin', application_status: 'approved', email_verified: 'true' })
    expect((await q(db, `select role, application_status from public.profiles where id = $1`, [id]))[0]).toEqual({ role: 'pending', application_status: 'pending' })
  })
})

describe('e-mail verification gates the queue', () => {
  it('reviewers are NOT notified at sign-up, only once the e-mail is verified', async () => {
    const id = await mkUser(db, 'applicant', 'pending', {}, { verified: false })
    expect(await notes('new_application')).toHaveLength(0)
    await q(db, `update auth.users set email_confirmed_at = now() where id = $1`, [id])
    const n = await notes('new_application')
    expect(n.map((x: any) => x.to_email).sort()).toEqual(['admin@example.org', 'reviewer_a@example.org', 'reviewer_b@example.org'])
    expect(n[0].payload.display_name).toBe('applicant')
  })
  it('verifying twice does not notify twice', async () => {
    const id = await mkUser(db, 'applicant', 'pending', {}, { verified: false })
    await q(db, `update auth.users set email_confirmed_at = now() where id = $1`, [id])
    await q(db, `update auth.users set email_confirmed_at = now() + interval '1 minute' where id = $1`, [id])
    expect(await notes('new_application')).toHaveLength(3)
  })
  it('a deactivated reviewer is not e-mailed', async () => {
    await rpc(admin, `select public.set_user_active($1, false)`, [(await q(db, `select id from public.profiles where email = 'reviewer_b@example.org'`))[0].id])
    await mkUser(db, 'applicant')
    expect((await notes('new_application')).map((x: any) => x.to_email).sort()).toEqual(['admin@example.org', 'reviewer_a@example.org'])
  })
  it('an unverified applicant cannot be approved', async () => {
    const id = await mkUser(db, 'unverified', 'pending', {}, { verified: false })
    await expect(rpc(reviewerA, `select public.review_application($1, true)`, [id])).rejects.toThrow(/verified/i)
  })
})

describe('the author applications queue', () => {
  it('reviewers can list pending applications; ordinary users cannot see other people’s', async () => {
    await mkUser(db, 'first'); await mkUser(db, 'second')
    const rows = await rpc(reviewerA, `select display_name from public.profiles where role = 'pending' and email_verified order by created_at, display_name`)
    expect(rows.map((r: any) => r.display_name)).toEqual(['first', 'second'])
    const seen = await rpc(author, `select display_name from public.profiles where role = 'pending'`)
    expect(seen).toHaveLength(0)
  })
  it('approve → author, applicant is e-mailed (with the note), change is logged', async () => {
    const id = await mkUser(db, 'applicant')
    await rpc(reviewerA, `select public.review_application($1, true, 'Welcome aboard')`, [id])
    expect((await q(db, `select role from public.profiles where id = $1`, [id]))[0].role).toBe('author')
    const n = await notes('application_approved')
    expect(n).toHaveLength(1)
    expect(n[0].to_email).toBe('applicant@example.org')
    expect(n[0].payload.note).toBe('Welcome aboard')
    expect((await q(db, `select count(*)::int n from public.role_changes where user_id = $1 and event = 'application'`, [id]))[0].n).toBe(1)
  })
  it('decline → stays pending/blocked, the optional note is e-mailed, and the person still cannot post', async () => {
    const id = await mkUser(db, 'applicant')
    await rpc(reviewerA, `select public.review_application($1, false, 'We are not taking guest authors in this area yet')`, [id])
    expect((await q(db, `select role, application_status from public.profiles where id = $1`, [id]))[0]).toEqual({ role: 'pending', application_status: 'rejected' })
    expect((await notes('application_rejected'))[0].payload.note).toMatch(/not taking guest authors/)
    await expect(rpc(id, `insert into public.posts (author_id, title, slug, body) values ($1,'t','s','b')`, [id])).rejects.toThrow()
  })
  it('declining without a note is allowed (the note is optional)', async () => {
    const id = await mkUser(db, 'applicant')
    await rpc(reviewerA, `select public.review_application($1, false)`, [id])
    expect((await notes('application_rejected'))[0].payload.note).toBeNull()
  })
  it('an incomplete application (no bio / affiliation / motivation) cannot be approved', async () => {
    const id = await mkUser(db, 'applicant')
    await q(db, `update public.profiles set affiliation = null where id = $1`, [id])
    await expect(rpc(reviewerA, `select public.review_application($1, true)`, [id])).rejects.toThrow(/incomplete/)
    await rpc(id, `update public.profiles set bio = 'Updated bio' where id = $1`, [id]) // applicants can still edit their profile
  })
  it('a decision is final: the same application cannot be decided twice', async () => {
    const id = await mkUser(db, 'applicant')
    await rpc(reviewerA, `select public.review_application($1, true)`, [id])
    await expect(rpc(reviewerA, `select public.review_application($1, false)`, [id])).rejects.toThrow(/invalid_state/)
  })
  it('non-reviewers cannot decide applications', async () => {
    const id = await mkUser(db, 'applicant')
    await expect(rpc(author, `select public.review_application($1, true)`, [id])).rejects.toThrow(/forbidden/)
    await expect(rpc(id, `select public.review_application($1, true)`, [id])).rejects.toThrow(/forbidden/)
    await expect(rpc(null, `select public.review_application($1, true)`, [id])).rejects.toThrow(/permission denied/)
  })
  it('an applicant cannot verify themselves or change their application status', async () => {
    const id = await mkUser(db, 'applicant', 'pending', {}, { verified: false })
    await expect(rpc(id, `update public.profiles set email_verified = true where id = $1`, [id])).rejects.toThrow(/permission denied|forbidden/i)
    await expect(rpc(id, `update public.profiles set application_status = 'approved' where id = $1`, [id])).rejects.toThrow(/permission denied|forbidden/i)
    await expect(rpc(id, `update public.profiles set application_note = 'let me in' where id = $1`, [id])).rejects.toThrow(/permission denied|forbidden/i)
  })
})

describe('the outbox is private', () => {
  it('no client (anon, author, reviewer, admin) can read or write notifications', async () => {
    await mkUser(db, 'applicant')
    for (const u of [null, author, reviewerA, admin]) {
      await expect(rpc(u, `select * from public.notifications`)).rejects.toThrow(/permission denied/i)
      await expect(rpc(u, `insert into public.notifications (to_email, template) values ('x@y.z','new_application')`)).rejects.toThrow(/permission denied/i)
    }
  })
})
