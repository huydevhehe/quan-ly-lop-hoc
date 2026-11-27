-- 0033_strict_per_account_isolation.sql
-- Theo yeu cau: BAT KY thu gi 1 tai khoan tao ra thi tai khoan khac (ke ca admin) KHONG
-- BAO GIO duoc thay - ap dung cho lop hoc, hoc lieu so/giai tri/tien ich (resources), va
-- ngan hang cau hoi trac nghiem (quiz_topics/quiz_questions). Rieng ngan hang nhan xet
-- (comment_bank) la 1 bang cau hinh dung chung theo khoi (khong co khai niem "nguoi tao"),
-- khong doi theo yeu cau nay - da trao doi rieng voi nguoi dung.
--
-- Du lieu cu khong co nguoi so huu (created_by null) duoc gan het cho tai khoan dang dung
-- that (ngocdu@qllh.edu.vn) theo dung yeu cau, de khong bi "mo coi" sau khi sieet RLS.

-- 1. is_class_owner(): bo "is_admin() OR" - ke ca admin cung chi duoc xem/sua lop do CHINH
-- minh tao, khong con duoc xem lop cua giao vien khac qua ham nay nua. Cascade tu dong sang
-- moi bang dung ham nay: students, scores, attendance, weekly_evaluations, class_week_dates,
-- quiz_sessions, quiz_results.
create or replace function public.is_class_owner(p_class_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
    select exists (
        select 1 from public.classes
        where id = p_class_id and created_by = auth.uid()
    );
$$;

-- 2. classes: bo "is_admin() OR" khoi select/update/delete/insert.
drop policy if exists "classes_teacher_select" on public.classes;
create policy "classes_teacher_select" on public.classes
    for select to authenticated
    using (created_by = auth.uid());

drop policy if exists "classes_teacher_update" on public.classes;
create policy "classes_teacher_update" on public.classes
    for update to authenticated
    using (created_by = auth.uid())
    with check (created_by = auth.uid());

drop policy if exists "classes_teacher_delete" on public.classes;
create policy "classes_teacher_delete" on public.classes
    for delete to authenticated
    using (created_by = auth.uid());

drop policy if exists "classes_teacher_insert" on public.classes;
create policy "classes_teacher_insert" on public.classes
    for insert to authenticated
    with check (created_by = auth.uid());

-- 3. quiz_topics: them cot created_by, gan du lieu cu, sieet chinh sach ve rieng tung tai khoan.
alter table public.quiz_topics add column if not exists created_by uuid references public.profiles(id) on delete set null;
update public.quiz_topics set created_by = '4cf68211-6dfb-4451-b1fd-3f0f1d856551' where created_by is null;

drop policy if exists "quiz_topics_select" on public.quiz_topics;
create policy "quiz_topics_select" on public.quiz_topics
    for select to authenticated
    using (created_by = auth.uid());

drop policy if exists "quiz_topics_anon_select" on public.quiz_topics;
create policy "quiz_topics_anon_select" on public.quiz_topics
    for select to authenticated
    using (
        is_anon_session() and is_active = true
        and created_by = (select created_by from public.classes where id = current_room_class_id())
    );

drop policy if exists "quiz_topics_staff_insert" on public.quiz_topics;
create policy "quiz_topics_staff_insert" on public.quiz_topics
    for insert to authenticated
    with check (created_by = auth.uid());

drop policy if exists "quiz_topics_staff_update" on public.quiz_topics;
create policy "quiz_topics_staff_update" on public.quiz_topics
    for update to authenticated
    using (created_by = auth.uid())
    with check (created_by = auth.uid());

drop policy if exists "quiz_topics_staff_delete" on public.quiz_topics;
create policy "quiz_topics_staff_delete" on public.quiz_topics
    for delete to authenticated
    using (created_by = auth.uid());

-- 4. quiz_questions: gan du lieu cu, bo "OR is_admin()", chi con created_by = auth.uid().
update public.quiz_questions set created_by = '4cf68211-6dfb-4451-b1fd-3f0f1d856551' where created_by is null;

drop policy if exists "quiz_questions_select" on public.quiz_questions;
create policy "quiz_questions_select" on public.quiz_questions
    for select to authenticated
    using (created_by = auth.uid());

drop policy if exists "quiz_questions_teacher_insert" on public.quiz_questions;
create policy "quiz_questions_teacher_insert" on public.quiz_questions
    for insert to authenticated
    with check (created_by = auth.uid());

drop policy if exists "quiz_questions_teacher_update" on public.quiz_questions;
create policy "quiz_questions_teacher_update" on public.quiz_questions
    for update to authenticated
    using (created_by = auth.uid())
    with check (created_by = auth.uid());

drop policy if exists "quiz_questions_teacher_delete" on public.quiz_questions;
create policy "quiz_questions_teacher_delete" on public.quiz_questions
    for delete to authenticated
    using (created_by = auth.uid());

-- 5. resources (hoc lieu so / giai tri / tien ich): gan du lieu cu, bo chia se theo school_id,
-- chi con rieng tung tai khoan tao. Hoc sinh (anon) chi thay tai nguyen cua DUNG giao vien
-- chu lop minh dang vao, khong con thay het tai nguyen cua ca truong nhu truoc.
update public.resources set created_by = '4cf68211-6dfb-4451-b1fd-3f0f1d856551' where created_by is null;

drop policy if exists "resources_select" on public.resources;
create policy "resources_select" on public.resources
    for select to authenticated
    using (created_by = auth.uid());

drop policy if exists "resources_anon_select" on public.resources;
create policy "resources_anon_select" on public.resources
    for select to authenticated
    using (
        is_anon_session() and is_active = true
        and created_by = (select created_by from public.classes where id = current_room_class_id())
    );

drop policy if exists "resources_teacher_insert" on public.resources;
create policy "resources_teacher_insert" on public.resources
    for insert to authenticated
    with check (created_by = auth.uid());

drop policy if exists "resources_teacher_update" on public.resources;
create policy "resources_teacher_update" on public.resources
    for update to authenticated
    using (created_by = auth.uid())
    with check (created_by = auth.uid());

drop policy if exists "resources_teacher_delete" on public.resources;
create policy "resources_teacher_delete" on public.resources
    for delete to authenticated
    using (created_by = auth.uid());
