-- IMRC blog · step 3 · editor safety nets and revision editing
-- The browser already sanitises what it renders. These rules protect the database from a hand-made API call.

create function public._unsafe_html(h text) returns boolean language sql immutable as $$
  select coalesce(
       h ~* '<\s*(script|iframe|object|embed|style|form|link|meta|base|svg|math|input|button|textarea)'
    or h ~* '\son[a-z]+\s*='
    or h ~* 'javascript\s*:'
    or h ~* 'data\s*:\s*text/html'
    or h ~* '<\s*img[^>]+src\s*=\s*(?!["'']?\s*(?:https://|data:image/(?:png|jpe?g|webp|gif);base64,|/))', false)
$$;

create function public._validate_post_content() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare t text;
begin
  if char_length(new.body) > 200000 then raise exception 'too_long: a post can be at most 200,000 characters' using errcode = '22001'; end if;
  if public._unsafe_html(new.body) then raise exception 'unsafe_html: scripts, event handlers and embedded objects are not allowed' using errcode = '22023'; end if;
  if new.cover_image_url is not null and new.cover_image_url !~ '^https://' then raise exception 'invalid_cover: the cover image must be an https address' using errcode = '22023'; end if;
  if coalesce(array_length(new.tags, 1), 0) > 6 then raise exception 'invalid_tags: at most 6 topics' using errcode = '22023'; end if;
  foreach t in array coalesce(new.tags, '{}') loop
    if btrim(t) = '' or char_length(t) > 30 then raise exception 'invalid_tags: each topic must be 1 to 30 characters' using errcode = '22023'; end if;
  end loop;
  return new;
end $$;

create trigger posts_validate before insert or update on public.posts for each row execute function public._validate_post_content();
create trigger revisions_validate before insert or update on public.post_revisions for each row execute function public._validate_post_content();

-- A post can have only ONE open revision (pending or sent back). Replaces the step 3 behaviour of silently stacking them.
drop index if exists public.one_pending_revision_per_post;
create unique index one_open_revision_per_post on public.post_revisions (post_id) where status in ('pending_review', 'changes_requested');

create or replace function public.edit_published_post(p_post uuid, p_title text, p_excerpt text, p_body text, p_cover text, p_tags text[])
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.app_role := public.my_role(); p public.posts%rowtype; rid uuid;
begin
  if auth.uid() is null or me is null or me = 'pending' then perform public._forbidden(); end if;
  select * into p from public.posts where id = p_post for update;
  if not found or p.author_id <> auth.uid() then perform public._forbidden(); end if;
  if p.status <> 'published' then raise exception 'invalid_state: only published posts are edited this way'; end if;
  if btrim(coalesce(p_title, '')) = '' or btrim(coalesce(p_body, '')) = '' then raise exception 'incomplete_post'; end if;

  if me in ('trusted_author', 'admin') then
    update public.posts set title = p_title, excerpt = p_excerpt, body = p_body, cover_image_url = p_cover, tags = coalesce(p_tags, '{}') where id = p.id;
    insert into public.post_reviews (post_id, actor_id, action, note) values (p.id, auth.uid(), 'auto_publish', 'edit');
    return null;
  end if;

  if exists (select 1 from public.post_revisions where post_id = p.id and status in ('pending_review', 'changes_requested')) then
    raise exception 'revision_exists: this post already has an edit waiting; update that one instead';
  end if;
  insert into public.post_revisions (post_id, author_id, title, excerpt, body, cover_image_url, tags)
    values (p.id, auth.uid(), p_title, p_excerpt, p_body, p_cover, coalesce(p_tags, '{}')) returning id into rid;
  insert into public.post_reviews (post_id, revision_id, actor_id, action) values (p.id, rid, auth.uid(), 'revision_submit');
  return rid;
end $$;

-- Change an edit that is still waiting (or was sent back). Sending it back in puts it in the review queue again.
create function public.update_my_revision(p_revision uuid, p_title text, p_excerpt text, p_body text, p_cover text, p_tags text[])
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.app_role := public.my_role(); r public.post_revisions%rowtype;
begin
  if auth.uid() is null or me is null or me = 'pending' then perform public._forbidden(); end if;
  select * into r from public.post_revisions where id = p_revision for update;
  if not found or r.author_id <> auth.uid() then perform public._forbidden(); end if;
  if r.status not in ('pending_review', 'changes_requested') then raise exception 'invalid_state: this edit was already decided'; end if;
  if btrim(coalesce(p_title, '')) = '' or btrim(coalesce(p_body, '')) = '' then raise exception 'incomplete_post'; end if;
  update public.post_revisions
     set title = p_title, excerpt = p_excerpt, body = p_body, cover_image_url = p_cover, tags = coalesce(p_tags, '{}'),
         status = 'pending_review', reviewer_note = case when r.status = 'changes_requested' then r.reviewer_note else null end
   where id = r.id;
  if r.status = 'changes_requested' then
    insert into public.post_reviews (post_id, revision_id, actor_id, action) values (r.post_id, r.id, auth.uid(), 'revision_submit');
  end if;
  return 'pending_review';
end $$;

revoke execute on function public._unsafe_html(text), public._validate_post_content() from public, anon, authenticated;
revoke execute on function public.edit_published_post(uuid, text, text, text, text, text[]), public.update_my_revision(uuid, text, text, text, text, text[]) from public, anon;
grant execute on function public.edit_published_post(uuid, text, text, text, text, text[]), public.update_my_revision(uuid, text, text, text, text, text[]) to authenticated;
