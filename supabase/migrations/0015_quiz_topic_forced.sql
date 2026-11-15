-- 0015_quiz_topic_forced.sql
-- Task: Cho phep giao vien/admin khoa cung 1 chu de thi duy nhat cho moi khoi
-- (hoc sinh khong duoc tu chon chu de nua, cac chu de active khac bi an)

-- 1. Them cot is_forced tren quiz_topics
alter table public.quiz_topics
    add column if not exists is_forced boolean not null default false;

-- 2. Dam bao toi da 1 chu de co is_forced = true cho moi khoi tai 1 thoi diem
--    (unique partial index: chi ap dung tren cac dong is_forced = true)
create unique index if not exists idx_quiz_topics_forced_per_grade
    on public.quiz_topics (grade)
    where is_forced = true;

-- Luu y: khong can them policy RLS moi - cot is_forced nam tren bang quiz_topics
-- da duoc bao ve boi policy "quiz_topics_admin_write" (0006_rls_teacher_admin.sql),
-- ap dung cho toan bo cac cot khi update/insert/delete.
