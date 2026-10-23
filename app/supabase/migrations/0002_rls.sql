-- IMRC blog · step 1 · helpers, grants and Row Level Security
-- Layer 1: table/column privileges (clients can only touch harmless columns).
-- Layer 2: RLS policies (who can see/modify which rows).
-- Layer 3 (0003): every state change goes through SECURITY DEFINER functions that re-check the caller's role.

-- ---------------------------------------------------------------- role helpers
create function public.my_role() returns public.app_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.my_role() in ('reviewer', 'admin'), false)
$$;

create function public.can_write() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.my_role() in ('author', 'trusted_author', 'reviewer', 'admin'), false)
$$;

-- ---------------------------------------------------------------- lock everything down, then grant narrowly
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_revisions enable row level security;
alter table public.post_reviews enable row level security;
alter table public.role_changes enable row level security;

revoke all on public.app_settings, public.profiles, public.posts, public.post_revisions,
              public.post_reviews, public.role_changes from anon, authenticated;

-- profiles: read (RLS limits rows); update ONLY these harmless columns. role / active / application_* are not grantable.
grant select on public.profiles to authenticated;
grant update (display_name, bio, affiliation, avatar_url) on public.profiles to authenticated;

-- posts: status, published_at, submitted_at, reviewer_note and author-change columns are NOT grantable.
grant select on public.posts to anon, authenticated;
grant insert (author_id, title, slug, excerpt, body, cover_image_url, tags) on public.posts to authenticated;
grant update (title, slug, excerpt, body, cover_image_url, tags) on public.posts to authenticated;
grant delete on public.posts to authenticated;

grant select on public.post_revisions, public.post_reviews, public.role_changes to authenticated;
grant select on public.app_settings to authenticated;

-- ---------------------------------------------------------------- policies
create policy profiles_select_self on public.profiles for select to authenticated
  using (id = auth.uid());
create policy profiles_select_staff on public.profiles for select to authenticated
  using (public.is_staff());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() and active) with check (id = auth.uid());

create policy posts_select_published on public.posts for select to anon, authenticated
  using (status = 'published');
create policy posts_select_own on public.posts for select to authenticated
  using (author_id = auth.uid());
create policy posts_select_staff on public.posts for select to authenticated
  using (public.is_staff());
create policy posts_insert_own on public.posts for insert to authenticated
  with check (author_id = auth.uid() and public.can_write());
create policy posts_update_own_editable on public.posts for update to authenticated
  using (author_id = auth.uid() and public.can_write() and status in ('draft', 'changes_requested'))
  with check (author_id = auth.uid());
create policy posts_delete_own_draft on public.posts for delete to authenticated
  using (author_id = auth.uid() and status = 'draft');

create policy revisions_select on public.post_revisions for select to authenticated
  using (author_id = auth.uid() or public.is_staff());

create policy reviews_select on public.post_reviews for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.posts p where p.id = post_reviews.post_id and p.author_id = auth.uid()));

create policy role_changes_select on public.role_changes for select to authenticated
  using (public.is_staff() or user_id = auth.uid());

create policy settings_select on public.app_settings for select to authenticated using (true);

-- ---------------------------------------------------------------- defence in depth
-- Even if a future grant were widened by mistake, a client session still cannot move a post
-- between statuses or change who owns it. Only SECURITY DEFINER functions (current_user = owner) can.
create function public.posts_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.status is distinct from old.status
       or new.author_id is distinct from old.author_id
       or new.published_at is distinct from old.published_at then
      raise exception 'forbidden: post status and ownership are changed only by review functions' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger posts_guard_trg before update on public.posts for each row execute function public.posts_guard();

create function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.application_status is distinct from old.application_status
       or new.email is distinct from old.email then
      raise exception 'forbidden: roles are changed only by review functions' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard_trg before update on public.profiles for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------- public author cards (no emails, no private fields)
create view public.public_authors as
  select p.id, p.display_name, p.bio, p.affiliation, p.avatar_url
  from public.profiles p
  where p.active and exists (select 1 from public.posts x where x.author_id = p.id and x.status = 'published');
grant select on public.public_authors to anon, authenticated;
