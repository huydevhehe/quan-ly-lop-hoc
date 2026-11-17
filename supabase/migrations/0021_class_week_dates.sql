-- 0021_class_week_dates.sql
-- Ngay bat dau/ket thuc cua tung tuan hoc theo tung lop - truoc day chi luu tam trong React
-- state, mat het khi F5 (giao vien bam Luu tuong that nhung thuc ra chua bao gio toi Supabase).

create table if not exists public.class_week_dates (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    week_number smallint not null check (week_number between 1 and 35),
    start_date date,
    end_date date,
    updated_at timestamptz not null default now(),
    unique (class_id, week_number)
);

alter table public.class_week_dates enable row level security;
create index if not exists idx_class_week_dates_class_id on public.class_week_dates(class_id);

create policy "class_week_dates_select" on public.class_week_dates
    for select
    to authenticated
    using (public.is_class_owner(class_id));

create policy "class_week_dates_insert" on public.class_week_dates
    for insert
    to authenticated
    with check (public.is_class_owner(class_id));

create policy "class_week_dates_update" on public.class_week_dates
    for update
    to authenticated
    using (public.is_class_owner(class_id))
    with check (public.is_class_owner(class_id));

create policy "class_week_dates_delete" on public.class_week_dates
    for delete
    to authenticated
    using (public.is_class_owner(class_id));
