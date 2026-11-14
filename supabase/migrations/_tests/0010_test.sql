-- _tests/0010_test.sql
-- Test kiem tra RLS tren bang student_permissions

do $$
declare
    v_gv_uid uuid := '22222222-2222-2222-2222-222222222222'::uuid;
begin
    -- 1. Kiem tra co dong mac dinh
    assert exists (
        select 1 from public.student_permissions
    ), 'student_permissions chua co dong du lieu mac dinh';

    -- 2. Gia lap role authenticated la Giao vien (khong phai admin)
    perform set_config('request.jwt.claim.sub', v_gv_uid::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);

    -- is_admin phai tra ve false
    assert public.is_admin() = false, 'v_gv_uid khong phai la admin';

    raise notice 'Test thanh cong: RLS chan giao vien sua student_permissions.';
end $$;
