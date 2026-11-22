-- 0027_quiz_session_school_name.sql
-- Cho phep thi sinh tu do (khong thuoc lop nao) nhap ten truong cua minh khi lam bai.

alter table public.quiz_sessions add column if not exists school_name text;
