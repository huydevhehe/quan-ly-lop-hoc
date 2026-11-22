-- 0026_timetable_per_class.sql
-- TKB tach rieng theo tung LOP (khong chi theo nam hoc), vi 1 giao vien co the day nhieu lop/nam.

alter table public.teacher_timetables
  add column if not exists class_id uuid references public.classes(id) on delete cascade;

-- Backfill ban ghi cu: gan ve 1 lop ma giao vien do dang so huu trong cung nam hoc (neu co).
update public.teacher_timetables t
set class_id = (
  select c.id from public.classes c
  where c.created_by = t.teacher_id and c.school_year_id = t.school_year_id
  order by c.created_at asc
  limit 1
)
where t.class_id is null;

-- Ban ghi khong gan duoc lop nao (mo coi) thi xoa, vi tu day TKB bat buoc gan theo lop.
delete from public.teacher_timetables where class_id is null;

alter table public.teacher_timetables alter column class_id set not null;

alter table public.teacher_timetables drop constraint if exists teacher_timetables_pkey;
alter table public.teacher_timetables add primary key (teacher_id, class_id);

alter table public.teacher_timetables drop column if exists school_year_id;

create index if not exists idx_teacher_timetables_class_id on public.teacher_timetables(class_id);
