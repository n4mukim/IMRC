#!/usr/bin/env node
// Bring existing articles into the blog as PUBLISHED posts attributed to an admin account.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_EMAIL=admin@culturalresilience.org \
//     node scripts/import-articles.mjs articles.json [--dry]
//
// articles.json: [{ "title": "...", "slug": "optional", "body": "<p>HTML</p>", "published_at": "2024-03-05",
//                   "cover": "https://...", "tags": ["culture"], "excerpt": "optional", "old_url": "/research/old-article" }]
// Titles, dates, body and images are kept. `old_url` (if given) is written to tools/legacy_articles.json so build.py can
// emit a 301 redirect from the old address to /blog/<slug>/.
// SERVER ONLY: the service-role key bypasses RLS. Never put it in the website.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const [file, flag] = process.argv.slice(2)
const dry = flag === '--dry'
if (!file) { console.error('Usage: node scripts/import-articles.mjs articles.json [--dry]'); process.exit(1) }

const slugify = (t) => t.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
const articles = JSON.parse(readFileSync(file, 'utf8'))
const problems = []
for (const [i, a] of articles.entries()) {
  a.slug = (a.slug || slugify(a.title || '')).trim()
  if (!a.title) problems.push(`#${i + 1}: missing title`)
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) problems.push(`#${i + 1} "${a.title}": address "${a.slug}" is not valid`)
  if (!a.body) problems.push(`#${i + 1} "${a.title}": missing body`)
  if (Number.isNaN(Date.parse(a.published_at))) problems.push(`#${i + 1} "${a.title}": published_at is not a date`)
}
if (problems.length) { console.error('Fix these first:\n- ' + problems.join('\n- ')); process.exit(1) }
console.log(`${articles.length} article(s) look valid.`)
if (dry) { console.log('Dry run: nothing was written.'); process.exit(0) }

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL) { console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL.'); process.exit(1) }
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: admin, error: e1 } = await db.from('profiles').select('id').eq('email', ADMIN_EMAIL).eq('role', 'admin').single()
if (e1 || !admin) { console.error(`No active admin with email ${ADMIN_EMAIL}.`); process.exit(1) }

const legacyPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../tools/legacy_articles.json')
const legacy = existsSync(legacyPath) ? JSON.parse(readFileSync(legacyPath, 'utf8')) : []
for (const a of articles) {
  const { error } = await db.rpc('import_article', {
    p_admin: admin.id, p_title: a.title, p_slug: a.slug, p_body: a.body, p_published_at: new Date(a.published_at).toISOString(),
    p_cover: a.cover ?? null, p_tags: a.tags ?? [], p_excerpt: a.excerpt ?? null,
  })
  if (error) { console.error(`FAILED "${a.title}": ${error.message}`); continue }
  console.log(`Imported "${a.title}" -> /blog/${a.slug}/`)
  if (a.old_url && !legacy.some((x) => x.old === a.old_url)) legacy.push({ old: a.old_url, slug: a.slug })
}
writeFileSync(legacyPath, JSON.stringify(legacy, null, 2))
console.log('Redirect map saved to tools/legacy_articles.json. Now run: python3 tools/fetch_posts.py && python3 tools/build.py')
