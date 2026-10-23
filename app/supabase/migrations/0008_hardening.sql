-- IMRC blog · step 6 · abuse limits
-- An approved author (or a hijacked account) must not be able to fill the database with drafts.
-- Limits are tunable in app_settings and apply to direct table inserts by signed-in clients only
-- (server-side functions such as import_article run as the owner and are exempt).
-- The per-day count covers posts that still exist; deleting does not reset the open-drafts cap.

insert into public.app_settings (key, value) values
  ('max_open_drafts_per_author', 25),    -- drafts + posts with requested changes
  ('drafts_created_per_day', 30)         -- new drafts per rolling 24 hours
on conflict (key) do nothing;

create function public.posts_insert_limits() returns trigger
-- SECURITY INVOKER on purpose: current_user must be the caller's role (a definer function would always see its owner).
language plpgsql set search_path = public, pg_temp as $$
declare open_max int; day_max int; open_now int; day_now int;
begin
  if current_user not in ('anon', 'authenticated') then return new; end if;
  select value into open_max from public.app_settings where key = 'max_open_drafts_per_author';
  select value into day_max from public.app_settings where key = 'drafts_created_per_day';
  select count(*) into open_now from public.posts where author_id = new.author_id and status in ('draft', 'changes_requested');
  select count(*) into day_now from public.posts where author_id = new.author_id and created_at > now() - interval '1 day';
  if open_now >= open_max then raise exception 'rate_limited: at most % open drafts - submit or delete some first', open_max using errcode = '54000'; end if;
  if day_now >= day_max then raise exception 'rate_limited: at most % new drafts per day', day_max using errcode = '54000'; end if;
  return new;
end $$;

create trigger posts_insert_limits before insert on public.posts
  for each row execute function public.posts_insert_limits();

revoke execute on function public.posts_insert_limits() from public, anon;
grant execute on function public.posts_insert_limits() to authenticated;   -- trigger functions run as the caller, so they need execute

-- Found by the step 6 privilege snapshot: Supabase's default privileges also gave anon/authenticated INSERT/UPDATE/DELETE
-- on the public_authors view. A simple view like that is auto-updatable and runs with its owner's rights, so those
-- grants could have let a visitor edit profile rows. Views get read access only.
revoke all on public.public_authors from anon, authenticated;
grant select on public.public_authors to anon, authenticated;
