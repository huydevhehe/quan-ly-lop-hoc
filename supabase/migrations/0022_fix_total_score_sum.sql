-- 0022_fix_total_score_sum.sql
-- "Tổng điểm" trước đây tính SAI thành trung bình cộng (lý thuyết + thực hành) / 2,
-- trong khi tên cột là "Tổng" (phải là CỘNG lại). Sửa lại thành cộng thẳng 2 điểm thành
-- phần (mỗi điểm thành phần giữ nguyên, không làm tròn), chỉ làm tròn ở bước tính Tổng
-- (làm tròn .5 lên, đúng hành vi mặc định của round() cho kiểu numeric trong Postgres).
-- Giữ nguyên mốc xếp loại (>=9: T, >=5: H, còn lại: C) vì mỗi điểm thành phần tối đa 5,
-- nên Tổng tối đa vẫn là 10 như thang điểm cũ.

alter table public.scores drop column total_score;
alter table public.scores drop column classification;

alter table public.scores add column total_score numeric(4,1) generated always as (
    round(coalesce(theory_score, 0::numeric) + coalesce(practice_score, 0::numeric), 0)
) stored;

alter table public.scores add column classification text generated always as (
    case
        when round(coalesce(theory_score, 0::numeric) + coalesce(practice_score, 0::numeric), 0) >= 9::numeric then 'T'
        when round(coalesce(theory_score, 0::numeric) + coalesce(practice_score, 0::numeric), 0) >= 5::numeric then 'H'
        else 'C'
    end
) stored;
