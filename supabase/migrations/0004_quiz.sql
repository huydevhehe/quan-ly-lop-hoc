-- 0004_quiz.sql
-- Task 4: Ngan hang cau hoi trac nghiem va ket qua thi

-- 1. Bang quiz_topics
create table if not exists public.quiz_topics (
    id uuid primary key default gen_random_uuid(),
    grade smallint,
    name text not null,
    is_active boolean not null default false
);

alter table public.quiz_topics enable row level security;

-- 2. Bang quiz_questions (chua dap an dung correct_index)
create table if not exists public.quiz_questions (
    id uuid primary key default gen_random_uuid(),
    topic_id uuid references public.quiz_topics(id) on delete cascade,
    content text not null,
    options jsonb not null,
    correct_index smallint not null check (correct_index between 0 and 3),
    image_url text,
    created_by uuid references public.profiles(id) on delete set null
);

alter table public.quiz_questions enable row level security;
create index if not exists idx_quiz_questions_topic_id on public.quiz_questions(topic_id);

-- 3. View quiz_questions_public: An hoan toan cot correct_index
create or replace view public.quiz_questions_public as
select
    id,
    topic_id,
    content,
    options,
    image_url
from public.quiz_questions;

-- 4. Bang quiz_sessions (phien lam bai)
create table if not exists public.quiz_sessions (
    id uuid primary key default gen_random_uuid(),
    student_name text not null,
    class_id uuid references public.classes(id) on delete set null,
    is_free_slot boolean not null default false,
    topic_ids uuid[] not null,
    question_order jsonb not null,
    started_at timestamptz not null default now()
);

alter table public.quiz_sessions enable row level security;
create index if not exists idx_quiz_sessions_class_id on public.quiz_sessions(class_id);

-- 5. Bang quiz_results (ket qua thi nop bai)
create table if not exists public.quiz_results (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.quiz_sessions(id) on delete cascade,
    score numeric(4,1),
    correct_count smallint,
    duration_seconds int,
    submitted_at timestamptz not null default now()
);

alter table public.quiz_results enable row level security;
create index if not exists idx_quiz_results_session_id on public.quiz_results(session_id);
