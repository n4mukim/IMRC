-- Run once in the Supabase SQL editor AFTER the three migrations. Creates the public image bucket for blog posts.
-- Images only, 5 MB max. Writers can upload into a folder named after their own user id; everyone can read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "blog images are public" on storage.objects for select
  using (bucket_id = 'blog-images');

create policy "writers upload into their own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'blog-images' and (storage.foldername(name))[1] = auth.uid()::text and public.can_write());

create policy "writers delete their own images" on storage.objects for delete to authenticated
  using (bucket_id = 'blog-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Step 6: cap how many images one account can hold (replaces the insert policy above).
drop policy if exists "writers upload into their own folder" on storage.objects;
create policy "writers upload into their own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'blog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_write()
    and (select count(*) from storage.objects o where o.bucket_id = 'blog-images' and (storage.foldername(o.name))[1] = auth.uid()::text) < 200
  );
