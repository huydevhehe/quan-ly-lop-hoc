import { supabase } from '../lib/supabaseClient';

/**
 * Luu/doc thoi khoa bieu ca nhan cua giao vien dang dang nhap, rieng cho tung nam hoc
 * (moi nam hoc 1 ban ghi, khoa chinh la teacher_id + school_year_id).
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

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
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
