-- 0020_teacher_timetables.sql
-- Bang luu thoi khoa bieu ca nhan cua tung giao vien (truoc day chi luu tam trong state React,
-- mat het khi F5/doi may - gio luu that vao Supabase theo tai khoan)

create table if not exists public.teacher_timetables (
    teacher_id uuid primary key references public.profiles(id) on delete cascade,
    grid jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.teacher_timetables enable row level security;

create policy "teacher_timetables_select" on public.teacher_timetables
    for select
    to authenticated
    using (teacher_id = auth.uid() or public.is_admin());

create policy "teacher_timetables_insert" on public.teacher_timetables
    for insert
    to authenticated
    with check (teacher_id = auth.uid());

create policy "teacher_timetables_update" on public.teacher_timetables
    for update
    to authenticated
    using (teacher_id = auth.uid())
    with check (teacher_id = auth.uid());
