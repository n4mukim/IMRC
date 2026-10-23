-- IMRC blog · step 4 · review workflow notifications, audit log, "ready for trust"
-- Replaces the step 1-3 workflow functions with versions that also queue the emails the brief asks for.
-- Rules are unchanged: the caller's role is re-read from profiles, and a reviewer never reviews their own work.

-- ---------------------------------------------------------------- more notification types
alter table public.notifications drop constraint notifications_template_check;
alter table public.notifications add constraint notifications_template_check check (template in (
  'new_application', 'application_approved', 'application_rejected',
  'post_pending', 'post_auto_published',
  'post_approved', 'post_changes_requested', 'post_rejected', 'post_unpublished',
  'revision_pending', 'revision_approved', 'revision_changes_requested', 'revision_rejected'));

create function public._notify_staff(p_template text, p_payload jsonb, p_exclude uuid default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (to_user_id, to_email, template, payload)
  select r.id, r.email, p_template, p_payload
  from public.profiles r
  where r.role in ('reviewer', 'admin') and r.active and (p_exclude is null or r.id <> p_exclude)
$$;

create function public._notify_user(p_user uuid, p_template text, p_payload jsonb) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.notifications (to_user_id, to_email, template, payload)
  select u.id, u.email, p_template, p_payload from public.profiles u where u.id = p_user and u.active
$$;

create function public._post_payload(p_post uuid, p_note text default null, p_edit boolean default false) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('post_id', p.id, 'title', p.title, 'slug', p.slug, 'author_name', a.display_name, 'note', p_note, 'edit', p_edit)
  from public.posts p join public.profiles a on a.id = p.author_id where p.id = p_post
$$;

-- ---------------------------------------------------------------- submit
create or replace function public.submit_post(p_post uuid) returns public.post_status
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
    perform public._notify_staff('post_auto_published', public._post_payload(p.id), auth.uid());   -- so reviewers can spot-check
    return 'published';
  end if;

  update public.posts set status = 'pending_review', submitted_at = now(), reviewer_note = null where id = p.id;
  insert into public.post_reviews (post_id, actor_id, action) values (p.id, auth.uid(), 'submit');
  perform public._notify_staff('post_pending', public._post_payload(p.id), auth.uid());
  return 'pending_review';
end $$;

-- ---------------------------------------------------------------- review a post
create or replace function public.review_post(p_post uuid, p_action public.review_action, p_note text default null, p_checklist jsonb default null)
returns public.post_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.app_role := public.my_role(); p public.posts%rowtype; new_status public.post_status; tpl text;
begin
  if me is null or me not in ('reviewer', 'admin') then perform public._forbidden(); end if;
  if p_action not in ('approve', 'request_changes', 'reject', 'unpublish') then raise exception 'invalid_action'; end if;
  select * into p from public.posts where id = p_post for update;
  if not found then raise exception 'not_found'; end if;

  if p.author_id = auth.uid() and me <> 'admin' and p_action <> 'unpublish' then
    perform public._forbidden('forbidden: a reviewer cannot review their own post');
  end if;
  if p_action in ('request_changes', 'reject', 'unpublish') and btrim(coalesce(p_note, '')) = '' then
    raise exception 'note_required: a note is required for this action';
  end if;

  if p_action = 'approve' then
    if p.status <> 'pending_review' then raise exception 'invalid_state: post is not pending review'; end if;
    new_status := 'published'; tpl := 'post_approved';
    update public.posts set status = 'published', published_at = coalesce(published_at, now()), reviewer_note = p_note where id = p.id;
  elsif p_action = 'request_changes' then
    if p.status <> 'pending_review' then raise exception 'invalid_state: post is not pending review'; end if;
    new_status := 'changes_requested'; tpl := 'post_changes_requested';
    update public.posts set status = new_status, reviewer_note = p_note where id = p.id;
  elsif p_action = 'reject' then
    if p.status <> 'pending_review' then raise exception 'invalid_state: post is not pending review'; end if;
    new_status := 'rejected'; tpl := 'post_rejected';
    update public.posts set status = new_status, reviewer_note = p_note where id = p.id;
  else
    if p.status <> 'published' then raise exception 'invalid_state: only published posts can be unpublished'; end if;
    new_status := 'unpublished'; tpl := 'post_unpublished';
    update public.posts set status = new_status, reviewer_note = p_note where id = p.id;
  end if;

  insert into public.post_reviews (post_id, reviewer_id, actor_id, action, note, checklist)
    values (p.id, auth.uid(), auth.uid(), p_action, p_note, p_checklist);
  if p.author_id <> auth.uid() then perform public._notify_user(p.author_id, tpl, public._post_payload(p.id, p_note)); end if;
  return new_status;
end $$;

-- ---------------------------------------------------------------- edits to published posts
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
    perform public._notify_staff('post_auto_published', public._post_payload(p.id, null, true), auth.uid());
    return null;
  end if;

  if exists (select 1 from public.post_revisions where post_id = p.id and status in ('pending_review', 'changes_requested')) then
    raise exception 'revision_exists: this post already has an edit waiting; update that one instead';
  end if;
  insert into public.post_revisions (post_id, author_id, title, excerpt, body, cover_image_url, tags)
    values (p.id, auth.uid(), p_title, p_excerpt, p_body, p_cover, coalesce(p_tags, '{}')) returning id into rid;
  insert into public.post_reviews (post_id, revision_id, actor_id, action) values (p.id, rid, auth.uid(), 'revision_submit');
  perform public._notify_staff('revision_pending', public._post_payload(p.id, null, true), auth.uid());
  return rid;
end $$;

create or replace function public.update_my_revision(p_revision uuid, p_title text, p_excerpt text, p_body text, p_cover text, p_tags text[])
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
    perform public._notify_staff('revision_pending', public._post_payload(r.post_id, null, true), auth.uid());
  end if;
  return 'pending_review';
end $$;

create or replace function public.review_revision(p_revision uuid, p_action public.review_action, p_note text default null)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.app_role := public.my_role(); r public.post_revisions%rowtype; new_status text; act public.review_action; tpl text;
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
    new_status := 'approved'; act := 'revision_approve'; tpl := 'revision_approved';
  elsif p_action = 'request_changes' then
    new_status := 'changes_requested'; act := 'revision_request_changes'; tpl := 'revision_changes_requested';
  else
    new_status := 'rejected'; act := 'revision_reject'; tpl := 'revision_rejected';
  end if;
  update public.post_revisions set status = new_status, reviewer_note = p_note, decided_by = auth.uid(), decided_at = now() where id = r.id;
  insert into public.post_reviews (post_id, revision_id, reviewer_id, actor_id, action, note)
    values (r.post_id, r.id, auth.uid(), auth.uid(), act, p_note);
  if r.author_id <> auth.uid() then perform public._notify_user(r.author_id, tpl, public._post_payload(r.post_id, p_note, true)); end if;
  return new_status;
end $$;

-- ---------------------------------------------------------------- audit log (staff only): post reviews + role changes, newest first
create function public.audit_log(p_limit int default 50, p_before timestamptz default null)
returns table (kind text, id bigint, created_at timestamptz, actor_name text, subject text, action text, note text)
language sql stable security definer set search_path = public, pg_temp as $$
  select x.kind, x.id, x.created_at, x.actor_name, x.subject, x.action, x.note from (
    select 'post'::text as kind, r.id, r.created_at, a.display_name as actor_name, coalesce(p.title, '') as subject, r.action::text as action, r.note
      from public.post_reviews r join public.profiles a on a.id = r.actor_id join public.posts p on p.id = r.post_id
    union all
    select 'role'::text, c.id, c.created_at, a.display_name, u.display_name,
           c.event || case when c.old_role is distinct from c.new_role then ' · ' || c.old_role || ' → ' || c.new_role else '' end, c.note
      from public.role_changes c join public.profiles a on a.id = c.changed_by join public.profiles u on u.id = c.user_id
  ) x
  where public.is_staff() and (p_before is null or x.created_at < p_before)
  order by x.created_at desc, x.id desc
  limit least(greatest(p_limit, 1), 200)
$$;

-- ---------------------------------------------------------------- "Ready for trust": approved posts and no rejections in the window (numbers live in app_settings)
create function public.trust_candidates()
returns table (user_id uuid, display_name text, approved_posts int, last_approved timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.display_name,
         (count(*) filter (where r.action = 'approve'))::int,
         max(r.created_at) filter (where r.action = 'approve')
  from public.profiles p
  join public.posts po on po.author_id = p.id
  join public.post_reviews r on r.post_id = po.id
  where public.is_staff() and p.role = 'author' and p.active
  group by p.id, p.display_name
  having count(*) filter (where r.action = 'approve') >= (select value from public.app_settings where key = 'trust_min_approved_posts')
     and count(*) filter (where r.action in ('reject', 'revision_reject')
           and r.created_at > now() - make_interval(days => (select value from public.app_settings where key = 'trust_window_days'))) = 0
$$;

-- ---------------------------------------------------------------- permissions
revoke execute on function public._notify_staff(text, jsonb, uuid), public._notify_user(uuid, text, jsonb), public._post_payload(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.audit_log(int, timestamptz), public.trust_candidates() from public, anon;
grant execute on function public.audit_log(int, timestamptz), public.trust_candidates() to authenticated;
grant execute on function public.submit_post(uuid), public.review_post(uuid, public.review_action, text, jsonb),
  public.edit_published_post(uuid, text, text, text, text, text[]), public.update_my_revision(uuid, text, text, text, text, text[]),
  public.review_revision(uuid, public.review_action, text) to authenticated;
revoke execute on function public.submit_post(uuid), public.review_post(uuid, public.review_action, text, jsonb),
  public.edit_published_post(uuid, text, text, text, text, text[]), public.update_my_revision(uuid, text, text, text, text, text[]),
  public.review_revision(uuid, public.review_action, text) from anon, public;
