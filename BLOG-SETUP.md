# Turning the blog on (static site + Supabase)

The blog pages (`/blog/`, `/blog/post/`, `/blog/write/`) work today in **demo mode**: posts stay in the visitor's own browser. To make them real:

1. Create a Supabase project (Canada region) and turn **Confirm email** on (Auth > Providers > Email).
2. In the SQL editor run, in order: `app/supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql`, `0004_applications.sql`, `0005_editor.sql`, `0006_review.sql`, `0007_import.sql`, then `app/supabase/storage.sql`.
3. Sign up the first admin (Auth > Users > Add user, tick "auto confirm"), then edit the email in `app/supabase/seed_admin.sql` and run it.
4. Put the project URL and **anon** key in `site/js/config.js`. Never put the service-role key anywhere on the site.
5. Auth > URL configuration: add your site's address. Rebuild/upload the `site/` folder.

Who can do what is enforced by the database, not by the page: visitors read published posts only; approved authors save drafts and upload; "Upload" sends a post to review unless the author is a trusted author; reviewers approve in the Supabase dashboard until the review screens (step 4 of the app plan) are built.

Add authors: sign them up (Auth > Users), then as an admin run
`select public.review_application('<user uuid>', true, 'welcome');` or set a role with `public.set_user_role(...)`.

## Sign-up, CAPTCHA, rate limits and email (step 2)

**Public sign-up form** is `/blog/join/`. New accounts are always "pending". Reviewers only see an application after the person has verified their email.

1. **CAPTCHA (Cloudflare Turnstile).** Create a Turnstile widget at dash.cloudflare.com. Put the **secret key** in Supabase: Auth > Attack Protection > Enable CAPTCHA > Turnstile. Put the **site key** (public) in `site/js/config.js` as `turnstileSiteKey`. Supabase then rejects any sign-up without a valid token.
2. **Rate limits.** Auth > Rate Limits in Supabase caps sign-ups, sign-ins and emails per hour per IP. Suggested start: sign-ups and sign-ins 10 per hour per IP, emails 4 per hour. These are enforced by Supabase, not by the page.
3. **Email.** Use a custom SMTP (for example Resend SMTP) in Auth > SMTP so verification emails come from your domain. Set SPF, DKIM and DMARC on culturalresilience.org.
4. **Reviewer notifications.** The database writes every email into `public.notifications`. Deploy the sender:
   ```
   supabase functions deploy send-notifications --no-verify-jwt
   supabase secrets set RESEND_API_KEY=... EMAIL_FROM="IMRC <blog@culturalresilience.org>" SITE_URL=https://culturalresilience.org WEBHOOK_SECRET=<random string>
   ```
   Then trigger it either with a Database Webhook (Database > Webhooks > table `notifications`, event INSERT, HTTP request to the function URL, header `x-webhook-secret`), or a one-minute cron that calls the same URL with the same header. Failed sends retry up to 5 times and keep the error in `last_error`.
5. **Reviewers.** Make at least one reviewer or admin before opening sign-ups (see `seed_admin.sql`, and `public.set_user_role`). Reviewers decide applications at `/blog/review/`.

Behaviour to know about: a declined applicant stays blocked from posting (their account remains, with status "rejected"); the optional note is emailed to them. Declining is final in this version; an admin can approve a declined applicant later with `public.set_user_role`.

## Editor and dashboard (step 3)

- **Dashboard:** `/blog/dashboard/` lists the author's own posts with status badges and reviewer notes. **Editor:** `/blog/write/`.
- **Autosave:** drafts save to the database about 4 seconds after typing stops. Published posts are never autosaved.
- **Editing a published post:** a trusted author's changes go live at once; anyone else's go to a reviewer as a single open edit while the live post stays up. The database allows only one open edit per post.
- **Before upload:** a checklist dialog checks the title, address, 50-word minimum, and image descriptions, and asks the author to confirm the writing guidelines.
- **Images:** JPEG, PNG, WebP or GIF, 5 MB max, resized to 1600px and converted to WebP in the browser, then stored in the `blog-images` bucket (created by `storage.sql`).
- **Database safety net (`0005_editor.sql`):** even if someone skips the page and calls the API directly, posts containing scripts, event handlers, iframes or non-https images are refused, as are posts over 200,000 characters, more than 6 topics, or a cover image that is not an https address. The page also sanitises everything it displays.

## Review workflow, audit log and notifications (step 4)

- **Reviewer dashboard:** `/blog/review/` has five tabs: Author applications, Posts pending review (new posts and edits to live posts, oldest first, with a side-by-side "Live now / Proposed edit" comparison for edits), Recently auto-published (spot-check trusted authors and unpublish), Users (filter by role, one-click promote/demote, deactivate, and a "Ready for trust" badge) and Audit log. The first two tabs show a count.
- **Rules (unchanged, now also in the screens):** Request changes, Reject and Unpublish need a note, which is emailed to the author. A reviewer cannot review their own post or edit; the page hides the buttons and the database refuses anyway. Only admins can create reviewers and admins.
- **Emails:** to reviewers: new sign-up, new post pending, edit pending, trusted post published (so it can be spot-checked). To authors: application approved/declined, post approved / changes requested / rejected / unpublished, edit approved / sent back / rejected, always with the reviewer's note. They are queued in `public.notifications` and sent by the `send-notifications` function (see step 2).
- **Deactivation:** Deactivate calls `set_user_active` (the database immediately refuses everything that person does) and then the `ban-user` function, which also blocks their sign-in at the Auth level. Deploy it with JWT verification on (the default): `supabase functions deploy ban-user`. It checks that the caller is a reviewer or admin and that the database already shows the account as deactivated.
- **"Ready for trust":** 3 or more approved posts and no rejections in the last 90 days. Change the numbers with `update public.app_settings set value = ... where key in ('trust_min_approved_posts','trust_window_days')`.

## Public blog, SEO, feed, migration and redirects (step 5)

**How public posts reach search engines.** Search engines and social previews do not run JavaScript, so each published post gets its own real page at `/blog/<slug>/` with its own title, description, canonical address, Open Graph image (the cover, or the site image if there is none), `article:published_time` and `BlogPosting` structured data. The `/blog/` page is pre-filled with the latest posts, `/blog/feed.xml` is the RSS feed (full text), and every post is in `sitemap.xml`. Private pages (write, dashboard, review, apply, and the client-side `/blog/post/` preview) are marked `noindex`.

**Publishing a post therefore needs a rebuild of the static site:**
```
SUPABASE_URL=... SUPABASE_ANON_KEY=... python3 tools/fetch_posts.py   # copies PUBLISHED posts only (public key)
python3 tools/build.py                                                  # writes pages, feed, sitemap
```
`fetch_posts.py` never overwrites `tools/blog_posts.json` if anything goes wrong, so a failed run cannot empty the blog. A post that is unpublished or deleted disappears from the next build (its page is removed, so it returns 404). To rebuild automatically, copy `deploy/rebuild-blog.yml` into `.github/workflows/` and add a Supabase Database Webhook on the `posts` table that triggers it; the template also rebuilds nightly as a safety net. Until the rebuild finishes, `/blog/post/?slug=...` still shows a newly published post.

**Safety.** The static pages are built through an allow-list sanitiser (no scripts, handlers, iframes, odd links or images), page addresses that are malformed or reserved (`write`, `post`, `join`, `review`, `dashboard`, `feed`) are skipped, and structured data is escaped so a title cannot break out of it. `python3 -m unittest discover -s tools -p "test_*.py"` runs the 15 tests for all of this.

**Migration.** The old Research & Articles section had no published articles, so there was nothing to move. For any articles you do have, put them in a JSON file (see `app/scripts/sample-articles.json`) and run `node app/scripts/import-articles.mjs articles.json --dry` to check it, then without `--dry` (needs the service-role key and your admin email, server only). They become **Published** posts attributed to the admin, keeping title, date, body, images and topics; running it twice does not duplicate. Add an `old_url` to each article and the script records a 301 redirect in `tools/legacy_articles.json`.

**Redirects.** `tools/build.py` writes `site/_redirects` (Netlify and Cloudflare Pages) and `vercel.json` (repo root), sending `/research`, `/research/*`, `/articles` and `/articles/*` to `/blog/` with a 301, plus one 301 per imported article. A small fallback page at `/research/` also forwards visitors on hosts that ignore both files. For nginx: `rewrite ^/(research|articles)(/.*)?$ /blog/ permanent;`.

**Share links** are plain links (email, LinkedIn, Facebook) with no scripts, pixels or embedded feeds, in line with the privacy rules. Topic links on a post open `/blog/?tag=<topic>`.
