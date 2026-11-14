-- 0005_resources.sql
-- Task 5: Bang resources cho Hoc lieu so / Giai tri / Tien ich

create table if not exists public.resources (
    id uuid primary key default gen_random_uuid(),
    type text not null check (type in ('video', 'link', 'game')),
    grade smallint,
    title text not null,
    url text not null,
    thumbnail_url text,
    is_active boolean not null default false,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

alter table public.resources enable row level security;
create index if not exists idx_resources_type on public.resources(type);
create index if not exists idx_resources_grade on public.resources(grade);
