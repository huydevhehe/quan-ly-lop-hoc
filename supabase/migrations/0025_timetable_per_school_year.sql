-- 0025_timetable_per_school_year.sql
-- Thoi khoa bieu tach rieng theo tung nam hoc (truoc day dung chung 1 ban cho moi nam).

alter table public.teacher_timetables
  add column if not exists school_year_id uuid references public.school_years(id) on delete cascade;

-- Backfill ban ghi cu (neu co) ve nam hoc dau tien hien co, de khong mat du lieu da nhap.
update public.teacher_timetables t
set school_year_id = (select id from public.school_years order by name asc limit 1)
where t.school_year_id is null;

alter table public.teacher_timetables alter column school_year_id set not null;

alter table public.teacher_timetables drop constraint if exists teacher_timetables_pkey;
alter table public.teacher_timetables add primary key (teacher_id, school_year_id);
