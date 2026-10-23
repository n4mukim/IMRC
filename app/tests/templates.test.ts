import { describe, it, expect } from 'vitest'
import { render } from '../supabase/functions/_shared/templates'

const site = 'https://culturalresilience.org/'
describe('e-mail templates', () => {
  it('new_application tells reviewers who applied and links to the queue', () => {
    const m = render('new_application', { display_name: 'Mina Park', affiliation: 'Toronto clinic' }, site)
    expect(m.subject).toBe('New author application: Mina Park')
    expect(m.text).toContain('https://culturalresilience.org/blog/review/')
  })
  it('approved includes the reviewer note when given, and omits it otherwise', () => {
    expect(render('application_approved', { display_name: 'A', note: 'Welcome!' }, site).text).toContain('Welcome!')
    expect(render('application_approved', { display_name: 'A', note: null }, site).text).not.toContain('Note from the reviewer')
  })
  it('rejected includes the note and never promises anything', () => {
    const m = render('application_rejected', { display_name: 'A', note: 'Not a fit right now' }, site)
    expect(m.text).toContain('Not a fit right now')
    expect(m.subject).toBe('About your IMRC author application')
  })
  it('escapes HTML from user-supplied names and notes, and keeps headers on one line', () => {
    const m = render('new_application', { display_name: 'Eve <script>alert(1)</script>\nBcc: x@y.z', affiliation: '"><img src=x>' }, site)
    expect(m.html).not.toContain('<script>')
    expect(m.html).not.toContain('<img src=x>')
    expect(m.subject).not.toMatch(/[\r\n]/)
    const n = render('application_rejected', { display_name: 'A', note: '<b>hi</b>' }, site)
    expect(n.html).toContain('&lt;b&gt;hi&lt;/b&gt;')
  })

  it('post_pending and revision_pending tell reviewers what is waiting', () => {
    expect(render('post_pending', { title: 'Grief', author_name: 'Mina' }, site).subject).toBe('Post waiting for review: Grief')
    expect(render('revision_pending', { title: 'Grief', author_name: 'Mina' }, site).subject).toBe('Edit waiting for review: Grief')
    expect(render('post_pending', { title: 'Grief', author_name: 'Mina' }, site).text).toContain('https://culturalresilience.org/blog/review/')
  })
  it('post_auto_published asks reviewers to spot-check and links to the live post', () => {
    const m = render('post_auto_published', { title: 'Hello', slug: 'hello-a1b2', author_name: 'Tru' }, site)
    expect(m.text).toContain('spot-check')
    expect(m.text).toContain('https://culturalresilience.org/blog/post/?slug=hello-a1b2')
  })
  it.each([
    ['post_approved', 'was approved'], ['post_changes_requested', 'asked for changes'], ['post_rejected', 'was not approved'],
    ['post_unpublished', 'unpublished'], ['revision_approved', 'edit to'], ['revision_changes_requested', 'asked for changes'], ['revision_rejected', 'was not approved'],
  ] as const)('%s includes the reviewer note and the right wording', (tpl, phrase) => {
    const m = render(tpl, { title: 'My post', slug: 'my-post', note: 'Because of X' }, site)
    expect(m.text).toContain('Because of X')
    expect(m.text).toContain(phrase)
    expect(m.html).toContain('Because of X')
  })
  it('author e-mails omit the note line when there is none, and escape hostile titles', () => {
    expect(render('post_approved', { title: 'T', slug: 't', note: null }, site).text).not.toContain('Note from the reviewer')
    const m = render('post_rejected', { title: '<img src=x onerror=1>', slug: 'x', note: '<b>n</b>' }, site)
    expect(m.html).not.toContain('<img src=x')
    expect(m.html).toContain('&lt;b&gt;n&lt;/b&gt;')
  })
})
