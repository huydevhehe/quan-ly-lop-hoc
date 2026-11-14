-- 0013_comment_bank.sql
-- Ngan hang nhan xet tuy bien theo khoi (1-5) va loai xep loai (T/H)
-- Thay the cho localStorage (qllh_grade_comments_T/H) khong dong bo duoc giua cac may

create table if not exists public.comment_bank (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('T', 'H')),
  grade smallint not null check (grade between 1 and 5),
  comments jsonb not null default '[]'::jsonb,
  file_name text,
  updated_at timestamptz not null default now(),
  unique (type, grade)
);

alter table public.comment_bank enable row level security;

-- Ngan hang nhan xet la tai nguyen dung chung toan truong (giong quiz_topics),
-- moi giao vien/admin da dang nhap deu doc va sua duoc.
create policy "comment_bank_authenticated_select" on public.comment_bank
  for select
  to authenticated
  using (true);

create policy "comment_bank_authenticated_insert" on public.comment_bank
  for insert
  to authenticated
  with check (true);

create policy "comment_bank_authenticated_update" on public.comment_bank
  for update
  to authenticated
  using (true)
  with check (true);
