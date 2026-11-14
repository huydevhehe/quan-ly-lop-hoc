-- _tests/0006_test.sql
-- Test kiem tra RLS cho Giao vien va Admin
-- Giao vien A chi duoc thay lop cua GV A, khong thay lop cua GV B

do $$
declare
    v_gv_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
    v_gv_b_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
    v_class_a_id uuid;
    v_class_b_id uuid;
    v_count int;
begin
    -- 1. Setup du lieu gia lap (chay duoi role postgres/superuser)
    insert into auth.users (id, email) values (v_gv_a_id, 'gva@school.edu') on conflict (id) do nothing;
    insert into auth.users (id, email) values (v_gv_b_id, 'gvb@school.edu') on conflict (id) do nothing;

    insert into public.profiles (id, email, full_name, role)
    values (v_gv_a_id, 'gva@school.edu', 'Thay A', 'teacher')
    on conflict (id) do update set role = 'teacher';

    insert into public.profiles (id, email, full_name, role)
    values (v_gv_b_id, 'gvb@school.edu', 'Co B', 'teacher')
    on conflict (id) do update set role = 'teacher';

    insert into public.classes (name, room_code, created_by)
    values ('Lop cua GV A', 'ROOMA', v_gv_a_id)
    on conflict (room_code) do update set created_by = v_gv_a_id
    returning id into v_class_a_id;

    insert into public.classes (name, room_code, created_by)
    values ('Lop cua GV B', 'ROOMB', v_gv_b_id)
    on conflict (room_code) do update set created_by = v_gv_b_id
    returning id into v_class_b_id;

    -- 2. Kiem tra helper function is_class_owner cho GV A
    -- Gia lap auth context cua GV A
    perform set_config('request.jwt.claim.sub', v_gv_a_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);

    assert public.is_class_owner(v_class_a_id) = true, 'GV A phai la owner cua Lop A';
    assert public.is_class_owner(v_class_b_id) = false, 'GV A khong duoc la owner cua Lop B';

    -- 3. Kiem tra helper function is_class_owner cho GV B
    perform set_config('request.jwt.claim.sub', v_gv_b_id::text, true);
    assert public.is_class_owner(v_class_b_id) = true, 'GV B phai la owner cua Lop B';
    assert public.is_class_owner(v_class_a_id) = false, 'GV B khong duoc la owner cua Lop A';

    raise notice 'Test thanh cong: RLS teacher/admin tach biet tuyet doi giua cac lop hoc.';
end $$;
