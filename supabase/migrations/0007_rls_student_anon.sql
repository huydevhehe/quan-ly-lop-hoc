-- 0007_rls_student_anon.sql
-- Task 7: RLS cho hoc sinh (Anonymous Auth qua ma phong)

-- 1. Helper function current_room_class_id()
create or replace function public.current_room_class_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
    select class_id 
    from public.room_sessions 
    where auth_uid = auth.uid()
    limit 1;
$$;

-- 2. Cap nhat bang quiz_sessions: them cot created_by_auth_uid de phan quyen phien thi theo hoc sinh
alter table public.quiz_sessions 
add column if not exists created_by_auth_uid uuid default auth.uid();

create index if not exists idx_quiz_sessions_created_by on public.quiz_sessions(created_by_auth_uid);

-- 3. Policy SELECT cho classes (hoc sinh chi thay dung lop cua ma phong da vao)
create policy "classes_anon_select" on public.classes
    for select
    to anon
    using (id = public.current_room_class_id());

-- 4. Policy SELECT cho students (hoc sinh chi thay danh sach hoc sinh trong lop cua minh)
create policy "students_anon_select" on public.students
    for select
    to anon
    using (class_id = public.current_room_class_id());

-- 5. Policy SELECT cho attendance
create policy "attendance_anon_select" on public.attendance
    for select
    to anon
    using (exists (
        select 1 from public.students s
        where s.id = attendance.student_id and s.class_id = public.current_room_class_id()
    ));

-- 6. Policy SELECT cho scores
create policy "scores_anon_select" on public.scores
    for select
    to anon
    using (exists (
        select 1 from public.students s
        where s.id = scores.student_id and s.class_id = public.current_room_class_id()
    ));

-- 7. Policy SELECT cho weekly_evaluations
create policy "weekly_evaluations_anon_select" on public.weekly_evaluations
    for select
    to anon
    using (exists (
        select 1 from public.students s
        where s.id = weekly_evaluations.student_id and s.class_id = public.current_room_class_id()
    ));

-- 8. Policy cho room_sessions: anon duoc doc va tao phien cua chinh minh
create policy "room_sessions_anon_select" on public.room_sessions
    for select
    to anon
    using (auth_uid = auth.uid());

create policy "room_sessions_anon_insert" on public.room_sessions
    for insert
    to anon
    with check (auth_uid = auth.uid());

-- 9. Policy cho quiz_topics: anon duoc xem cac chu de dang kich hoat (is_active = true)
create policy "quiz_topics_anon_select" on public.quiz_topics
    for select
    to anon
    using (is_active = true);

-- 10. Policy cho quiz_questions:
-- TUYET DOI KHONG THEM POLICY SELECT CHO ANON TREN BANG GOC quiz_questions.
-- Hoc sinh anon chi duoc phep query thong qua View an toan: quiz_questions_public.

-- 11. Policy cho quiz_sessions (tao phien thi va xem phien thi cua chinh minh)
create policy "quiz_sessions_anon_insert" on public.quiz_sessions
    for insert
    to anon
    with check (
        auth.role() = 'anon'
        and (created_by_auth_uid is null or created_by_auth_uid = auth.uid())
    );

create policy "quiz_sessions_anon_select" on public.quiz_sessions
    for select
    to anon
    using (created_by_auth_uid = auth.uid());

-- 12. Policy cho quiz_results (nop bai va xem ket qua cua phien thi cua minh)
create policy "quiz_results_anon_insert" on public.quiz_results
    for insert
    to anon
    with check (
        exists (
            select 1 from public.quiz_sessions qs
            where qs.id = quiz_results.session_id and qs.created_by_auth_uid = auth.uid()
        )
    );

create policy "quiz_results_anon_select" on public.quiz_results
    for select
    to anon
    using (
        exists (
            select 1 from public.quiz_sessions qs
            where qs.id = quiz_results.session_id and qs.created_by_auth_uid = auth.uid()
        )
    );

-- 13. Policy cho resources (xem cac tai nguyen hoc lieu/game dang kich hoat)
create policy "resources_anon_select" on public.resources
    for select
    to anon
    using (is_active = true);
