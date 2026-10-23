-- IMRC blog · step 2 · sign-up, e-mail verification, author applications, notification outbox
--
-- Flow: person signs up (form + CAPTCHA, enforced by Supabase Auth) -> verifies e-mail ->
-- reviewers are notified -> a reviewer approves (becomes author) or declines (stays blocked, optional note e-mailed).
-- Reviewers are only bothered about VERIFIED applications, so bot sign-ups never reach the queue.

alter table public.profiles
  add column email_verified boolean not null default false,
  add column verified_at timestamptz;

-- ---------------------------------------------------------------- outbox (read/written only by functions + service role)
create table public.notifications (
  id bigint generated always as identity primary key,
  to_user_id uuid references public.profiles (id) on delete set null,
  to_email text not null,
  template text not null check (template in ('new_application', 'application_approved', 'application_rejected')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts int not null default 0,
  last_error text
);
create index notifications_unsent_idx on public.notifications (created_at) where sent_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;   -- no policies: clients cannot read or write it

-- ---------------------------------------------------------------- notify every active reviewer/admin
create function public._notify_reviewers_of_application(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.profiles%rowtype;
begin
  select * into a from public.profiles where id = p_user;
  insert into public.notifications (to_user_id, to_email, template, payload)
  select r.id, r.email, 'new_application',
         jsonb_build_object('applicant_id', a.id, 'display_name', a.display_name, 'affiliation', a.affiliation)
  from public.profiles r where r.role in ('reviewer', 'admin') and r.active;
end $$;

-- ---------------------------------------------------------------- signup + verification triggers
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, display_name, bio, affiliation, motivation, email_verified, verified_at)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    nullif(btrim(new.raw_user_meta_data ->> 'bio'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'affiliation'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'motivation'), ''),
    new.email_confirmed_at is not null,
    new.email_confirmed_at
  );
  if new.email_confirmed_at is not null then perform public._notify_reviewers_of_application(new.id); end if;
  return new;
end $$;

create function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles set email_verified = true, verified_at = new.email_confirmed_at
      where id = new.id and not email_verified and role = 'pending';
    if found then perform public._notify_reviewers_of_application(new.id); end if;
  end if;
  return new;
end $$;

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

-- Verification state is never client-writable (the column grant never included it; the guard also checks).
create or replace function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.application_status is distinct from old.application_status
       or new.application_note is distinct from old.application_note
       or new.email_verified is distinct from old.email_verified
       or new.verified_at is distinct from old.verified_at
       or new.email is distinct from old.email then
      raise exception 'forbidden: roles are changed only by review functions' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Applicants may complete their own application (the 50-500 character check still applies).
grant update (motivation) on public.profiles to authenticated;

-- ---------------------------------------------------------------- reviewer decision (replaces the step 1 version)
create or replace function public.review_application(p_user uuid, p_approve boolean, p_note text default null)
returns public.app_role
language plpgsql security definer set search_path = public, pg_temp as $$
declare me public.app_role := public.my_role(); t public.profiles%rowtype;
begin
  if me is null or me not in ('reviewer', 'admin') then perform public._forbidden(); end if;
  select * into t from public.profiles where id = p_user for update;
  if not found then raise exception 'not_found'; end if;
  if t.role <> 'pending' then raise exception 'invalid_state: only pending accounts have applications'; end if;
  if not t.active then raise exception 'invalid_state: account is deactivated'; end if;
  if not t.email_verified then raise exception 'invalid_state: the applicant has not verified their e-mail yet'; end if;

  if p_approve then
    if btrim(coalesce(t.bio, '')) = '' or btrim(coalesce(t.affiliation, '')) = '' or t.motivation is null then
      raise exception 'incomplete_application: bio, affiliation and motivation are required';
    end if;
    update public.profiles set role = 'author', application_status = 'approved', application_note = p_note where id = p_user;
    insert into public.role_changes (user_id, changed_by, event, old_role, new_role, note)
      values (p_user, auth.uid(), 'application', 'pending', 'author', p_note);
    insert into public.notifications (to_user_id, to_email, template, payload)
      values (t.id, t.email, 'application_approved', jsonb_build_object('display_name', t.display_name, 'note', p_note));
    return 'author';
  else
    update public.profiles set application_status = 'rejected', application_note = p_note where id = p_user;
    insert into public.role_changes (user_id, changed_by, event, old_role, new_role, note)
      values (p_user, auth.uid(), 'application', 'pending', 'pending', coalesce(p_note, 'rejected'));
    insert into public.notifications (to_user_id, to_email, template, payload)
      values (t.id, t.email, 'application_rejected', jsonb_build_object('display_name', t.display_name, 'note', p_note));
    return 'pending';
  end if;
end $$;

revoke execute on function public._notify_reviewers_of_application(uuid), public.handle_user_confirmed() from public, anon, authenticated;
revoke execute on function public.review_application(uuid, boolean, text) from public, anon;
grant execute on function public.review_application(uuid, boolean, text) to authenticated;
