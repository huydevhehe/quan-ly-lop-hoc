-- 0006_rls_teacher_admin.sql
-- Task 6: Row Level Security cho Admin va Giao vien

-- 1. Helper function is_admin()
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    );
$$;

-- 2. Helper function is_class_owner(p_class_id)
create or replace function public.is_class_owner(p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select public.is_admin() or exists (
        select 1 from public.classes
        where id = p_class_id and created_by = auth.uid()
    );
$$;

-- 3. Policy cho bang profiles
create policy "profiles_select" on public.profiles
    for select
    to authenticated
    using (true);

create policy "profiles_admin_write" on public.profiles
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "profiles_self_update" on public.profiles
    for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

-- 4. Policy cho bang school_years
create policy "school_years_select" on public.school_years
    for select
    to authenticated
    using (true);

create policy "school_years_admin_write" on public.school_years
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- 5. Policy cho bang classes
create policy "classes_teacher_select" on public.classes
    for select
    to authenticated
    using (public.is_class_owner(id));

create policy "classes_teacher_insert" on public.classes
    for insert
    to authenticated
    with check (public.is_admin() or created_by = auth.uid());

create policy "classes_teacher_update" on public.classes
    for update
    to authenticated
    using (public.is_class_owner(id))
    with check (public.is_class_owner(id));

create policy "classes_teacher_delete" on public.classes
    for delete
    to authenticated
    using (public.is_class_owner(id));

-- 6. Policy cho bang students
create policy "students_teacher_select" on public.students
    for select
    to authenticated
    using (public.is_class_owner(class_id));

create policy "students_teacher_insert" on public.students
    for insert
    to authenticated
    with check (public.is_class_owner(class_id));

create policy "students_teacher_update" on public.students
    for update
    to authenticated
    using (public.is_class_owner(class_id))
    with check (public.is_class_owner(class_id));

create policy "students_teacher_delete" on public.students
    for delete
    to authenticated
    using (public.is_class_owner(class_id));

-- 7. Policy cho bang attendance
create policy "attendance_teacher_select" on public.attendance
    for select
    to authenticated
    using (exists (
        select 1 from public.students s
        where s.id = attendance.student_id and public.is_class_owner(s.class_id)
    ));

create policy "attendance_teacher_insert" on public.attendance
    for insert
    to authenticated
    with check (exists (
        select 1 from public.students s
        where s.id = attendance.student_id and public.is_class_owner(s.class_id)
    ));

create policy "attendance_teacher_update" on public.attendance
    for update
    to authenticated
    using (exists (
        select 1 from public.students s
        where s.id = attendance.student_id and public.is_class_owner(s.class_id)
    ))
    with check (exists (
        select 1 from public.students s
        where s.id = attendance.student_id and public.is_class_owner(s.class_id)
    ));

create policy "attendance_teacher_delete" on public.attendance
    for delete
    to authenticated
    using (exists (
        select 1 from public.students s
        where s.id = attendance.student_id and public.is_class_owner(s.class_id)
    ));

-- 8. Policy cho bang weekly_evaluations
create policy "weekly_evaluations_teacher_select" on public.weekly_evaluations
    for select
    to authenticated
    using (exists (
        select 1 from public.students s
        where s.id = weekly_evaluations.student_id and public.is_class_owner(s.class_id)
    ));

create policy "weekly_evaluations_teacher_insert" on public.weekly_evaluations
    for insert
    to authenticated
    with check (exists (
        select 1 from public.students s
        where s.id = weekly_evaluations.student_id and public.is_class_owner(s.class_id)
    ));

create policy "weekly_evaluations_teacher_update" on public.weekly_evaluations
    for update
    to authenticated
    using (exists (
        select 1 from public.students s
        where s.id = weekly_evaluations.student_id and public.is_class_owner(s.class_id)
    ))
    with check (exists (
        select 1 from public.students s
        where s.id = weekly_evaluations.student_id and public.is_class_owner(s.class_id)
    ));

create policy "weekly_evaluations_teacher_delete" on public.weekly_evaluations
    for delete
    to authenticated
    using (exists (
        select 1 from public.students s
        where s.id = weekly_evaluations.student_id and public.is_class_owner(s.class_id)
    ));

-- 9. Policy cho bang scores
create policy "scores_teacher_select" on public.scores
    for select
    to authenticated
    using (exists (
        select 1 from public.students s
        where s.id = scores.student_id and public.is_class_owner(s.class_id)
    ));

create policy "scores_teacher_insert" on public.scores
    for insert
    to authenticated
    with check (exists (
        select 1 from public.students s
        where s.id = scores.student_id and public.is_class_owner(s.class_id)
    ));

create policy "scores_teacher_update" on public.scores
    for update
    to authenticated
    using (exists (
        select 1 from public.students s
        where s.id = scores.student_id and public.is_class_owner(s.class_id)
    ))
    with check (exists (
        select 1 from public.students s
        where s.id = scores.student_id and public.is_class_owner(s.class_id)
    ));

create policy "scores_teacher_delete" on public.scores
    for delete
    to authenticated
    using (exists (
        select 1 from public.students s
        where s.id = scores.student_id and public.is_class_owner(s.class_id)
    ));

-- 10. Policy cho quiz_topics (ngan hang cau hoi dung chung)
create policy "quiz_topics_select" on public.quiz_topics
    for select
    to authenticated
    using (true);

create policy "quiz_topics_admin_write" on public.quiz_topics
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- 11. Policy cho quiz_questions
create policy "quiz_questions_select" on public.quiz_questions
    for select
    to authenticated
    using (true);

create policy "quiz_questions_teacher_insert" on public.quiz_questions
    for insert
    to authenticated
    with check (created_by = auth.uid() or public.is_admin());

create policy "quiz_questions_teacher_update" on public.quiz_questions
    for update
    to authenticated
    using (created_by = auth.uid() or public.is_admin())
    with check (created_by = auth.uid() or public.is_admin());

create policy "quiz_questions_teacher_delete" on public.quiz_questions
    for delete
    to authenticated
    using (created_by = auth.uid() or public.is_admin());

-- 12. Policy cho resources
create policy "resources_select" on public.resources
    for select
    to authenticated
    using (true);

create policy "resources_teacher_insert" on public.resources
    for insert
    to authenticated
    with check (created_by = auth.uid() or public.is_admin());

create policy "resources_teacher_update" on public.resources
    for update
    to authenticated
    using (created_by = auth.uid() or public.is_admin())
    with check (created_by = auth.uid() or public.is_admin());

create policy "resources_teacher_delete" on public.resources
    for delete
    to authenticated
    using (created_by = auth.uid() or public.is_admin());
