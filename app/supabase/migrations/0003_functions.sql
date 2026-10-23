-- IMRC blog · step 1 · workflow functions
-- Every state change is a SECURITY DEFINER function that re-reads the caller's role from public.profiles.
-- Clients call them with supabase.rpc(...). The role is never passed in.

create function public._forbidden(msg text default 'forbidden') returns void
language plpgsql as $$ begin raise exception '%', msg using errcode = '42501'; end $$;

-- ---------------------------------------------------------------- author applications
create function public.review_application(p_user uuid, p_approve boolean, p_note text default null)
returns public.app_role
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.app_role := public.my_role(); t public.profiles%rowtype;
begin
  if me is null or me not in ('reviewer', 'admin') then perform public._forbidden(); end if;
  select * into t from public.profiles where id = p_user for update;
  if not found then raise exception 'not_found'; end if;
  if t.role <> 'pending' then raise exception 'invalid_state: only pending accounts have applications'; end if;
  if not t.active then raise exception 'invalid_state: account is deactivated'; end if;

  if p_approve then
    update public.profiles set role = 'author', application_status = 'approved', application_note = p_note where id = p_user;
    insert into public.role_changes (user_id, changed_by, event, old_role, new_role, note)
      values (p_user, auth.uid(), 'application', 'pending', 'author', p_note);
    return 'author';
  else
    update public.profiles set application_status = 'rejected', application_note = p_note where id = p_user;
    insert into public.role_changes (user_id, changed_by, event, old_role, new_role, note)
      values (p_user, auth.uid(), 'application', 'pending', 'pending', coalesce(p_note, 'rejected'));
    return 'pending';
  end if;
end $$;

-- ---------------------------------------------------------------- promotion / demotion / deactivation
create function public.set_user_role(p_user uuid, p_role public.app_role, p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.app_role := public.my_role(); t public.profiles%rowtype; admins int;
begin
  if me is null or me not in ('reviewer', 'admin') then perform public._forbidden(); end if;
  select * into t from public.profiles where id = p_user for update;
  if not found then raise exception 'not_found'; end if;
  if not t.active then raise exception 'invalid_state: account is deactivated'; end if;
  if t.id = auth.uid() then perform public._forbidden('forbidden: you cannot change your own role'); end if;
  if t.role = p_role then return; end if;

  if me = 'reviewer' then
    -- reviewers may only move people between author and trusted_author
    if t.role not in ('author', 'trusted_author') or p_role not in ('author', 'trusted_author') then
      perform public._forbidden('forbidden: reviewers can only switch author and trusted_author');
    end if;
  else
    if t.role = 'admin' then
      select count(*) into admins from public.profiles where role = 'admin' and active;
      if admins <= 1 then raise exception 'invalid_state: cannot demote the last admin'; end if;
    end if;
    if t.role = 'pending' and p_role <> 'pending' then
      update public.profiles set application_status = 'approved' where id = p_user;
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user;
  insert into public.role_changes (user_id, changed_by, event, old_role, new_role, note)
    values (p_user, auth.uid(), 'role_change', t.role, p_role, p_note);
end $$;

create function public.set_user_active(p_user uuid, p_active boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.app_role := public.my_role(); t public.profiles%rowtype;
begin
  if me is null or me not in ('reviewer', 'admin') then perform public._forbidden(); end if;
  select * into t from public.profiles where id = p_user for update;
  if not found then raise exception 'not_found'; end if;
  if t.id = auth.uid() then perform public._forbidden('forbidden: you cannot deactivate yourself'); end if;
  if me = 'reviewer' and t.role in ('reviewer', 'admin') then
    perform public._forbidden('forbidden: reviewers cannot deactivate reviewers or admins');
  end if;
  update public.profiles set active = p_active where id = p_user;
  insert into public.role_changes (user_id, changed_by, event, old_role, new_role, note)
    values (p_user, auth.uid(), case when p_active then 'reactivate' else 'deactivate' end, t.role, t.role, p_note);
end $$;

-- ---------------------------------------------------------------- posts: submit
create function public.submit_post(p_post uuid) returns public.post_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.app_role := public.my_role(); p public.posts%rowtype; today_count int; lim int;
begin
  if auth.uid() is null or me is null or me = 'pending' then perform public._forbidden(); end if;
  select * into p from public.posts where id = p_post for update;
  if not found or p.author_id <> auth.uid() then perform public._forbidden(); end if;
  if p.status not in ('draft', 'changes_requested') then raise exception 'invalid_state: only drafts and posts with requested changes can be submitted'; end if;
  if btrim(p.title) = '' or btrim(p.body) = '' or p.slug is null then raise exception 'incomplete_post: title, slug and body are required'; end if;

  select value into lim from public.app_settings where key = 'posts_per_author_per_day';
  select count(*) into today_count from public.post_reviews
    where actor_id = auth.uid() and action in ('submit', 'auto_publish') and created_at > now() - interval '1 day';
  if today_count >= lim then raise exception 'rate_limited: at most % submissions per day', lim using errcode = '54000'; end if;

  if me in ('trusted_author', 'admin') then
    update public.posts set status = 'published', published_at = coalesce(published_at, now()), submitted_at = now(), reviewer_note = null where id = p.id;
    insert into public.post_reviews (post_id, actor_id, action) values (p.id, auth.uid(), 'auto_publish');
    return 'published';
  end if;

  -- author and reviewer: always reviewed (a reviewer's own post needs a DIFFERENT reviewer or an admin)
  update public.posts set status = 'pending_review', submitted_at = now(), reviewer_note = null where id = p.id;
  insert into public.post_reviews (post_id, actor_id, action) values (p.id, auth.uid(), 'submit');
  return 'pending_review';
end $$;

-- ---------------------------------------------------------------- posts: review
create function public.review_post(p_post uuid, p_action public.review_action, p_note text default null, p_checklist jsonb default null)
returns public.post_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.app_role := public.my_role(); p public.posts%rowtype; new_status public.post_status;
begin
  if me is null or me not in ('reviewer', 'admin') then perform public._forbidden(); end if;
  if p_action not in ('approve', 'request_changes', 'reject', 'unpublish') then raise exception 'invalid_action'; end if;
  select * into p from public.posts where id = p_post for update;
  if not found then raise exception 'not_found'; end if;

  -- a reviewer can NEVER review (approve / request changes / reject) their own post. Only an admin may.
  if p.author_id = auth.uid() and me <> 'admin' and p_action <> 'unpublish' then
    perform public._forbidden('forbidden: a reviewer cannot review their own post');
  end if;

  if p_action in ('request_changes', 'reject', 'unpublish') and btrim(coalesce(p_note, '')) = '' then
    raise exception 'note_required: a note is required for this action';
  end if;

  if p_action = 'approve' then
    if p.status <> 'pending_review' then raise exception 'invalid_state: post is not pending review'; end if;
    new_status := 'published';
    update public.posts set status = 'published', published_at = coalesce(published_at, now()), reviewer_note = p_note where id = p.id;
  elsif p_action = 'request_changes' then
    if p.status <> 'pending_review' then raise exception 'invalid_state: post is not pending review'; end if;
    new_status := 'changes_requested';
    update public.posts set status = new_status, reviewer_note = p_note where id = p.id;
  elsif p_action = 'reject' then
    if p.status <> 'pending_review' then raise exception 'invalid_state: post is not pending review'; end if;
    new_status := 'rejected';
    update public.posts set status = new_status, reviewer_note = p_note where id = p.id;
  else
    if p.status <> 'published' then raise exception 'invalid_state: only published posts can be unpublished'; end if;
    new_status := 'unpublished';
    update public.posts set status = new_status, reviewer_note = p_note where id = p.id;
  end if;

  insert into public.post_reviews (post_id, reviewer_id, actor_id, action, note, checklist)
    values (p.id, auth.uid(), auth.uid(), p_action, p_note, p_checklist);
  return new_status;
end $$;

-- ---------------------------------------------------------------- posts: edit an already-published post
-- trusted_author / admin: change goes live at once.  author / reviewer: becomes a pending revision; live version stays up.
create function public.edit_published_post(p_post uuid, p_title text, p_excerpt text, p_body text, p_cover text, p_tags text[])
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

  insert into public.post_revisions (post_id, author_id, title, excerpt, body, cover_image_url, tags)
    values (p.id, auth.uid(), p_title, p_excerpt, p_body, p_cover, coalesce(p_tags, '{}')) returning id into rid;
  insert into public.post_reviews (post_id, revision_id, actor_id, action) values (p.id, rid, auth.uid(), 'revision_submit');
  return rid;
end $$;

create function public.review_revision(p_revision uuid, p_action public.review_action, p_note text default null)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.app_role := public.my_role(); r public.post_revisions%rowtype; new_status text; act public.review_action;
begin
  if me is null or me not in ('reviewer', 'admin') then perform public._forbidden(); end if;
  if p_action not in ('approve', 'request_changes', 'reject') then raise exception 'invalid_action'; end if;
  select * into r from public.post_revisions where id = p_revision for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'pending_review' then raise exception 'invalid_state: revision is not pending'; end if;
  if r.author_id = auth.uid() and me <> 'admin' then
    perform public._forbidden('forbidden: a reviewer cannot review their own revision');
  end if;
  if p_action <> 'approve' and btrim(coalesce(p_note, '')) = '' then raise exception 'note_required: a note is required for this action'; end if;

  if p_action = 'approve' then
    update public.posts set title = r.title, excerpt = r.excerpt, body = r.body, cover_image_url = r.cover_image_url, tags = r.tags where id = r.post_id;
    new_status := 'approved'; act := 'revision_approve';
  elsif p_action = 'request_changes' then
    new_status := 'changes_requested'; act := 'revision_request_changes';
  else
    new_status := 'rejected'; act := 'revision_reject';
  end if;
  update public.post_revisions set status = new_status, reviewer_note = p_note, decided_by = auth.uid(), decided_at = now() where id = r.id;
  insert into public.post_reviews (post_id, revision_id, reviewer_id, actor_id, action, note)
    values (r.post_id, r.id, auth.uid(), auth.uid(), act, p_note);
  return new_status;
end $$;

-- ---------------------------------------------------------------- first admin (NOT callable by clients)
create function public.bootstrap_admin(p_email text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.profiles%rowtype;
begin
  select * into t from public.profiles where lower(email) = lower(p_email);
  if not found then raise exception 'no profile with that email: sign up and verify the email first'; end if;
  update public.profiles set role = 'admin', application_status = 'approved', active = true where id = t.id;
  insert into public.role_changes (user_id, changed_by, event, old_role, new_role, note)
    values (t.id, t.id, 'role_change', t.role, 'admin', 'bootstrap_admin');
end $$;

-- ---------------------------------------------------------------- execute permissions
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.my_role(), public.is_staff(), public.can_write() to anon, authenticated;
grant execute on function
  public.review_application(uuid, boolean, text),
  public.set_user_role(uuid, public.app_role, text),
  public.set_user_active(uuid, boolean, text),
  public.submit_post(uuid),
  public.review_post(uuid, public.review_action, text, jsonb),
  public.edit_published_post(uuid, text, text, text, text, text[]),
  public.review_revision(uuid, public.review_action, text)
to authenticated;
-- bootstrap_admin stays executable only by the database owner / service role.
