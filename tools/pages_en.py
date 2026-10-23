"""English-only pages (Phase 1 scope): For Professionals, Blog, FAQ, legal, links, 404."""
import json
from common import *
from pages_main import newsletter_form
import blog_static


def _wrap(path, title, desc, hero_h1, lead, body, crumbs_label, pos="30% 40%", jsonld=None, actions="", **kw):
    hero = page_hero([crumbs_label], hero_h1, lead, pos, actions)
    return path, page(path, title, desc, hero + body, translated=False, jsonld=jsonld, lang_notice=True, **kw,
                      crumbs=[("Home", "/"), (crumbs_label, path)])


def professionals():
    path = "/professionals/"
    body = f'''<section class="section" id="supervision" aria-labelledby="sup-h"><div class="wrap split">
<div class="reveal">{eyebrow("Clinical Supervision")}<h2 id="sup-h" class="h2">Supervision for clinicians</h2></div>
<div class="reveal stack" style="--i:1"><p class="lead">Clinical supervision for Registered Psychotherapists (RP), Registered Psychotherapists (Qualifying) and other mental health clinicians, with an intercultural and spiritually attuned lens.</p>
<p>Emma Lim, RP, is a certified clinical supervisor RP (Registered Psychotherapist) with over 30 years of clinical experience.</p>
<dl class="defs"><dt>1:1 supervision</dt><dd>$180 CAD / 50 min, online, bi-weekly or monthly</dd><dt>Group consultation</dt><dd>$80–100 CAD / 90 min, 3–6 participants</dd><dt>Languages</dt><dd>English · 한국어 · 日本語</dd></dl>
<p>{btn("Enquire about supervision", "/contact/", "dark")}</p></div></div></section>
<section class="section" id="workshops" style="padding-top:0" aria-labelledby="ws-h"><div class="wrap split">
<div class="reveal">{eyebrow("Workshops & Consultation Groups")}<h2 id="ws-h" class="h2">Workshops and consultation groups</h2></div>
<div class="reveal stack" style="--i:1"><p class="lead">Professional workshops and peer consultation groups for therapists from diverse backgrounds. Registration for professional workshops uses Stripe checkout.</p>
<div class="empty" id="ws-empty" style="grid-template-columns:1fr"><div><h3>No workshops are open for registration right now.</h3><p class="muted">Join the monthly newsletter to hear when new professional workshops open.</p></div>{newsletter_form("nl-ws")}</div>
<div data-sessions data-limit="0"></div></div></div></section>
<section class="section-tight" style="padding-top:0"><div class="wrap-narrow">{crisis_box()}</div></section>'''
    return _wrap(path, "For Professionals", "Clinical supervision, workshops and consultation groups for RPs, RPs (Qualifying) and other mental health clinicians.",
                 "Supervision and learning for <em>clinicians</em>", "Clinical supervision, workshops and consultation groups for therapists.", body, "For Professionals", "img8:50% 50%")


def _blog_page(path, title, desc, h1, lead, body, mode, pos="img2:50% 50%"):
    return _wrap(path, title, desc, h1, lead, body, "Blog", pos, scripts=BLOG_SCRIPTS, body_attrs=f' data-blog="{mode}"')


def blog():
    path = "/blog/"
    body = f'''<section class="section-tight"><div class="wrap"><div id="blog-demo" class="notice" hidden></div>
<div class="btn-row" id="blog-auth" style="justify-content:flex-end"><a id="blog-signin-link" class="btn btn-line btn-sm" href="#blog-signin-wrap"><span>Sign in</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></a><button type="button" id="blog-signout-top" class="btn btn-line btn-sm" data-signout hidden><span>Sign out</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></button></div></div></section>
<section class="section" style="padding-top:clamp(24px,4vw,48px)" aria-labelledby="posts-h"><div class="wrap">

<div id="blog-mine" class="card reveal in" hidden style="margin-bottom:clamp(32px,5vw,56px)">
<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:1rem">
<div><h2 class="h3" style="margin:0">Your posts</h2><p class="small muted" style="margin:0">Signed in as <span id="blog-who"></span></p></div>
<div class="btn-row">{btn("Write a post", "/blog/write/?new=1", "dark", "btn-sm")}{btn("Dashboard", "/blog/dashboard/", "line", "btn-sm")}<a id="blog-review-link" class="btn btn-line btn-sm" href="/blog/review/" hidden><span>Review applications <span class="badge" id="blog-review-count" hidden>0</span></span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></a><button type="button" class="btn btn-line btn-sm" data-signout><span>Sign out</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></button></div></div>
<details id="drafts-folder" class="folder" open>
<summary><span class="folder-ic" aria-hidden="true">{icon("book")}</span> Drafts <span class="badge" id="drafts-count">0</span></summary>
<p class="small muted" style="margin:.2rem 0 .8rem">Private to you. Keep as many drafts as you like and open any of them to keep writing.</p>
<ul id="drafts-list" class="mine-list"></ul>
<p style="margin:1rem 0 0"><a class="link-arrow" href="/blog/write/?new=1">Start a new draft{icon("arrow-right")}</a></p>
</details>
<h3 class="small" style="margin:1.6rem 0 .2rem;font-weight:500;color:var(--forest)">Uploaded posts</h3>
<ul id="blog-mine-list" class="mine-list"></ul>
<p class="small muted" style="margin:1rem 0 0">Drafts are private. Posts you upload are checked by a reviewer before they go live, unless you are a trusted author. Posts follow IMRC’s advertising rules: no testimonials, client stories, promised results or superlatives.</p></div>

<div class="sec-head reveal in"><h2 id="posts-h" class="h2">All posts</h2></div>
<div id="blog-tags" class="filters" role="group" aria-label="Filter by topic" hidden></div>
<div id="blog-grid" class="bgrid">{blog_static.cards_html(blog_static.load_posts())}</div>
<div id="blog-empty" class="empty" hidden style="grid-template-columns:1fr"><div><h3>No posts yet.</h3><p class="muted">Published posts will appear here.</p></div></div>
<div id="blog-pager" class="pager" hidden></div>

<div class="card card-sage" style="margin-top:clamp(40px,6vw,72px)">
<h2 class="h3">Write for IMRC</h2>
<p id="blog-pending" hidden>Your author application is waiting for approval. You can write posts once a reviewer approves it.</p>
<div id="blog-signin-wrap" class="split split-even" style="margin-top:1rem;align-items:start">
<div class="stack"><p class="muted" style="margin:0">Anyone can apply to write. A reviewer approves each author, and every post is reviewed before it goes live (trusted authors publish straight away).</p>
<p style="margin:0">{btn("Apply to write", "/blog/join/", "dark")}</p></div>
<form id="blog-signin" class="form" novalidate>
<p class="small" style="margin:0"><strong>Already approved? Sign in.</strong></p>
<div class="field"><label for="si-email">Email</label><input id="si-email" name="email" type="email" autocomplete="email" required></div>
<div class="field"><label for="si-pw">Password</label><input id="si-pw" name="password" type="password" autocomplete="current-password"></div>
<div class="btn-row"><button class="btn btn-dark" type="submit"><span>Sign in</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></button>
<button class="btn btn-line" type="button" id="blog-magic"><span>Email me a sign-in link</span><span class="arr-wrap">{icon("mail", "arr")}</span></button></div>
<p class="form-status" role="status" aria-live="polite"></p></form></div></div>
</div></section>'''
    return _blog_page(path, "Blog", "Plain-language posts on culture, mental health and resilience from the IMRC community.", "The IMRC <em>blog</em>",
                      "Plain-language writing on culture, mental health and resilience.", body, "list")


def blog_dashboard():
    path = "/blog/dashboard/"
    chip = lambda g, label, on=False: f'<button type="button" aria-pressed="{"true" if on else "false"}" data-g="{g}">{label} <span class="badge">0</span></button>'
    body = f'''<section class="section" style="padding-top:clamp(28px,4vw,48px)"><div class="wrap-narrow">
<div id="blog-demo" class="notice" hidden style="margin-bottom:1rem"></div>
<div id="db-gate" class="card"><h1 class="h3">Dashboard</h1><p>Only approved IMRC authors have a dashboard. <a class="link-arrow" href="/blog/">Go to the blog page to sign in or apply</a></p></div>
<div id="db-main" hidden>
<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:1rem">
<div><h1 class="h2" style="margin:0">Your posts</h1><p class="small muted" style="margin:.3rem 0 0">Signed in as <span id="db-who"></span></p></div>
<div class="btn-row">{btn("New draft", "/blog/write/?new=1", "dark", "btn-sm")}<button type="button" class="btn btn-line btn-sm" data-signout><span>Sign out</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></button></div></div>
<div class="filters" role="group" aria-label="Filter posts">{chip("all", "All", True)}{chip("draft", "Drafts")}{chip("changes", "Changes requested")}{chip("review", "In review")}{chip("live", "Published")}{chip("off", "Not live")}</div>
<ul id="db-list" class="mine-list"></ul>
<p class="small muted" style="margin-top:1.4rem">Drafts are private. Posts in review cannot be edited until a reviewer decides. Editing a published post sends your changes to a reviewer, unless you are a trusted author.</p>
</div></div></section>'''
    return path, page(path, "Dashboard", "Your posts on the IMRC blog.", body, translated=False, lang_notice=True, scripts=BLOG_SCRIPTS, body_attrs=' data-blog="dashboard"', noindex=True)


def blog_join():
    path = "/blog/join/"
    body = f'''<section class="section" style="padding-top:clamp(28px,4vw,48px)"><div class="wrap-narrow">
<div id="join-demo" class="notice" hidden style="margin-bottom:1rem">{icon("info")}<p><strong>Demo mode.</strong> Nothing is emailed and there is no CAPTCHA. Your application is saved in this browser, and you can approve it from the <a href="/blog/review/">review page</a> by choosing “Reviewer” in the demo bar.</p></div>
<p><a class="link-arrow" href="/blog/">All posts</a></p>
<h1 class="h2" style="margin:1rem 0">Apply to write for IMRC</h1>
<p class="lead">Tell us a little about yourself. After you verify your email, a reviewer reads your application. Approved authors can write posts, and each post is reviewed before it goes live.</p>
<div id="join-done" class="card card-sage" tabindex="-1" hidden style="margin-top:1.5rem"><h2 class="h3">Check your email</h2><p>We sent you a link to verify your address. Once you have verified it, a reviewer will look at your application and email you the decision.</p><p class="small muted">Nothing to see yet? Check your spam folder.</p></div>
<form id="join-form" class="form" novalidate style="margin-top:1.6rem" aria-label="Author application">
<div class="field"><label for="j-name">Full name <span class="req" aria-hidden="true">*</span></label><input id="j-name" autocomplete="name" required><p class="err" role="alert"></p></div>
<div class="field"><label for="j-email">Email <span class="req" aria-hidden="true">*</span></label><input id="j-email" type="email" autocomplete="email" required><p class="err" role="alert"></p></div>
<div class="field"><label for="j-pw">Password <span class="req" aria-hidden="true">*</span></label><input id="j-pw" type="password" autocomplete="new-password" required minlength="10"><p class="hint">At least 10 characters.</p><p class="err" role="alert"></p></div>
<div class="field"><label for="j-bio">Short bio <span class="req" aria-hidden="true">*</span></label><textarea id="j-bio" maxlength="500" style="min-height:100px" required></textarea><p class="hint">One or two sentences. This can appear on your posts.</p><p class="err" role="alert"></p></div>
<div class="field"><label for="j-aff">Affiliation <span class="req" aria-hidden="true">*</span></label><input id="j-aff" autocomplete="organization" required><p class="hint">Where you work or study. Write “independent” if none.</p><p class="err" role="alert"></p></div>
<div class="field"><label for="j-why">Why do you want to write for IMRC? <span class="req" aria-hidden="true">*</span></label><textarea id="j-why" maxlength="520" style="min-height:140px" required aria-describedby="j-why-count"></textarea><p class="hint" id="j-why-count">0 / 500 (at least 50)</p><p class="err" role="alert"></p></div>
<div class="field"><label class="check" for="j-agree"><input id="j-agree" type="checkbox" required><span>I will follow IMRC’s writing guidelines: no client stories (even anonymised), testimonials, promised results, comparisons or superlatives, no personal health information, and exact professional titles.</span></label><p class="err" role="alert"></p></div>
<div class="hp" aria-hidden="true"><label>Leave empty<input id="j-hp" tabindex="-1" autocomplete="off"></label></div>
<div id="ts-box"></div>
<button class="btn btn-dark" type="submit"><span>Send application</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></button>
<p id="join-status" class="form-status" role="status" aria-live="polite"></p>
</form></div></section>'''
    scripts = BLOG_SCRIPTS + '\n<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>'
    return path, page(path, "Apply to write", "Apply to write for the IMRC blog.", body, translated=False, lang_notice=True, scripts=scripts, body_attrs=' data-blog="join"', noindex=True)


def blog_review():
    path = "/blog/review/"
    chip = lambda attr, key, label, on=False, badge=True: f'<button type="button" aria-pressed="{"true" if on else "false"}" {attr}="{key}">{label}{" <span class=badge>0</span>" if badge else ""}</button>'
    tab = lambda key, label, cnt=False: f'<button type="button" role="tab" id="tab-{key}" data-tab="{key}" aria-controls="panel-{key}" aria-selected="false" tabindex="-1">{label}{f" <span class=badge id=cnt-{key}>0</span>" if cnt else ""}</button>'
    body = f'''<section class="section" style="padding-top:clamp(28px,4vw,48px)"><div class="wrap">
<div id="blog-demo" class="notice" hidden style="margin-bottom:1rem"></div>
<div id="rv-gate" class="card" style="max-width:640px"><h1 class="h3">Review</h1><p>Only IMRC reviewers can open this page. <a class="link-arrow" href="/blog/">Go to the blog page to sign in</a></p></div>
<div id="rv-main" hidden>
<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:end;margin-bottom:1rem">
<div><p style="margin:0"><a class="link-arrow" href="/blog/">All posts</a> · <a class="link-arrow" href="/blog/dashboard/">My dashboard</a></p><h1 class="h2" style="margin:.8rem 0 0">Review</h1><p class="small muted" style="margin:.2rem 0 0">Signed in as <span id="rv-who"></span></p></div></div>
<div class="tabs" role="tablist" aria-label="Review sections">{tab("apps", "Author applications", True)}{tab("posts", "Posts pending review", True)}{tab("auto", "Recently auto-published")}{tab("users", "Users")}{tab("audit", "Audit log")}</div>
<p id="rv-status" class="form-status" role="status" aria-live="polite"></p>

<div data-panel="apps" role="tabpanel" aria-labelledby="tab-apps">
<div class="filters" role="group" aria-label="Application status"><button type="button" aria-pressed="true" data-av="pending">Waiting</button><button type="button" aria-pressed="false" data-av="rejected">Declined</button></div>
<p class="small muted">Oldest first. Applications appear after the applicant verifies their email. Approving makes the person an author; declining keeps the account blocked from posting.</p>
<div id="rv-apps-list" class="stack"></div></div>

<div data-panel="posts" role="tabpanel" aria-labelledby="tab-posts" hidden>
<p class="small muted">New posts and edits to live posts, oldest first. You cannot review your own work: another reviewer or an admin does that. Check posts against IMRC’s rules: no testimonials, client stories, promised results, comparisons or superlatives, no personal health information, exact professional titles.</p>
<div id="rv-posts-list" class="stack"></div></div>

<div data-panel="auto" role="tabpanel" aria-labelledby="tab-auto" hidden>
<p class="small muted">Trusted authors publish without review. Spot-check what went live, and unpublish anything that breaks the rules (the author is told why).</p>
<ul id="rv-auto-list" class="mine-list"></ul></div>

<div data-panel="users" role="tabpanel" aria-labelledby="tab-users" hidden>
<div class="filters" role="group" aria-label="Filter users">{chip("data-uf", "all", "All", True)}{chip("data-uf", "pending", "Pending")}{chip("data-uf", "author", "Authors")}{chip("data-uf", "trusted_author", "Trusted")}{chip("data-uf", "reviewer", "Reviewers")}{chip("data-uf", "admin", "Admins")}{chip("data-uf", "off", "Deactivated")}</div>
<p class="small muted">“Ready for trust” means 3 or more approved posts and no rejections in the last 90 days. Promotion is always your decision, and every change is logged.</p>
<ul id="rv-users-list" class="mine-list"></ul></div>

<div data-panel="audit" role="tabpanel" aria-labelledby="tab-audit" hidden>
<div class="filters" role="group" aria-label="Filter activity">{chip("data-af", "all", "Everything", True, False)}{chip("data-af", "post", "Posts", False, False)}{chip("data-af", "role", "People and roles", False, False)}</div>
<ul id="rv-audit-list" class="mine-list"></ul>
<p style="margin-top:1rem"><button type="button" class="btn btn-line btn-sm" id="rv-audit-more" hidden><span>Load older activity</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></button></p></div>
</div></div></section>'''
    return path, page(path, "Review", "Review author applications and posts for the IMRC blog.", body, translated=False, lang_notice=True, scripts=BLOG_SCRIPTS, body_attrs=' data-blog="review"', noindex=True)


def blog_post():
    path = "/blog/post/"
    body = f'''<section class="section" style="padding-top:clamp(32px,5vw,56px)"><div class="wrap-narrow">
<p><a class="link-arrow" href="/blog/">{icon("arrow-right", "ic").replace('<svg ', '<svg style="transform:rotate(180deg)" ')} All posts</a></p>
<h1 class="h2" id="post-hero-title" style="margin:1rem 0 1.4rem">Loading…</h1>
<article id="post-root" class="prose-blog"></article></div></section>
<section class="section" id="post-related" hidden style="padding-top:0"><div class="wrap"><h2 class="h3" style="margin-bottom:1.2rem">Related posts</h2><div id="post-related-grid" class="bgrid"></div></div></section>'''
    return path, page(path, "Blog post", "A post on the IMRC blog.", body, translated=False, lang_notice=True, scripts=BLOG_SCRIPTS, body_attrs=' data-blog="post"', noindex=True)


def blog_write():
    path = "/blog/write/"
    tb = lambda cmd, label, inner: f'<button type="button" class="tbtn" data-cmd="{cmd}" aria-label="{label}" aria-pressed="false">{inner}</button>'
    body = f'''<section class="section" style="padding-top:clamp(28px,4vw,48px)"><div class="wrap-narrow">
<div id="blog-demo" class="notice" hidden style="margin-bottom:1rem"></div>
<div id="write-gate" class="card"><h1 class="h3">Write a post</h1><p id="gate-msg">Checking your account…</p><p><a class="link-arrow" href="/blog/">Go to the blog page to sign in</a></p></div>

<form id="editor" hidden novalidate>
<h1 class="h2" style="margin-bottom:1rem">Write a post</h1>
<nav id="ed-drafts" class="draftbar" aria-label="Your drafts" hidden></nav>
<div id="ed-mode-published" class="notice" hidden>{icon("info")}<p></p></div>
<div class="notice" role="note">{icon("info")}<p>Follow IMRC’s advertising rules: no client stories (even anonymised), testimonials, promised results, comparisons or superlatives, and no personal health information. Use exact professional titles.</p></div>
<div class="field" style="margin-top:1.2rem"><label for="ed-title">Title</label><input id="ed-title" maxlength="200" autocomplete="off"></div>

<div class="field"><span class="lbl" id="ed-body-lbl">Post</span>
<div id="ed-toolbar" class="toolbar" role="toolbar" aria-label="Formatting" aria-controls="ed-body">
<select id="ed-fmt" aria-label="Text style"><option value="p">Paragraph</option><option value="h2">Heading</option><option value="h3">Subheading</option><option value="blockquote">Quote</option></select>
{tb("bold", "Bold", "<b>B</b>")}{tb("italic", "Italic", "<i>I</i>")}{tb("underline", "Underline", "<u>U</u>")}
{tb("insertUnorderedList", "Bulleted list", "• List")}{tb("insertOrderedList", "Numbered list", "1. List")}
<button type="button" class="tbtn" id="ed-link">Link</button>
<button type="button" class="tbtn" id="ed-image">{icon("plus")} Image</button>
<input id="ed-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
</div>
<div id="ed-body" class="ed blog-body" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="ed-body-lbl" data-placeholder="Start writing…"></div>
<div id="ed-preview-box" class="ed blog-body" hidden></div>
<p class="small muted" id="ed-count" style="margin:.5rem 0 0"></p></div>

<details id="ed-details" class="acc" style="margin:1rem 0"><summary>Post details (summary, topics, cover image, web address)</summary>
<div class="stack" style="padding:0 0 1rem">
<div class="field"><label for="ed-excerpt">Summary (shown on the blog page)</label><textarea id="ed-excerpt" maxlength="400" style="min-height:90px"></textarea><p class="hint">Leave blank to use the first lines of the post.</p></div>
<div class="field"><label for="ed-tags">Topics</label><input id="ed-tags" placeholder="grief, culture, family"><p class="hint">Separate with commas. Up to 6.</p></div>
<div class="field"><span class="lbl">Cover image</span><img id="ed-cover-img" alt="" hidden style="max-width:240px;margin-bottom:.6rem">
<button type="button" class="btn btn-line btn-sm" id="ed-cover-btn"><span>Choose image</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></button>
<button type="button" class="btn btn-line btn-sm" id="ed-cover-clear" hidden><span>Remove</span><span class="arr-wrap">{icon("x", "arr")}</span></button>
<input id="ed-cover-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden><p class="hint">JPEG, PNG, WebP or GIF, up to 5 MB.</p></div>
<div class="field"><label for="ed-slug">Web address</label><input id="ed-slug" autocomplete="off"><p class="hint">Lowercase letters, numbers and hyphens. Made from the title.</p></div>
</div></details>

<div class="btn-row" style="margin-top:1.2rem">
<button type="button" class="btn btn-line" id="ed-draft"><span>Save draft</span><span class="arr-wrap">{icon("check", "arr")}</span></button>
<button type="button" class="btn btn-line" id="ed-preview"><span>Preview</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></button>
<button type="button" class="btn btn-dark" id="ed-upload"><span>Upload post</span><span class="arr-wrap">{icon("arrow-up-right", "arr")}</span></button>
<button type="button" class="btn btn-dark" id="ed-save-edit" hidden><span>Save changes</span><span class="arr-wrap">{icon("check", "arr")}</span></button></div>
<p id="ed-saved" class="small muted" aria-live="off" style="margin:.6rem 0 0"></p>
<p class="small muted" style="margin-top:.3rem">Drafts save automatically a few seconds after you stop typing. “Upload post” checks your post, then sends it live if you are a trusted author, or to a reviewer if not.</p>
<p id="ed-status" class="form-status" role="status" aria-live="polite"></p>
</form>

<div id="ed-readonly" class="card" hidden><h1 class="h2" id="ro-title" style="margin-bottom:.6rem"></h1>
<p><span id="ro-status" class="badge"></span> <span id="ro-msg" class="small muted"></span></p><p id="ro-note" class="small"></p>
<div id="ro-body" class="blog-body"></div><p style="margin-top:1.4rem"><a class="link-arrow" href="/blog/dashboard/">Back to your dashboard</a></p></div>

<dialog id="ed-dialog" class="dlg" aria-labelledby="dlg-title">
<h2 class="h3" id="dlg-title">Ready to upload?</h2>
<ul id="dlg-checks" class="ck"></ul>
<p id="dlg-what" class="small"></p>
<label class="check"><input type="checkbox" id="dlg-ok1"><span>I have checked this post follows IMRC’s writing guidelines: no testimonials, promised results, comparisons or superlatives, and exact professional titles.</span></label>
<label class="check" style="margin-top:.6rem"><input type="checkbox" id="dlg-ok2"><span>It contains no personal health information and no client stories, even anonymised.</span></label>
<div class="btn-row" style="margin-top:1.2rem"><button type="button" class="btn btn-line" id="dlg-back"><span>Go back and edit</span><span class="arr-wrap">{icon("arrow-right", "arr")}</span></button>
<button type="button" class="btn btn-dark" id="dlg-go" disabled><span>Upload post</span><span class="arr-wrap">{icon("arrow-up-right", "arr")}</span></button></div>
</dialog>
</div></section>'''
    return path, page(path, "Write a post", "Write and upload a post for the IMRC blog.", body, translated=False, lang_notice=True, scripts=BLOG_SCRIPTS, body_attrs=' data-blog="write"', noindex=True)


FAQ_ITEMS = [
    ("Who provides care?", "Clinical services are provided by the practitioner named on each profile. Emma Lim (registered as Eun Lim) is a Registered Psychotherapist, CRPO #008377, and a certified clinical supervisor, with over 30 years of clinical experience."),
    ("What languages are offered?", "Therapy is available in English, Korean and Japanese. Program delivery languages are listed on each program."),
    ("What does psychotherapy cost?", "Individual sessions are $225 CAD for 50 minutes. Couples and family sessions are $325 CAD for 75 minutes. A limited number of sliding-scale spots are available. A complimentary 15-minute phone or video consultation is offered first."),
    ("Is psychotherapy covered by insurance?", "Psychotherapy with an RP is not covered by OHIP. Many extended health benefit plans cover Registered Psychotherapists, so check your own plan. There is no direct billing: official receipts are issued through Jane App for reimbursement. [Confirm: no direct billing]"),
    ("Is therapy online or in person?", "Secure video sessions are available across Ontario. In-person sessions take place at the Toronto office, by appointment on designated days. [Confirm office location: Toronto or Markham]"),
    ("Do you see clients outside Ontario?", "Clients must be physically located in Ontario during sessions, under CRPO regulations."),
    ("What is the cancellation policy?", "24 hours' notice is required. Late cancellations and no-shows are billed the full session fee."),
    ("Is IMRC a crisis service?", "No. If you are in crisis, call or text 9-8-8 (Suicide Crisis Helpline), call 911, or go to the nearest hospital emergency department."),
    ("Who handles complaints about Registered Psychotherapists?", "CRPO sets the rules for Registered Psychotherapists in Ontario and handles complaints."),
]


def faq():
    path = "/faq/"
    from html import escape
    acc = "".join(f'<details><summary>{q}</summary><div class="ans">{a.replace("[", "<mark class=todo lang=en>[").replace("]", "]</mark>")}</div></details>' for q, a in FAQ_ITEMS)
    ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ_ITEMS if "[" not in a]}
    body = f'<section class="section"><div class="wrap-narrow"><div class="acc reveal">{acc}</div><div style="margin-top:2rem">{crisis_box()}</div></div></section>'
    return _wrap(path, "FAQ", "Answers about fees, insurance, online or in-person sessions and languages at IMRC.", "Frequently asked <em>questions</em>",
                 "Fees, insurance, online or in-person sessions, and languages.", body, "FAQ", "40% 50%", [ld])


def privacy():
    path = "/privacy/"
    body = f'''<section class="section"><div class="wrap-narrow prose">
<div class="notice">{icon("info")}<p><strong>Draft structure — needs legal review before launch.</strong> The headings below are the content this policy must cover. Wording must be confirmed by counsel.</p></div>
<h2>Who we are</h2><p>This site is operated by Metta Mind Collective, operating as Intercultural Mental Health &amp; Resilience Research Centre (IMRC). {todo("[legal / mailing address — confirm business mailbox]")}</p>
<h2>What we collect</h2><p>The site collects no personal health information. Contact and newsletter forms collect only: name, email, preferred language and a short message. Booking and clinical intake happen on Jane App, outside this site.</p>
<h2>Where it is hosted</h2><p>Health information is held only in Jane App, which is PIPEDA and PHIPA compliant. This site collects none. {todo("[Confirm website hosting provider and region, including any storage outside Canada]")}</p>
<h2>Analytics and cookies</h2><p>No advertising pixels or remarketing tags. We use privacy-friendly analytics with IP anonymisation and essential cookies only, with a short cookie notice.</p>
<h2>Newsletter</h2><p>Sign-up records express consent, identifies the sender by legal name and mailing address, and every email includes an unsubscribe link.</p>
<h2>Privacy contact</h2><p><a href="mailto:privacy@culturalresilience.org">privacy@culturalresilience.org</a></p></div></section>'''
    return _wrap(path, "Privacy Policy", "How IMRC collects and protects personal information.", "Privacy <em>Policy</em>", "", body, "Privacy Policy", "50% 50%")


def terms():
    path = "/terms/"
    body = f'''<section class="section"><div class="wrap-narrow prose">
<div class="notice">{icon("info")}<p><strong>Draft structure — needs legal review before launch.</strong></p></div>
<h2>Operator</h2><p>Metta Mind Collective, operating as Intercultural Mental Health &amp; Resilience Research Centre (IMRC).</p>
<h2>Educational content</h2><p>Articles are for education and are not a substitute for professional assessment or treatment.</p>
<h2>Not a crisis service</h2><p>{crisis_text()}</p>
<h2>Practitioner listings</h2><p>Practitioners are independent clinicians; IMRC does not employ, supervise, or assume liability for independent practices. {todo("[For legal review]")}</p>
<h2>External services</h2><p>Appointments and clinical intake open on Jane App. Professional workshop payments use Stripe.</p></div></section>'''
    return _wrap(path, "Terms", "Terms of use for the IMRC website.", "Terms of <em>use</em>", "", body, "Terms", "50% 50%")


def accessibility():
    path = "/accessibility/"
    body = f'''<section class="section"><div class="wrap-narrow prose">
<p class="lead">IMRC aims to meet Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. We are working toward that target and test against it before each release.</p>
<h2>What we do</h2><ul><li>Every control can be used with a keyboard, with a visible focus state.</li><li>Meaningful images have alt text, and headings are in order.</li><li>Form fields have labels and clear error messages.</li><li>Language is declared on each page and on text in another language.</li><li>The layout holds at 200% zoom, and the reduced-motion setting is respected.</li><li>Text meets a 4.5:1 contrast ratio against its background in English, Korean and Japanese.</li></ul>
<h2>Ask for help</h2><p>If something on this site is hard to use, tell us and we will help or provide the information another way. <a href="mailto:accessibility@culturalresilience.org">accessibility@culturalresilience.org</a></p></div></section>'''
    return _wrap(path, "Accessibility Statement", "IMRC's accessibility target and how to request help.", "Accessibility <em>Statement</em>", "", body, "Accessibility Statement", "50% 50%")


def links():
    path = "/links/"
    items = [("Website", "/", False), ("Instagram", "#", True), ("LinkedIn", "#", True), ("Facebook", "#", True), ("YouTube (coming later)", "#", True)]
    lis = "".join(f'<li>{btn(n, h, "white", ext=e)}</li>' for n, h, e in items)
    body = f'<section class="section"><div class="wrap-narrow" style="text-align:center"><ul class="profile-links">{lis}</ul><p class="small muted" style="margin-top:1.5rem">{todo("[Add real profile URLs, with campaign tags for each channel]")}</p></div></section>'
    return _wrap(path, "Links", "IMRC profiles and links.", "Find us <em>online</em>", "", body, "Links", "30% 50%")


def not_found():
    path = "/404.html"
    body = f'<section class="section"><div class="wrap-narrow" style="text-align:center"><p class="lead" style="margin-inline:auto">That page does not exist or has moved. Start from the home page, or choose where you are headed.</p><div class="btn-row" style="justify-content:center;margin-top:1.5rem">{btn("Home", "/", "dark")}{btn("Programs & Events", "/programs/", "yellow")}{btn("Find Care", "/find-care/", "line")}</div></div></section>'
    p, html_ = _wrap(path, "Page not found", "Page not found.", "Page <em>not found</em>", "", body, "404", "50% 50%")
    return path, html_


EN_PAGES = [professionals, blog, blog_post, blog_write, blog_dashboard, blog_join, blog_review, faq, privacy, terms, accessibility, links, not_found]
