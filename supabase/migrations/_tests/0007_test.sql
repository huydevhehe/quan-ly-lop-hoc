-- _tests/0007_test.sql
-- Test kiem tra RLS cho Hoc sinh an danh (Anonymous Auth)

do $$
declare
    v_class_a_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
    v_class_b_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
    v_anon_uid uuid := '33333333-3333-3333-3333-333333333333'::uuid;
begin
    -- 1. Setup data (duoi quyen admin)
    insert into auth.users (id, email) values (v_anon_uid, 'anon@school.edu') on conflict (id) do nothing;

    insert into public.classes (id, name, room_code)
    values (v_class_a_id, 'Lop A Test', 'ROOMA_TEST')
    on conflict (id) do nothing;

    insert into public.classes (id, name, room_code)
    values (v_class_b_id, 'Lop B Test', 'ROOMB_TEST')
    on conflict (id) do nothing;

    -- 2. Kiem tra khi chua co room_sessions:
    perform set_config('request.jwt.claim.sub', v_anon_uid::text, true);
    perform set_config('request.jwt.claim.role', 'anon', true);

    -- current_room_class_id phai tra ve null
    assert public.current_room_class_id() is null, 
        'Test that bai: User anon chua vao phong nhung current_room_class_id khong null!';

    -- 3. Gan v_anon_uid vao Lop A qua room_sessions
    delete from public.room_sessions where auth_uid = v_anon_uid;
    insert into public.room_sessions (auth_uid, class_id)
    values (v_anon_uid, v_class_a_id);

    -- Test lai sau khi co session
    assert public.current_room_class_id() = v_class_a_id,
        'Test that bai: current_room_class_id phai tra ve Lop A';

    assert public.current_room_class_id() <> v_class_b_id,
        'Test that bai: current_room_class_id khong duoc trung voi Lop B';

    -- 4. Kiem tra bang goc quiz_questions: khong co bat ky policy SELECT nao cho role anon
    assert not exists (
        select 1 from pg_policies 
        where schemaname = 'public' 
          and tablename = 'quiz_questions' 
          and 'anon' = any(string_to_array(roles::text, ','))
          and cmd = 'SELECT'
    ), 'Test that bai: bang goc quiz_questions van bi cap quyen SELECT cho anon!';

    raise notice 'Test thanh cong: RLS anonymous hoc sinh dam bao tuyet doi bao mat.';
end $$;
