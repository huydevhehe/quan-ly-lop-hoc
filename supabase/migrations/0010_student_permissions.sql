-- 0010_student_permissions.sql
-- Bảng phân quyền hiển thị dành cho học sinh (1 dòng duy nhất cho toàn trường)

create table if not exists public.student_permissions (
    id uuid primary key default gen_random_uuid(),
    can_view_classroom boolean not null default true,
    can_view_quiz boolean not null default true,
    can_view_resources boolean not null default true,
    can_view_games boolean not null default true,
    can_view_utilities boolean not null default true,
    updated_at timestamptz not null default now()
);

alter table public.student_permissions enable row level security;

-- Policy: Mọi người dùng (kể cả anon) đều được đọc quyền của học sinh
create policy "student_permissions_select" on public.student_permissions
    for select
    using (true);

-- Policy: Chỉ quản trị viên mới được cập nhật quyền
create policy "student_permissions_admin_update" on public.student_permissions
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "student_permissions_admin_insert" on public.student_permissions
    for insert
    to authenticated
    with check (public.is_admin());

-- Chèn sẵn dòng cấu hình quyền mặc định đầu tiên nếu chưa có
insert into public.student_permissions (id, can_view_classroom, can_view_quiz, can_view_resources, can_view_games, can_view_utilities)
values ('00000000-0000-0000-0000-000000000010', true, true, true, true, true)
on conflict (id) do nothing;
