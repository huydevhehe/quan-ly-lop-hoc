-- 0018_quiz_results_teacher_rls.sql
-- BUG: chua tung co policy RLS nao cho giao vien/admin doc (hoac xoa) du lieu
-- quiz_sessions / quiz_results ca. Man hinh "Bang diem hoc sinh thi" (QuizBank.tsx)
-- vi vay luon nhan ve mang rong tu Supabase, va code dang fallback ve
-- INITIAL_SUBMISSIONS / localStorage (du lieu mock) de khong hien man hinh trong
-- -> giao vien thay 4 dong diem gia, khong phai diem thi that cua hoc sinh.

-- is_class_owner(null) tra ve is_admin() (nhanh or trong ham deu false cho nhanh
-- exists khi id = null), nen admin van thay duoc ca cac phien "Tu do" (class_id null).
create policy "quiz_sessions_teacher_select" on public.quiz_sessions
    for select
    to authenticated
    using (public.is_class_owner(class_id));

create policy "quiz_sessions_teacher_delete" on public.quiz_sessions
    for delete
    to authenticated
    using (public.is_class_owner(class_id));

create policy "quiz_results_teacher_select" on public.quiz_results
    for select
    to authenticated
    using (
        exists (
            select 1 from public.quiz_sessions qs
            where qs.id = quiz_results.session_id
              and public.is_class_owner(qs.class_id)
        )
    );
