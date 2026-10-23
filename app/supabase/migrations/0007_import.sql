-- IMRC blog · step 5 · reserved addresses and the article importer
-- 1. A post can never take the address of a page that already lives under /blog/ (write, post, join, review, dashboard, feed).
-- 2. import_article() lets an admin bring old articles in as PUBLISHED posts with their original dates. It is NOT callable
--    from the browser: run it with the service-role key (see scripts/import-articles.mjs) or in the SQL editor.

alter table public.posts add constraint posts_slug_not_reserved
  check (slug is null or slug not in ('write', 'post', 'join', 'review', 'dashboard', 'feed', 'index'));

create function public.import_article(
  p_admin uuid, p_title text, p_slug text, p_body text, p_published_at timestamptz,
  p_cover text default null, p_tags text[] default '{}', p_excerpt text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid;
begin
  if not exists (select 1 from public.profiles where id = p_admin and role = 'admin' and active) then
    raise exception 'import_article: p_admin must be an active admin';
  end if;
  select id into pid from public.posts where slug = p_slug;
  if found then return pid; end if;                  -- running the import twice is harmless

  insert into public.posts (author_id, title, slug, excerpt, body, cover_image_url, tags, status, published_at, submitted_at)
  values (p_admin, p_title, p_slug, p_excerpt, p_body, p_cover, coalesce(p_tags, '{}'), 'published', p_published_at, p_published_at)
  returning id into pid;                              -- the content-safety trigger still runs on this insert

  insert into public.post_reviews (post_id, actor_id, action, note) values (pid, p_admin, 'auto_publish', 'import');
  return pid;
end $$;

revoke execute on function public.import_article(uuid, text, text, text, timestamptz, text, text[], text) from public, anon, authenticated;
