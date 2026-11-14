-- _tests/0004_test.sql
-- Test kiem tra quiz_questions va view an toan quiz_questions_public

-- 1. Kiem tra dinh nghia cot cua view quiz_questions_public: khong duoc chua correct_index
do $$
begin
    assert exists (
        select 1 from information_schema.views 
        where table_schema = 'public' and table_name = 'quiz_questions_public'
    ), 'quiz_questions_public view khong ton tai';

    assert not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' and table_name = 'quiz_questions_public' and column_name = 'correct_index'
    ), 'Test that bai: view quiz_questions_public bi lo cot correct_index!';

    assert exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' and table_name = 'quiz_questions_public' and column_name = 'content'
    ), 'quiz_questions_public.content khong ton tai';
end $$;

-- 2. Test insert cau hoi vao quiz_questions va query tu view
do $$
declare
    v_topic_id uuid;
    v_q_id uuid;
    v_content text;
begin
    insert into public.quiz_topics (name, grade, is_active)
    values ('Chu de 1', 5, true)
    returning id into v_topic_id;

    insert into public.quiz_questions (topic_id, content, options, correct_index)
    values (v_topic_id, '1 + 1 bang may?', '["1", "2", "3", "4"]'::jsonb, 1)
    returning id into v_q_id;

    select content into v_content
    from public.quiz_questions_public
    where id = v_q_id;

    assert v_content = '1 + 1 bang may?', 'Khong tim thay cau hoi qua view public';
    raise notice 'Test thanh cong: view quiz_questions_public giau dung correct_index.';
end $$;
