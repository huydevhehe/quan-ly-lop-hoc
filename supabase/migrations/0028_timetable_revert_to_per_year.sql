-- 0028_timetable_revert_to_per_year.sql
-- Doi lai: TKB la cua GIAO VIEN theo TUNG NAM HOC (1 tuan day lop nao buoi nao),
-- khong phai rieng tung lop nua - vi giao vien chi can biet buoi do day lop nao.

alter table public.teacher_timetables
  add column if not exists school_year_id uuid references public.school_years(id) on delete cascade;

update public.teacher_timetables t
set school_year_id = (
  select c.school_year_id from public.classes c where c.id = t.class_id
)
where t.school_year_id is null;

-- Neu van khong gan duoc nam hoc (lop khong ton tai / khong co nam hoc), gan ve nam hoc dau tien
update public.teacher_timetables t
set school_year_id = (select id from public.school_years order by name asc limit 1)
where t.school_year_id is null;

alter table public.teacher_timetables alter column school_year_id set not null;

alter table public.teacher_timetables drop constraint if exists teacher_timetables_pkey;
alter table public.teacher_timetables add primary key (teacher_id, school_year_id);

alter table public.teacher_timetables drop column if exists class_id;
