-- 0001_profiles_school_years.sql
-- Task 1: Bang profiles va school_years

-- 1. Bang profiles
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    full_name text,
    role text not null check (role in ('admin', 'teacher')),
    avatar text,
    created_at timestamptz not null default now()
);

-- Bat RLS ngay lap tuc
alter table public.profiles enable row level security;

-- 2. Bang school_years
create table if not exists public.school_years (
    id uuid primary key default gen_random_uuid(),
    name text unique not null,
    is_active boolean not null default false,
    created_at timestamptz not null default now()
);

-- Bat RLS ngay lap tuc
alter table public.school_years enable row level security;
