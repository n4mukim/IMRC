# IMRC blog (Next.js + Supabase)

Open sign-up, moderated publishing, and a Reviewer role that approves authors and posts.
**Status: steps 1 to 5 of 6 done** (schema, roles, RLS, auth; sign-up, email verification, author applications, notification outbox; editor safety rules and revision editing; review workflow, audit log, trust badge, post emails; reserved addresses, article importer). The blog screens currently live in the static site (`../site/blog`) and talk to these migrations through Supabase.

## Assumptions (the brief had blanks)
- IMRC: Intercultural Mental Health & Resilience Research Centre, a not-for-profit (operating name of Metta Mind Collective) serving Korean-, Japanese- and English-speaking people in Ontario.
- Stack: Next.js 16 (App Router) + Supabase (Auth, Postgres, Storage), deployed on Vercel. Tailwind and the IMRC design system are added when the pages are built (step 3 onward).
- Numbers in `[brackets]` in the brief are stored in `app_settings` and can be changed with SQL: 3 approved posts / 90 days for "Ready for trust", 5 submissions per author per day.
- Admins publish their own posts immediately (admin = everything). A **reviewer's** own posts and edits always need a different reviewer or an admin.

## Layout
```
supabase/migrations/0001_schema.sql     tables, enums, signup trigger
supabase/migrations/0002_rls.sql        column grants, RLS policies, guard triggers, public author view
supabase/migrations/0003_functions.sql  every state change (submit, review, promote ...) as a SECURITY DEFINER function
supabase/migrations/0004_applications.sql  e-mail verification, application queue rules, notification outbox
supabase/migrations/0005_editor.sql        unsafe-HTML / size / topic checks, one open edit per post, update_my_revision
supabase/migrations/0007_import.sql        reserved post addresses, import_article() (service role only)
supabase/migrations/0006_review.sql        post/edit notifications, audit_log(), trust_candidates()
supabase/functions/                     send-notifications, ban-user (Resend) + pure email templates
supabase/seed_admin.sql                 promotes the first admin
src/lib/auth.ts                         getSession / requireUser / requireRole (server only)
src/lib/supabase/{server,client,admin}.ts
src/proxy.ts                            refreshes the session, keeps signed-out visitors out of /dashboard
src/app/login, auth/callback, verify-email, dashboard/**
tests/                                  Postgres-level tests (PGlite)
```

## How the security works (three layers)
1. **Privileges.** Clients can only write harmless columns (`title`, `body`, `bio` ...). `posts.status`, `published_at`, `profiles.role`, `active` and `application_status` are not grantable to `anon` or `authenticated`.
2. **RLS.** Visitors see only `published` posts; authors see their own; reviewers see everything; audit tables are read-only to clients.
3. **Functions.** `submit_post`, `review_post`, `review_application`, `set_user_role`, `edit_published_post` ... re-read the caller's role from `profiles` using `auth.uid()`. The role is never a parameter. Two guard triggers refuse any status/role change made directly by a client session.

## Setup
1. Create a Supabase project (Region: Canada (Central) if available, since IMRC wants Canadian hosting).
2. Auth > Providers > Email: turn **Confirm email** ON. Auth > URL configuration: add `http://localhost:3000/auth/callback` and your production URL.
3. Run the three migration files in order in the SQL editor (or `supabase db push` with the Supabase CLI).
4. `cp .env.example .env.local` and fill in the three Supabase values. `SUPABASE_SERVICE_ROLE_KEY` is server-only.
5. `npm install && npm run dev`.

## Create the first admin
1. Sign up with the admin's email (step 2 adds the form; until then use Auth > Users > Add user) and confirm the email.
2. Edit the address in `supabase/seed_admin.sql` and run it in the SQL editor. Clients cannot call `bootstrap_admin`.

## Assign reviewers
Signed in as admin: `select public.set_user_role('<user uuid>', 'reviewer', 'note');`
(the Users screen in the reviewer dashboard does this with one click in step 4). Reviewers can then switch authors between `author` and `trusted_author`; only admins create reviewers and admins.

## Tests
`npm test` runs 118 tests against real Postgres (PGlite) with the three migrations applied and a small shim of Supabase's roles and `auth.uid()`. They cover the three required guarantees:
- an author cannot publish directly (insert, update, `published_at`, ownership all refused; submit goes to `pending_review`)
- a reviewer cannot approve, reject or request changes on their own post or revision; a different reviewer or an admin can
- a non-reviewer (pending, author, trusted_author, anonymous) is refused by every review/approve function

plus role self-assignment, applications, promotion rules, deactivation, rate limit, visibility and audit-log checks. Mutation checks (removing the self-approval guard; letting clients write `status`) made the right tests fail.

Not covered by the shim: the real Supabase Auth service and the Next.js pages against a live project. Run the setup above once and sign in to confirm.

## Later steps
2 Sign-up form + Turnstile + author application queue, 3 editor + author dashboard, 4 review workflow + audit UI + email, 5 public blog + redirects, 6 SEO, rate limits, security pass.
Known item for step 4: deactivating a user must also ban them in Supabase Auth (service role) so their session ends immediately. Today the database already refuses all their actions.
