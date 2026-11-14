-- 0003_attendance_scores.sql
-- Task 3: Bang attendance, weekly_evaluations va scores

-- 1. Bang attendance
create table if not exists public.attendance (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    week_number smallint not null check (week_number between 1 and 35),
    status text not null check (status in ('present', 'excused', 'unexcused')),
    note text,
    unique (student_id, week_number)
);

alter table public.attendance enable row level security;
create index if not exists idx_attendance_student_id on public.attendance(student_id);

-- 2. Bang weekly_evaluations
create table if not exists public.weekly_evaluations (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    week_number smallint not null check (week_number between 1 and 35),
    comment text,
    unique (student_id, week_number)
);

alter table public.weekly_evaluations enable row level security;
create index if not exists idx_weekly_evaluations_student_id on public.weekly_evaluations(student_id);

-- 3. Bang scores voi generated columns STORED
create table if not exists public.scores (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references public.students(id) on delete cascade,
    semester text not null check (semester in ('hk1', 'ca_nam')),
    theory_score numeric(4,1),
    practice_score numeric(4,1),
    total_score numeric(4,1) generated always as (
        round(((coalesce(theory_score, 0::numeric) + coalesce(practice_score, 0::numeric)) / 2::numeric), 1)
    ) stored,
    classification text generated always as (
        case 
            when ((coalesce(theory_score, 0::numeric) + coalesce(practice_score, 0::numeric)) / 2::numeric) >= 9::numeric then 'T'
            when ((coalesce(theory_score, 0::numeric) + coalesce(practice_score, 0::numeric)) / 2::numeric) >= 5::numeric then 'H'
            else 'C'
        end
    ) stored,
    unique (student_id, semester)
);

alter table public.scores enable row level security;
create index if not exists idx_scores_student_id on public.scores(student_id);
