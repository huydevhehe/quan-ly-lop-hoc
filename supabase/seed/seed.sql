-- seed.sql
-- Dữ liệu mẫu khởi tạo cho môi trường kiểm thử local

-- LƯU Ý QUAN TRỌNG VỀ AUTH:
-- Trong Supabase thực tế, bảng auth.users được quản lý bởi Supabase Auth Service.
-- Khi chạy local seed hoặc test, ta có thể tạo người dùng qua Admin API / Studio hoặc
-- chèn trực tiếp vào auth.users nếu đang chạy với quyền postgres superuser.

do $$
declare
    v_admin_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
    v_teacher_id uuid := '00000000-0000-0000-0000-000000000002'::uuid;
    v_year_id uuid;
    v_class1_id uuid;
    v_class2_id uuid;
    v_topic1_id uuid;
    v_topic2_id uuid;
    i int;
begin
    -- 1. Tạo auth users (nếu chưa có)
    insert into auth.users (id, email, raw_user_meta_data)
    values 
        (v_admin_id, 'admin@qllh.pro', '{"full_name": "Quản trị viên"}'::jsonb),
        (v_teacher_id, 'teacher@qllh.pro', '{"full_name": "Thầy Giáo Nguyễn"}'::jsonb)
    on conflict (id) do nothing;

    -- 2. Tạo profiles
    insert into public.profiles (id, email, full_name, role)
    values
        (v_admin_id, 'admin@qllh.pro', 'Quản trị viên', 'admin'),
        (v_teacher_id, 'teacher@qllh.pro', 'Thầy Giáo Nguyễn', 'teacher')
    on conflict (id) do update 
        set full_name = excluded.full_name, role = excluded.role;

    -- 3. Tạo năm học
    insert into public.school_years (name, is_active)
    values ('2026-2027', true)
    on conflict (name) do update set is_active = true
    returning id into v_year_id;

    -- 4. Tạo 2 lớp học (do Giáo viên Nguyễn tạo)
    insert into public.classes (school_year_id, name, grade, room_code, created_by, is_open)
    values (v_year_id, 'Lớp 5A', 5, 'ROOM5A', v_teacher_id, true)
    on conflict (room_code) do update set name = excluded.name
    returning id into v_class1_id;

    insert into public.classes (school_year_id, name, grade, room_code, created_by, is_open)
    values (v_year_id, 'Lớp 5B', 5, 'ROOM5B', v_teacher_id, true)
    on conflict (room_code) do update set name = excluded.name
    returning id into v_class2_id;

    -- 5. Tạo 5 học sinh mẫu cho mỗi lớp
    for i in 1..5 loop
        insert into public.students (class_id, student_code, full_name)
        values (v_class1_id, '5A_' || lpad(i::text, 2, '0'), 'Học sinh 5A số ' || i)
        on conflict (class_id, student_code) do nothing;

        insert into public.students (class_id, student_code, full_name)
        values (v_class2_id, '5B_' || lpad(i::text, 2, '0'), 'Học sinh 5B số ' || i)
        on conflict (class_id, student_code) do nothing;
    end loop;

    -- 6. Tạo chủ đề và câu hỏi trắc nghiệm
    insert into public.quiz_topics (grade, name, is_active)
    values (5, 'Tin học 5 - Luyện tập chung', true)
    returning id into v_topic1_id;

    insert into public.quiz_topics (grade, name, is_active)
    values (5, 'Toán 5 - Phép nhân chia số thập phân', true)
    returning id into v_topic2_id;

    insert into public.quiz_questions (topic_id, content, options, correct_index, created_by)
    values 
        (v_topic1_id, 'Thiết bị nào sau đây là thiết bị vào của máy tính?', '["Màn hình", "Bàn phím", "Máy in", "Loa"]'::jsonb, 1, v_teacher_id),
        (v_topic1_id, 'Phím tắt nào dùng để sao chép dữ liệu?', '["Ctrl + V", "Ctrl + C", "Ctrl + X", "Ctrl + Z"]'::jsonb, 1, v_teacher_id),
        (v_topic2_id, 'Kết quả của phép tính 2.5 x 4 là?', '["8", "9", "10", "11"]'::jsonb, 2, v_teacher_id);

    -- 7. Tạo tài nguyên mẫu (video, link, game)
    insert into public.resources (type, grade, title, url, is_active, created_by)
    values 
        ('video', 5, 'Video hướng dẫn soạn thảo văn bản', 'https://www.youtube.com/watch?v=sample', true, v_teacher_id),
        ('link', 5, 'Trang tra cứu từ điển học tập', 'https://dictionary.example.com', true, v_teacher_id),
        ('game', 5, 'Game rèn luyện tính nhẩm nhanh', 'https://game.example.com/math-fast', true, v_teacher_id);

    raise notice 'Seed data hoàn tất: 1 admin, 1 teacher, 1 năm học, 2 lớp, 10 học sinh, 3 câu hỏi trắc nghiệm, 3 tài nguyên.';
end $$;
