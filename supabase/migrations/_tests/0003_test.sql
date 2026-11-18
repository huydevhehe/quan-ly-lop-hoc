-- _tests/0003_test.sql
-- Test kiem tra bang attendance, weekly_evaluations va scores

do $$
declare
    v_class_id uuid;
    v_student_id uuid;
    v_rec record;
begin
    -- Tao lop va hoc sinh test
    insert into public.classes (name, grade, room_code)
    values ('Lop 5B', 5, 'TEST03')
    returning id into v_class_id;

    insert into public.students (class_id, student_code, full_name)
    values (v_class_id, 'HS_TEST', 'Tran Van Test')
    returning id into v_student_id;

    -- 1. Test scores voi T: theory=4.5, practice=4.5 -> total=9 (cong thang, khong chia 2),
    -- classification='T' (moi diem thanh phan toi da 5, nen Tong toi da la 10)
    insert into public.scores (student_id, semester, theory_score, practice_score)
    values (v_student_id, 'hk1', 4.5, 4.5);

    select total_score, classification into v_rec
    from public.scores
    where student_id = v_student_id and semester = 'hk1';

    assert v_rec.total_score = 9 and v_rec.classification = 'T',
        format('Test HK1 that bai: expected total=9, classification=T, got total=%s, class=%s', v_rec.total_score, v_rec.classification);

    -- 2. Test lam tron .5 len: theory=2.3, practice=2.2 -> tong tho = 4.5 -> lam tron len thanh
    -- 5 (khong lam tron xuong 4), classification='H'. Su dung ca_nam.
    insert into public.scores (student_id, semester, theory_score, practice_score)
    values (v_student_id, 'ca_nam', 2.3, 2.2);

    select total_score, classification into v_rec
    from public.scores
    where student_id = v_student_id and semester = 'ca_nam';

    assert v_rec.total_score = 5 and v_rec.classification = 'H',
        format('Test ca_nam that bai (lam tron .5 len): expected total=5, classification=H, got total=%s, class=%s', v_rec.total_score, v_rec.classification);

    -- 3. Test duplicate (student_id, semester) -> phai loi unique_violation
    begin
        insert into public.scores (student_id, semester, theory_score, practice_score)
        values (v_student_id, 'hk1', 8.0, 8.0);
        raise exception 'Test that bai: trung (student_id, semester) nhung khong bao loi!';
    exception
        when unique_violation then
            raise notice 'Test thanh cong: unique constraint tren scores(student_id, semester) hoat dong chuan xac.';
    end;
end $$;
