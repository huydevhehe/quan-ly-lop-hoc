-- 0014_profiles_status.sql
-- Them cot trang thai khoa/mo tai khoan giao vien/admin (dong bo voi auth.users khi Admin khoa tai khoan)

alter table public.profiles
  add column if not exists status text not null default 'active' check (status in ('active', 'locked'));
