-- 0016_room_code_lookup_fn.sql
-- Fix: hoc sinh anonymous KHONG BAO GIO join duoc lop qua ma phong, vi policy
-- "classes_anon_select" (0007_rls_student_anon.sql) chi cho xem lop SAU KHI da
-- co room_sessions, nhung buoc tra cuu class id TU room_code lai xay ra TRUOC
-- khi co room_sessions nao ca (vong luan quan). Dung ham SECURITY DEFINER rieng
-- cho buoc tra cuu nay, khong mo rong quyen SELECT tren toan bang classes cho anon.

create or replace function public.find_class_id_by_room_code(p_room_code text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.classes where room_code = upper(trim(p_room_code)) limit 1;
$$;

grant execute on function public.find_class_id_by_room_code(text) to anon;
