import { describe, it, expect, beforeEach } from 'vitest'
import { freshDb, mkUser, as, q, draft, type Db } from './helpers/db'

let db: Db
let author: string, trusted: string, reviewer: string, other: string
beforeEach(async () => {
  db = await freshDb()
  author = await mkUser(db, 'author', 'author')
  trusted = await mkUser(db, 'trusted', 'trusted_author')
  reviewer = await mkUser(db, 'reviewer', 'reviewer')
  other = await mkUser(db, 'other', 'author')
})
const rpc = (u: string | null, sql: string, p: unknown[] = []) => as(db, u, () => q(db, sql, p))
const publish = async (who: string, slug: string) => {
  const id = await draft(db, who, slug)
  await rpc(who, `select public.submit_post($1)`, [id])
  if (who === author || who === other) await rpc(reviewer, `select public.review_post($1,'approve')`, [id])
  return id
}

describe('autosave: authors keep editing their own unsent drafts', () => {
  it('a draft can be saved repeatedly, even with no title or slug yet', async () => {
    const r = await rpc(author, `insert into public.posts (author_id) values ($1) returning id`, [author])
    for (const body of ['<p>a</p>', '<p>ab</p>', '<p>abc</p>']) {
      expect(await rpc(author, `update public.posts set body = $2 where id = $1 returning id`, [r[0].id, body])).toHaveLength(1)
    }
  })
  it('nobody else can edit someone’s draft', async () => {
    const id = await draft(db, author, 'mine')
    expect(await rpc(other, `update public.posts set body = '<p>hijack</p>' where id = $1 returning id`, [id])).toHaveLength(0)
    expect(await rpc(other, `select id from public.posts where id = $1`, [id])).toHaveLength(0)
  })
  it('a sent-back post can be autosaved; one in review cannot', async () => {
    const id = await draft(db, author, 'p')
    await rpc(author, `select public.submit_post($1)`, [id])
    expect(await rpc(author, `update public.posts set body = '<p>x</p>' where id = $1 returning id`, [id])).toHaveLength(0)
    await rpc(reviewer, `select public.review_post($1,'request_changes','Please add a source')`, [id])
    expect(await rpc(author, `update public.posts set body = '<p>fixed</p>' where id = $1 returning id`, [id])).toHaveLength(1)
  })
  it('two posts cannot share a web address', async () => {
    await draft(db, author, 'same-address')
    await expect(draft(db, other, 'same-address')).rejects.toThrow(/duplicate|unique/i)
  })
})

describe('what the database refuses even if the page is bypassed', () => {
  it.each([
    ['a script tag', '<p>hi</p><script>alert(1)</script>'],
    ['an inline event handler', '<p onclick="x()">hi</p>'],
    ['an event handler on an image', '<img src="https://x.test/a.png" onerror="x()">'],
    ['a javascript: link', '<a href="javascript:alert(1)">x</a>'],
    ['an iframe', '<iframe src="https://evil.test"></iframe>'],
    ['an image with a javascript source', '<img src="javascript:alert(1)">'],
    ['an html data url', '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>'],
  ])('rejects %s', async (_n, body) => {
    await expect(rpc(author, `insert into public.posts (author_id, title, slug, body) values ($1,'t','s',$2)`, [author, body])).rejects.toThrow(/unsafe_html/)
    const id = await draft(db, author, 'ok')
    await expect(rpc(author, `update public.posts set body = $2 where id = $1`, [id, body])).rejects.toThrow(/unsafe_html/)
  })
  it('accepts the formatting the editor produces (headings, bold, italic, underline, lists, quotes, links, images)', async () => {
    const body = '<h2>H</h2><h3>S</h3><p><strong>b</strong> <em>i</em> <u>u</u></p><ul><li>x</li></ul><ol><li>y</li></ol><blockquote>q</blockquote><p><a href="https://example.org">l</a></p><img src="https://x.test/a.webp" alt="d">'
    expect(await rpc(author, `insert into public.posts (author_id, title, slug, body) values ($1,'t','fine',$2) returning id`, [author, body])).toHaveLength(1)
  })
  it('limits length, topics and the cover address', async () => {
    await expect(rpc(author, `insert into public.posts (author_id, title, slug, body) values ($1,'t','long',$2)`, [author, 'x'.repeat(200001)])).rejects.toThrow(/too_long/)
    await expect(rpc(author, `insert into public.posts (author_id, title, slug, body, tags) values ($1,'t','t1','b',$2)`, [author, ['a', 'b', 'c', 'd', 'e', 'f', 'g']])).rejects.toThrow(/invalid_tags/)
    await expect(rpc(author, `insert into public.posts (author_id, title, slug, body, tags) values ($1,'t','t2','b',$2)`, [author, ['x'.repeat(31)]])).rejects.toThrow(/invalid_tags/)
    await expect(rpc(author, `insert into public.posts (author_id, title, slug, body, cover_image_url) values ($1,'t','c1','b','javascript:alert(1)')`, [author])).rejects.toThrow(/invalid_cover/)
    expect(await rpc(author, `insert into public.posts (author_id, title, slug, body, cover_image_url) values ($1,'t','c2','b','https://x.test/c.webp') returning id`, [author])).toHaveLength(1)
  })
  it('the same checks apply to revisions of published posts', async () => {
    const id = await publish(author, 'live')
    await expect(rpc(author, `select public.edit_published_post($1,'T',null,'<script>x</script>',null,'{}')`, [id])).rejects.toThrow(/unsafe_html/)
  })
})

describe('editing a published post', () => {
  it('author: edit becomes the ONLY open revision; live text is untouched; second edit must update that one', async () => {
    const id = await publish(author, 'live')
    const rid = (await rpc(author, `select public.edit_published_post($1,'New title',null,'<p>new</p>',null,'{}') as r`, [id]))[0].r
    expect(rid).toBeTruthy()
    expect((await q(db, `select title from public.posts where id = $1`, [id]))[0].title).toBe('A title')
    await expect(rpc(author, `select public.edit_published_post($1,'Again',null,'<p>again</p>',null,'{}')`, [id])).rejects.toThrow(/revision_exists/)
    await rpc(author, `select public.update_my_revision($1,'Newer title',null,'<p>newer</p>',null,'{}')`, [rid])
    expect((await q(db, `select title, status from public.post_revisions where id = $1`, [rid]))[0]).toEqual({ title: 'Newer title', status: 'pending_review' })
    expect((await q(db, `select title from public.posts where id = $1`, [id]))[0].title).toBe('A title')
  })
  it('a sent-back edit can be fixed and goes back into the queue (and is logged)', async () => {
    const id = await publish(author, 'live')
    const rid = (await rpc(author, `select public.edit_published_post($1,'New',null,'<p>new</p>',null,'{}') as r`, [id]))[0].r
    await rpc(reviewer, `select public.review_revision($1,'request_changes','Add a source')`, [rid])
    expect((await q(db, `select status from public.post_revisions where id = $1`, [rid]))[0].status).toBe('changes_requested')
    await rpc(author, `select public.update_my_revision($1,'New v2',null,'<p>v2</p>',null,'{}')`, [rid])
    expect((await q(db, `select status from public.post_revisions where id = $1`, [rid]))[0].status).toBe('pending_review')
    const log = (await q(db, `select action from public.post_reviews where revision_id = $1 order by id`, [rid])).map((r: any) => r.action)
    expect(log).toEqual(['revision_submit', 'revision_request_changes', 'revision_submit'])
    await rpc(reviewer, `select public.review_revision($1,'approve')`, [rid])
    expect((await q(db, `select title from public.posts where id = $1`, [id]))[0].title).toBe('New v2')
  })
  it('only the owner can change their revision, and a decided revision is final', async () => {
    const id = await publish(author, 'live')
    const rid = (await rpc(author, `select public.edit_published_post($1,'New',null,'<p>new</p>',null,'{}') as r`, [id]))[0].r
    await expect(rpc(other, `select public.update_my_revision($1,'x',null,'<p>x</p>',null,'{}')`, [rid])).rejects.toThrow(/forbidden/)
    await expect(rpc(null, `select public.update_my_revision($1,'x',null,'<p>x</p>',null,'{}')`, [rid])).rejects.toThrow(/permission denied/)
    await rpc(reviewer, `select public.review_revision($1,'approve')`, [rid])
    await expect(rpc(author, `select public.update_my_revision($1,'late',null,'<p>x</p>',null,'{}')`, [rid])).rejects.toThrow(/already decided/)
  })
  it('trusted author: edits go live at once and nothing queues', async () => {
    const id = await publish(trusted, 'trusted-live')
    expect((await rpc(trusted, `select public.edit_published_post($1,'Live now',null,'<p>x</p>',null,'{}') as r`, [id]))[0].r).toBeNull()
    expect((await q(db, `select title from public.posts where id = $1`, [id]))[0].title).toBe('Live now')
    expect((await q(db, `select count(*)::int n from public.post_revisions`))[0].n).toBe(0)
  })
  it('you cannot edit someone else’s published post', async () => {
    const id = await publish(author, 'live')
    await expect(rpc(other, `select public.edit_published_post($1,'x',null,'<p>x</p>',null,'{}')`, [id])).rejects.toThrow(/forbidden/)
  })
})

describe('the author dashboard only ever shows your own posts, with reviewer notes', () => {
  it('lists my posts of every status and the note on changes_requested / rejected', async () => {
    const a = await draft(db, author, 'a'); const b = await draft(db, author, 'b'); const c = await draft(db, author, 'c'); await draft(db, other, 'someone-elses')
    await rpc(author, `select public.submit_post($1)`, [b]); await rpc(reviewer, `select public.review_post($1,'request_changes','Please cite a source')`, [b])
    await rpc(author, `select public.submit_post($1)`, [c]); await rpc(reviewer, `select public.review_post($1,'reject','Contains a testimonial')`, [c])
    const rows = await rpc(author, `select id, status, reviewer_note from public.posts where author_id = $1 order by slug`, [author])
    expect(rows.map((r: any) => r.status)).toEqual(['draft', 'changes_requested', 'rejected'])
    expect(rows[1].reviewer_note).toBe('Please cite a source')
    expect(rows[2].reviewer_note).toBe('Contains a testimonial')
    expect(a).toBeTruthy()
  })
})
