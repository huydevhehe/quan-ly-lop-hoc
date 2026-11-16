-- 0019_count_questions_by_topic_fn.sql
-- Fix: sau khi 0017 chan hoc sinh an danh doc thang bang quiz_questions (de khong lo dap
-- an dung), so dem "X cau hoi" tren moi chu de (listTopics() dung embed
-- "quiz_questions(count)") cung bi RLS loc theo, luon tra ve 0 cho phien an danh — dung
-- hien thi sai trong popup "Chon chu de thi" (nhung lam bai van dung vi do la luong rieng
-- qua edge function). Dung ham SECURITY DEFINER rieng CHI tra ve so luong, khong tra ve
-- noi dung/dap an, de dem dung ma khong mo lai quyen doc bang goc.

create or replace function public.count_questions_by_topic(topic_ids uuid[])
returns table(topic_id uuid, question_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select quiz_questions.topic_id, count(*) as question_count
  from public.quiz_questions
  where quiz_questions.topic_id = any(topic_ids)
  group by quiz_questions.topic_id;
$$;

grant execute on function public.count_questions_by_topic(uuid[]) to anon, authenticated;
