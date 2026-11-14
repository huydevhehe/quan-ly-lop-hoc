-- _tests/0005_test.sql
-- Test kiem tra bang resources va check constraint tren cot type

do $$
declare
    v_res_id uuid;
begin
    -- 1. Insert hop le: type='game'
    insert into public.resources (type, grade, title, url, is_active)
    values ('game', 5, 'Tro choi toan hoc', 'https://game.example.com', true)
    returning id into v_res_id;

    assert v_res_id is not null, 'Insert resource hop le that bai';

    -- 2. Insert type='movie' khong nam trong check ('video','link','game') -> phai loi
    begin
        insert into public.resources (type, grade, title, url, is_active)
        values ('movie', 5, 'Phim hoat hinh', 'https://movie.example.com', true);
        raise exception 'Test that bai: type khong hop le nhung khong bi check constraint chan!';
    exception
        when check_violation then
            raise notice 'Test thanh cong: check constraint chan dung type khong hop le.';
    end;
end $$;
