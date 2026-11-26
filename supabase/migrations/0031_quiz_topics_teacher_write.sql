-- 0031_quiz_topics_teacher_write.sql
-- Bug: UI (QuizBank) cho phep MOI giao vien (khong chi admin) tao/doi ten/kich hoat/khoa
-- chu de thi (App.tsx: isAdmin={isAdmin || currentUser?.role === 'teacher'}), nhung chinh
-- sach RLS "quiz_topics_admin_write" lai chi cho phep is_admin() thao tac INSERT/UPDATE/
-- DELETE. Vi PostgREST khong bao loi khi 0 dong khop dieu kien USING cua UPDATE, thao tac
-- cua giao vien (vd tick kich hoat chu de) tra ve 200 nhung mang rong - khong co gi duoc
-- luu, va giao vien khac khong thay duoc thay doi vi thuc ra chua he luu. Da kiem chung
-- bang curl: PATCH is_active voi tai khoan role=teacher tra ve 200 [] (0 dong duoc sua).
-- Fix: cho phep bat ky phien dang nhap that (khong phai hoc sinh an danh, is_anon_session()
-- = false) duoc quan ly chu de, dung voi mo hinh ngan hang cau hoi dung chung toan he thong
-- (quiz_topics/quiz_questions khong co school_id/created_by rieng, da chia se toan cuc).

drop policy if exists "quiz_topics_admin_write" on public.quiz_topics;

create policy "quiz_topics_staff_insert" on public.quiz_topics
    for insert to authenticated
    with check (not public.is_anon_session());

create policy "quiz_topics_staff_update" on public.quiz_topics
    for update to authenticated
    using (not public.is_anon_session())
    with check (not public.is_anon_session());

create policy "quiz_topics_staff_delete" on public.quiz_topics
    for delete to authenticated
    using (not public.is_anon_session());
