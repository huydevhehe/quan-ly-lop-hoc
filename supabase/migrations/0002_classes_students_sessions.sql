-- 0002_classes_students_sessions.sql
-- Task 2: Bang classes, students va room_sessions

-- 1. Bang classes
create table if not exists public.classes (
    id uuid primary key default gen_random_uuid(),
    school_year_id uuid references public.school_years(id) on delete set null,
    name text not null,
    grade smallint,
    room_code text unique not null,
    created_by uuid references public.profiles(id) on delete set null,
    is_open boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.classes enable row level security;

-- Index tren room_code da duoc Postgres tu tao boi UNIQUE constraint

-- 2. Bang students
create table if not exists public.students (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    student_code text not null,
    full_name text not null,
    avatar text,
    created_at timestamptz not null default now(),
    unique (class_id, student_code)
);

alter table public.students enable row level security;
create index if not exists idx_students_class_id on public.students(class_id);

-- 3. Bang room_sessions (phien hoc sinh an danh vao lop theo ma phong)
create table if not exists public.room_sessions (
    id uuid primary key default gen_random_uuid(),
    auth_uid uuid unique not null references auth.users(id) on delete cascade,
    class_id uuid not null references public.classes(id) on delete cascade,
    joined_at timestamptz not null default now()
);

alter table public.room_sessions enable row level security;
create index if not exists idx_room_sessions_class_id on public.room_sessions(class_id);
