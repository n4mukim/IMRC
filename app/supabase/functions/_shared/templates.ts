// Pure functions (no Deno or network APIs) so they can be unit-tested with vitest.
export type Template =
  | 'new_application' | 'application_approved' | 'application_rejected'
  | 'post_pending' | 'post_auto_published'
  | 'post_approved' | 'post_changes_requested' | 'post_rejected' | 'post_unpublished'
  | 'revision_pending' | 'revision_approved' | 'revision_changes_requested' | 'revision_rejected'
export type Rendered = { subject: string; text: string; html: string }

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const oneLine = (s: unknown) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120)

const wrap = (inner: string) =>
  `<div style="font-family:system-ui,sans-serif;line-height:1.6;max-width:560px;color:#222">${inner}` +
  `<p style="color:#666;font-size:13px;margin-top:2rem">IMRC · Intercultural Mental Health &amp; Resilience Research Centre</p></div>`

export function render(template: Template, payload: Record<string, unknown>, siteUrl: string): Rendered {
  const base = siteUrl.replace(/\/$/, '')
  const name = oneLine(payload.display_name) || 'there'
  const note = typeof payload.note === 'string' && payload.note.trim() ? payload.note.trim() : ''

  switch (template) {
    case 'new_application': {
      const aff = oneLine(payload.affiliation)
      const link = `${base}/blog/review/`
      return {
        subject: `New author application: ${name}`,
        text: `${name}${aff ? ` (${aff})` : ''} has verified their email and applied to write for the IMRC blog.\n\nReview the application: ${link}`,
        html: wrap(`<p><strong>${esc(name)}</strong>${aff ? ` (${esc(aff)})` : ''} has verified their email and applied to write for the IMRC blog.</p><p><a href="${esc(link)}">Review the application</a></p>`),
      }
    }
    case 'application_approved': {
      const link = `${base}/blog/write/?new=1`
      return {
        subject: 'Your IMRC author application was approved',
        text: `Hello ${name},\n\nYour application to write for the IMRC blog was approved.${note ? `\n\nNote from the reviewer: ${note}` : ''}\n\nStart writing: ${link}\n\nEvery post is reviewed before it goes live, and posts follow IMRC's advertising rules: no testimonials, client stories, promised results or superlatives.`,
        html: wrap(`<p>Hello ${esc(name)},</p><p>Your application to write for the IMRC blog was approved.</p>${note ? `<p><em>Note from the reviewer:</em> ${esc(note)}</p>` : ''}<p><a href="${esc(link)}">Start writing</a></p><p>Every post is reviewed before it goes live, and posts follow IMRC's advertising rules: no testimonials, client stories, promised results or superlatives.</p>`),
      }
    }
    case 'application_rejected':
      return {
        subject: 'About your IMRC author application',
        text: `Hello ${name},\n\nThank you for applying to write for the IMRC blog. We are not able to approve your application at this time.${note ? `\n\nNote from the reviewer: ${note}` : ''}\n\nYou are welcome to read the blog at ${base}/blog/.`,
        html: wrap(`<p>Hello ${esc(name)},</p><p>Thank you for applying to write for the IMRC blog. We are not able to approve your application at this time.</p>${note ? `<p><em>Note from the reviewer:</em> ${esc(note)}</p>` : ''}<p>You are welcome to read the blog at <a href="${esc(base)}/blog/">${esc(base)}/blog/</a>.</p>`),
      }
    case 'post_pending':
    case 'revision_pending': {
      const title = oneLine(payload.title) || 'Untitled'
      const who = oneLine(payload.author_name) || 'An author'
      const edit = template === 'revision_pending' || payload.edit === true
      const link = `${base}/blog/review/`
      return {
        subject: `${edit ? 'Edit' : 'Post'} waiting for review: ${title}`,
        text: `${who} ${edit ? 'sent an edit to the published post' : 'submitted a post'} “${title}” for review.\n\nReview it: ${link}`,
        html: wrap(`<p><strong>${esc(who)}</strong> ${edit ? 'sent an edit to the published post' : 'submitted a post'} “${esc(title)}” for review.</p><p><a href="${esc(link)}">Open the review queue</a></p>`),
      }
    }
    case 'post_auto_published': {
      const title = oneLine(payload.title) || 'Untitled'
      const who = oneLine(payload.author_name) || 'A trusted author'
      const edit = payload.edit === true
      const link = `${base}/blog/post/?slug=${encodeURIComponent(String(payload.slug ?? ''))}`
      return {
        subject: `Trusted author ${edit ? 'edited' : 'published'}: ${title}`,
        text: `${who} ${edit ? 'edited and republished' : 'published'} “${title}” without review, as a trusted author. You may want to spot-check it.\n\nRead it: ${link}\nIf it breaks the writing guidelines you can unpublish it from the Review page.`,
        html: wrap(`<p><strong>${esc(who)}</strong> ${edit ? 'edited and republished' : 'published'} “${esc(title)}” without review, as a trusted author. You may want to spot-check it.</p><p><a href="${esc(link)}">Read the post</a></p><p>If it breaks the writing guidelines you can unpublish it from the Review page.</p>`),
      }
    }
    case 'post_approved':
    case 'post_changes_requested':
    case 'post_rejected':
    case 'post_unpublished':
    case 'revision_approved':
    case 'revision_changes_requested':
    case 'revision_rejected': {
      const title = oneLine(payload.title) || 'your post'
      const edit = template.startsWith('revision_')
      const outcome = template.replace('post_', '').replace('revision_', '')
      const link = `${base}/blog/dashboard/`
      const live = `${base}/blog/post/?slug=${encodeURIComponent(String(payload.slug ?? ''))}`
      const lines: Record<string, { subject: string; body: string; cta: string; url: string }> = {
        approved: { subject: `${edit ? 'Your edit was approved' : 'Your post was approved'}: ${title}`, body: edit ? `Your edit to “${title}” was approved and is now live.` : `Your post “${title}” was approved and is now live.`, cta: 'Read it', url: live },
        changes_requested: { subject: `Changes requested: ${title}`, body: edit ? `A reviewer asked for changes to your edit of “${title}”. The live post has not changed.` : `A reviewer asked for changes to “${title}” before it can go live.`, cta: 'Open your dashboard', url: link },
        rejected: { subject: `${edit ? 'Your edit was not approved' : 'Your post was not approved'}: ${title}`, body: edit ? `Your edit to “${title}” was not approved. The live post has not changed.` : `Your post “${title}” was not approved.`, cta: 'Open your dashboard', url: link },
        unpublished: { subject: `Your post was taken down: ${title}`, body: `A reviewer unpublished “${title}”.`, cta: 'Open your dashboard', url: link },
      }
      const l = lines[outcome]
      return {
        subject: l.subject,
        text: `Hello,\n\n${l.body}${note ? `\n\nNote from the reviewer: ${note}` : ''}\n\n${l.cta}: ${l.url}`,
        html: wrap(`<p>Hello,</p><p>${esc(l.body)}</p>${note ? `<p><em>Note from the reviewer:</em> ${esc(note)}</p>` : ''}<p><a href="${esc(l.url)}">${esc(l.cta)}</a></p>`),
      }
    }
  }
}
