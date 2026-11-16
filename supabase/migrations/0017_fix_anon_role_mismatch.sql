-- 0017_fix_anon_role_mismatch.sql
-- BUG NGHIEM TRONG: toan bo policy "anon" o 0007_rls_student_anon.sql dung sai role.
-- Supabase Anonymous Auth (signInAnonymously) tao ra 1 session THAT voi JWT
-- role = 'authenticated' (co claim is_anonymous = true), KHONG PHAI role 'anon'
-- (role 'anon' chi danh cho request KHONG co JWT nao ca). Vi vay moi policy
-- "to anon" trong 0007 chua tung ap dung duoc cho hoc sinh that -> hoc sinh
-- chua bao gio insert duoc room_sessions, xem duoc classes/students/diem/..
-- qua cac policy nay. Day la nguyen nhan goc cua loi "Ma phong khong dung" /
-- hoc sinh khong lam duoc gi sau khi vao phong.
--
-- Fix: doi tat ca cac policy nay sang "to authenticated" + kiem tra claim
-- is_anonymous = true, de chi ap dung cho phien hoc sinh an danh (khong cap
-- them quyen cho giao vien/admin dang nhap that, ho da co policy rieng).

create or replace function public.is_anon_session()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

-- 1. classes
drop policy if exists "classes_anon_select" on public.classes;
create policy "classes_anon_select" on public.classes
    for select
    to authenticated
    using (public.is_anon_session() and id = public.current_room_class_id());

-- 2. students
drop policy if exists "students_anon_select" on public.students;
create policy "students_anon_select" on public.students
    for select
    to authenticated
    using (public.is_anon_session() and class_id = public.current_room_class_id());

-- 3. attendance
drop policy if exists "attendance_anon_select" on public.attendance;
create policy "attendance_anon_select" on public.attendance
    for select
    to authenticated
    using (
        public.is_anon_session() and exists (
            select 1 from public.students s
            where s.id = attendance.student_id and s.class_id = public.current_room_class_id()
        )
    );

-- 4. scores
drop policy if exists "scores_anon_select" on public.scores;
create policy "scores_anon_select" on public.scores
    for select
    to authenticated
    using (
        public.is_anon_session() and exists (
            select 1 from public.students s
            where s.id = scores.student_id and s.class_id = public.current_room_class_id()
        )
    );

-- 5. weekly_evaluations
drop policy if exists "weekly_evaluations_anon_select" on public.weekly_evaluations;
create policy "weekly_evaluations_anon_select" on public.weekly_evaluations
    for select
    to authenticated
    using (
        public.is_anon_session() and exists (
            select 1 from public.students s
            where s.id = weekly_evaluations.student_id and s.class_id = public.current_room_class_id()
        )
    );

-- 6/7. room_sessions
drop policy if exists "room_sessions_anon_select" on public.room_sessions;
create policy "room_sessions_anon_select" on public.room_sessions
    for select
    to authenticated
    using (public.is_anon_session() and auth_uid = auth.uid());

drop policy if exists "room_sessions_anon_insert" on public.room_sessions;
create policy "room_sessions_anon_insert" on public.room_sessions
    for insert
    to authenticated
    with check (public.is_anon_session() and auth_uid = auth.uid());

-- 8. quiz_topics
drop policy if exists "quiz_topics_anon_select" on public.quiz_topics;
create policy "quiz_topics_anon_select" on public.quiz_topics
    for select
    to authenticated
    using (public.is_anon_session() and is_active = true);

-- 9/10. quiz_sessions
drop policy if exists "quiz_sessions_anon_insert" on public.quiz_sessions;
create policy "quiz_sessions_anon_insert" on public.quiz_sessions
    for insert
    to authenticated
    with check (
        public.is_anon_session()
        and (created_by_auth_uid is null or created_by_auth_uid = auth.uid())
    );

drop policy if exists "quiz_sessions_anon_select" on public.quiz_sessions;
create policy "quiz_sessions_anon_select" on public.quiz_sessions
    for select
    to authenticated
    using (public.is_anon_session() and created_by_auth_uid = auth.uid());

-- 11/12. quiz_results
drop policy if exists "quiz_results_anon_insert" on public.quiz_results;
create policy "quiz_results_anon_insert" on public.quiz_results
    for insert
    to authenticated
    with check (
        public.is_anon_session() and exists (
            select 1 from public.quiz_sessions qs
            where qs.id = quiz_results.session_id and qs.created_by_auth_uid = auth.uid()
        )
    );

drop policy if exists "quiz_results_anon_select" on public.quiz_results;
create policy "quiz_results_anon_select" on public.quiz_results
    for select
    to authenticated
    using (
        public.is_anon_session() and exists (
            select 1 from public.quiz_sessions qs
            where qs.id = quiz_results.session_id and qs.created_by_auth_uid = auth.uid()
        )
    );

-- 13. resources
drop policy if exists "resources_anon_select" on public.resources;
create policy "resources_anon_select" on public.resources
    for select
    to authenticated
    using (public.is_anon_session() and is_active = true);

-- 14. Dong lo bao mat phat sinh: quiz_questions_select (0006) dang "to authenticated
-- using (true)" nen hoc sinh an danh cung doc duoc thang bang goc quiz_questions qua
-- REST, bao gom ca cot correct_index (dap an dung) -> lo de thi. Hoc sinh CHI duoc
-- phep doc qua view an toan quiz_questions_public (view chay voi quyen chu view, khong
-- bi RLS nay chan). Thu hep policy nay lai cho giao vien/admin that (khong phai anon).
drop policy if exists "quiz_questions_select" on public.quiz_questions;
create policy "quiz_questions_select" on public.quiz_questions
    for select
    to authenticated
    using (not public.is_anon_session());
