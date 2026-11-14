-- 0009_quiz_results_unique_session.sql
-- Thêm ràng buộc unique(session_id) để tránh lưu trùng kết quả thi khi học sinh double-click nộp bài

alter table public.quiz_results add constraint quiz_results_session_unique unique (session_id);
