-- 0011_quiz_questions_image_storage_policy.sql
-- Tạo bucket lưu trữ ảnh câu hỏi và thiết lập chính sách bảo mật

insert into storage.buckets (id, name, public) 
values ('quiz-images', 'quiz-images', true)
on conflict (id) do nothing;

create policy "quiz_images_teacher_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'quiz-images');

create policy "quiz_images_public_read" on storage.objects
  for select to public
  using (bucket_id = 'quiz-images');
