-- 0032_teacher_timetables_delete_policy.sql
-- Bug: bang teacher_timetables chi co chinh sach INSERT/UPDATE/SELECT, KHONG co chinh
-- sach DELETE nao ca. Nut "Xoa toan bo thoi khoa bieu" (deleteMyTimetable) goi DELETE
-- nhung vi khong co policy nao cho phep, PostgREST van tra ve 204 (thanh cong) ma
-- THUC TE 0 dong nao bi xoa - giao vien bam xoa, UI bao "Da luu" nhung du lieu cu
-- van con nguyen trong database. Da kiem chung bang curl voi tai khoan giao vien that.

create policy "teacher_timetables_delete" on public.teacher_timetables
    for delete to authenticated
    using (teacher_id = auth.uid());
