-- 0030_weekly_evaluations_rank.sql
-- Giao vien chon "Danh gia" (Tot/Kha/Trung binh/Yeu) cho tung hoc sinh moi tuan nhung truoc
-- gio chi luu trong state React (khong gui len Supabase) nen mat khi tai lai trang va luon
-- trong khi xuat file Excel. Them cot rank de luu that.

alter table public.weekly_evaluations add column if not exists rank text;
