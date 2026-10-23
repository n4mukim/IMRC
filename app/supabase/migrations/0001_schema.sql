-- IMRC blog · step 1 · schema
-- Roles live ONLY in public.profiles. Nothing a client sends is ever trusted as a role.

create type public.app_role as enum ('pending', 'author', 'trusted_author', 'reviewer', 'admin');
create type public.post_status as enum ('draft', 'pending_review', 'changes_requested', 'rejected', 'published', 'unpublished');
create type public.application_status as enum ('pending', 'approved', 'rejected');
create type public.review_action as enum (
  'submit', 'auto_publish', 'approve', 'request_changes', 'reject', 'unpublish',
  'revision_submit', 'revision_approve', 'revision_request_changes', 'revision_reject'
);

-- ---------------------------------------------------------------- settings (tunable numbers from the brief)
create table public.app_settings (
  key text primary key,
  value int not null
);
insert into public.app_settings (key, value) values
  ('trust_min_approved_posts', 3),      -- "Ready for trust" badge: approved posts needed
  ('trust_window_days', 90),            -- ...with zero rejections in this many days
  ('posts_per_author_per_day', 5);      -- submission rate limit

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  bio text check (bio is null or char_length(bio) <= 1000),
  affiliation text check (affiliation is null or char_length(affiliation) <= 200),
  motivation text check (motivation is null or char_length(motivation) between 50 and 500),
  avatar_url text,
  role public.app_role not null default 'pending',
  application_status public.application_status not null default 'pending',
  application_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

-- Every new auth user becomes a PENDING profile. Role is never read from user metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, display_name, bio, affiliation, motivation)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    nullif(btrim(new.raw_user_meta_data ->> 'bio'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'affiliation'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'motivation'), '')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id),
  title text not null default '' check (char_length(title) <= 200),
  slug text unique check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text check (excerpt is null or char_length(excerpt) <= 400),
  body text not null default '',
  cover_image_url text,
  tags text[] not null default '{}',
  status public.post_status not null default 'draft',
  reviewer_note text,
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_status_idx on public.posts (status, published_at desc);
create index posts_author_idx on public.posts (author_id);

-- Edits to an already-published post by a non-trusted author wait here; the live post stays up.
create table public.post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  title text not null,
  excerpt text,
  body text not null,
  cover_image_url text,
  tags text[] not null default '{}',
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'changes_requested', 'rejected')),
  reviewer_note text,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_pending_revision_per_post
  on public.post_revisions (post_id) where status = 'pending_review';

-- ---------------------------------------------------------------- audit tables (written only by SECURITY DEFINER functions)
create table public.post_reviews (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts (id) on delete cascade,
  revision_id uuid references public.post_revisions (id) on delete set null,
  reviewer_id uuid references public.profiles (id),   -- set when the actor is acting as reviewer/admin
  actor_id uuid not null references public.profiles (id),
  action public.review_action not null,
  note text,
  checklist jsonb,                                     -- CRPO advertising checklist (used from step 4)
  created_at timestamptz not null default now()
);
create index post_reviews_post_idx on public.post_reviews (post_id, created_at);

create table public.role_changes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id),
  changed_by uuid not null references public.profiles (id),
  event text not null default 'role_change' check (event in ('role_change', 'application', 'deactivate', 'reactivate')),
  old_role public.app_role,
  new_role public.app_role,
  note text,
  created_at timestamptz not null default now()
);
create index role_changes_user_idx on public.role_changes (user_id, created_at);

-- ---------------------------------------------------------------- housekeeping
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger posts_touch before update on public.posts for each row execute function public.touch_updated_at();
