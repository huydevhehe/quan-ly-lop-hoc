-- _tests/0001_test.sql
-- Test kiem tra bang profiles va school_years

-- 1. Kiem tra cot va kieu du lieu bang profiles
do $$
begin
    assert exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'
    ), 'profiles.id khong ton tai';
    assert exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
    ), 'profiles.email khong ton tai';
    assert exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
    ), 'profiles.role khong ton tai';
end $$;

-- 2. Kiem tra cot va unique constraint tren school_years.name
do $$
begin
    assert exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' and table_name = 'school_years' and column_name = 'name'
    ), 'school_years.name khong ton tai';
end $$;

-- Test insert unique constraint
insert into public.school_years (name) values ('2026-2027');

do $$
begin
    begin
        insert into public.school_years (name) values ('2026-2027');
        raise exception 'Test that bai: trung school_years.name nhung khong bao loi!';
    exception
        when unique_violation then
            raise notice 'Test thanh cong: duplicate name da bi chan boi unique constraint.';
    end;
end $$;
