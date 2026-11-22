import { supabase } from '../lib/supabaseClient';

/**
 * Luu/doc thoi khoa bieu ca nhan cua giao vien dang dang nhap, rieng cho tung NAM HOC
 * (giao vien chi can biet buoi do day lop nao trong 1 tuan, khac truong/khac giao vien
 * thi rieng vi khoa chinh la teacher_id + school_year_id).
 */
export async function getMyTimetable(schoolYearId: string): Promise<string[][] | null> {
  if (!schoolYearId) return null;

  const { data, error } = await supabase
    .from('teacher_timetables')
    .select('grid')
    .eq('school_year_id', schoolYearId)
    .maybeSingle();

  if (error || !data) return null;
  return (data.grid as string[][]) || null;
}

export async function saveMyTimetable(grid: string[][], schoolYearId: string): Promise<void> {
  if (!schoolYearId) throw new Error('Chưa chọn năm học, không thể lưu thời khóa biểu.');

  const { data: sessionRes } = await supabase.auth.getSession();
  const uid = sessionRes?.session?.user?.id;
  if (!uid) throw new Error('Chưa đăng nhập, không thể lưu thời khóa biểu.');

  const { error } = await supabase
    .from('teacher_timetables')
    .upsert(
      { teacher_id: uid, school_year_id: schoolYearId, grid, updated_at: new Date().toISOString() },
      { onConflict: 'teacher_id,school_year_id' }
    );

  if (error) {
    throw new Error(`Không thể lưu thời khóa biểu: ${error.message}`);
  }
}

export async function deleteMyTimetable(schoolYearId: string): Promise<void> {
  if (!schoolYearId) return;

  const { data: sessionRes } = await supabase.auth.getSession();
  const uid = sessionRes?.session?.user?.id;
  if (!uid) throw new Error('Chưa đăng nhập, không thể xóa thời khóa biểu.');

  const { error } = await supabase
    .from('teacher_timetables')
    .delete()
    .eq('teacher_id', uid)
    .eq('school_year_id', schoolYearId);

  if (error) {
    throw new Error(`Không thể xóa thời khóa biểu: ${error.message}`);
  }
}
