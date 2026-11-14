-- _tests/0002_test.sql
-- Test kiem tra bang classes, students, room_sessions

-- 1. Test insert classes
do $$
declare
    v_class_id uuid;
begin
    insert into public.classes (name, grade, room_code)
    values ('Lop 5A', 5, 'F08AF1')
    returning id into v_class_id;

    -- 2. Insert 2 students cung class_id khac student_code -> thanh cong
    insert into public.students (class_id, student_code, full_name)
    values (v_class_id, 'HS01', 'Nguyen Van A');

    insert into public.students (class_id, student_code, full_name)
    values (v_class_id, 'HS02', 'Tran Thi B');

    -- 3. Insert student trung student_code trong cung class_id -> phai loi unique_violation
    begin
        insert into public.students (class_id, student_code, full_name)
        values (v_class_id, 'HS01', 'Le Van C');
        raise exception 'Test that bai: trung student_code trong cung lop nhung khong bao loi!';
    exception
        when unique_violation then
            raise notice 'Test thanh cong: unique constraint tren (class_id, student_code) hoat dong chuan xac.';
    end;
end $$;
