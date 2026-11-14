-- 0012_resource_images_storage_policy.sql
-- Bucket storage anh nen game va hoc lieu so

insert into storage.buckets (id, name, public)
values ('resource-images', 'resource-images', true)
on conflict (id) do update set public = true;

-- 1. Cho phep moi nguoi (ke ca hoc sinh / an danh) xem anh cong khai
create policy "Cho phep xem anh resource cong khai"
on storage.objects for select
to public
using (bucket_id = 'resource-images');

-- 2. Chi giao vien / admin da dang nhap moi duoc upload anh
create policy "Cho phep user dang nhap upload anh resource"
on storage.objects for insert
to authenticated
with check (bucket_id = 'resource-images');

-- 3. Cho phep user dang nhap xoa anh resource
create policy "Cho phep user dang nhap xoa anh resource"
on storage.objects for delete
to authenticated
using (bucket_id = 'resource-images');
