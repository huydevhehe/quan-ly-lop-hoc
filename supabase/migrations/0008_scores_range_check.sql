-- 0008_scores_range_check.sql
-- Bổ sung ràng buộc kiểm tra điểm số lý thuyết và thực hành từ 0 đến 10

alter table public.scores
  add constraint scores_theory_range check (theory_score is null or (theory_score >= 0 and theory_score <= 10)),
  add constraint scores_practice_range check (practice_score is null or (practice_score >= 0 and practice_score <= 10));
