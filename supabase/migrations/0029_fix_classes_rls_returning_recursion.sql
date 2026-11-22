-- 0029_fix_classes_rls_returning_recursion.sql
-- Bug: chinh sach SELECT/UPDATE/DELETE cua bang classes dung is_class_owner(id), ham nay
-- lai tu truy van NGUOC vao chinh bang classes. Khi INSERT ... RETURNING (vd .insert().select()
-- trong code), Postgres phai kiem tra ca SELECT policy cho dong vua tao, nhung truy van long
-- ben trong is_class_owner() khong thay duoc dong chua commit trong cung cau lenh -> luon bi
-- RLS chan voi loi "new row violates row-level security policy for table classes", du
-- with_check cua INSERT da dung. Da kiem chung that bang curl: insert thuong (return=minimal)
-- thanh cong 201, insert + return=representation that bai 42501 voi CUNG payload.
-- Fix: viet thang dieu kien (khong qua ham tu truy van) cho rieng bang classes, vi id chinh
-- la dong dang duoc danh gia nen khong can subquery. is_class_owner() van giu nguyen de
-- dung cho cac bang KHAC tham chieu class_id (students, scores, attendance...), khong bi loi
-- nay vi do la bang khac, khong tu tham chieu.

drop policy if exists "classes_teacher_select" on public.classes;
create policy "classes_teacher_select" on public.classes
    for select to authenticated
    using (public.is_admin() or created_by = auth.uid());

drop policy if exists "classes_teacher_update" on public.classes;
create policy "classes_teacher_update" on public.classes
    for update to authenticated
    using (public.is_admin() or created_by = auth.uid())
    with check (public.is_admin() or created_by = auth.uid());

drop policy if exists "classes_teacher_delete" on public.classes;
create policy "classes_teacher_delete" on public.classes
    for delete to authenticated
    using (public.is_admin() or created_by = auth.uid());
