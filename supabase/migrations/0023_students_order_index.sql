-- 0023_students_order_index.sql
-- "Sắp xếp: Chuẩn" phải giữ đúng thứ tự import ban đầu (file Excel), nhưng trước đây
-- listStudentsByClass luôn ORDER BY student_code nên "Chuẩn" thực chất không khác gì
-- sắp xếp theo mã học sinh. Thêm cột order_index để lưu thật thứ tự import, backfill
-- dữ liệu cũ theo created_at (xấp xỉ thứ tự nhập ban đầu vì import là insert hàng loạt).

alter table public.students add column order_index integer;

with ranked as (
    select id, row_number() over (partition by class_id order by created_at, id) as rn
    from public.students
)
update public.students s
set order_index = ranked.rn
from ranked
where ranked.id = s.id;

alter table public.students alter column order_index set not null;
alter table public.students alter column order_index set default 1;

create index if not exists idx_students_class_order on public.students(class_id, order_index);
