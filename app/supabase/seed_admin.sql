-- Run ONCE in the Supabase SQL editor (it runs as the database owner, so the function is allowed).
-- 1. Sign up through the site (or Auth > Users > Add user) with the admin's email and confirm the email.
-- 2. Replace the address below and run this file.
select public.bootstrap_admin('admin@culturalresilience.org');
