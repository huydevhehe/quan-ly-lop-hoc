-- 0024_schools_multi_tenant.sql
-- Ho tro nhieu truong doc lap (multi-tenant): admin toan quyen xem/quan ly ca 2 (hoac nhieu)
-- truong, giao vien chi thuoc 1 truong. Du lieu lop/hoc sinh van cach ly theo created_by
-- nhu truoc (khong doi), rieng "tien ich tu them" (resources) can cach ly theo truong.

create table if not exists public.schools (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz not null default now()
);

alter table public.schools enable row level security;

-- Truong mac dinh de gan toan bo du lieu hien co vao, co the doi ten sau
insert into public.schools (name)
select 'Trường A'
where not exists (select 1 from public.schools);

alter table public.profiles add column if not exists school_id uuid references public.schools(id) on delete set null;
alter table public.classes add column if not exists school_id uuid references public.schools(id) on delete set null;
alter table public.resources add column if not exists school_id uuid references public.schools(id) on delete set null;

-- Backfill toan bo du lieu hien co ve truong mac dinh dau tien
with first_school as (
    select id from public.schools order by created_at asc limit 1
)
update public.profiles set school_id = (select id from first_school) where school_id is null and role = 'teacher';

with first_school as (
    select id from public.schools order by created_at asc limit 1
)
update public.classes set school_id = (select id from first_school) where school_id is null;

with first_school as (
    select id from public.schools order by created_at asc limit 1
)
update public.resources set school_id = (select id from first_school) where school_id is null;

alter table public.classes alter column school_id set not null;
alter table public.resources alter column school_id set not null;

create index if not exists idx_classes_school_id on public.classes(school_id);
create index if not exists idx_resources_school_id on public.resources(school_id);
create index if not exists idx_profiles_school_id on public.profiles(school_id);

-- Helper: truong cua nguoi dang dang nhap (null voi admin, vi admin khong gan 1 truong co dinh)
create or replace function public.current_school_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
    select school_id from public.profiles where id = auth.uid();
$$;

-- RLS cho bang schools: ai dang nhap cung xem duoc (de hien ten truong), chi admin tao/sua/xoa
create policy "schools_select" on public.schools
    for select
    to authenticated
    using (true);

create policy "schools_admin_write" on public.schools
    for all
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

-- Sua lai policy resources_select: truoc day "dung chung" toan bo (using true), gio chi
-- dung chung voi admin hoac dung truong; cac tien ich/link tu them cua truong khac se an di.
-- Hoc sinh dang nhap an danh (khong co row profiles) van phai xem duoc resources cua dung
-- truong lop minh da vao qua room_sessions, nen them nhanh kiem tra rieng cho truong hop nay.
drop policy if exists "resources_select" on public.resources;

create policy "resources_select" on public.resources
    for select
    to authenticated
    using (
        public.is_admin()
        or school_id = public.current_school_id()
        or exists (
            select 1 from public.room_sessions rs
            join public.classes c on c.id = rs.class_id
            where rs.auth_uid = auth.uid() and c.school_id = resources.school_id
        )
    );
