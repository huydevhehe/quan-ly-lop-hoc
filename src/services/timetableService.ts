import { supabase } from '../lib/supabaseClient';

/**
 * Luu/doc thoi khoa bieu ca nhan cua giao vien dang dang nhap, rieng cho tung LOP
 * (moi lop 1 ban ghi, khoa chinh la teacher_id + class_id).
 */
export async function getMyTimetable(classId: string): Promise<string[][] | null> {
  if (!classId) return null;

  const { data, error } = await supabase
    .from('teacher_timetables')
    .select('grid')
    .eq('class_id', classId)
    .maybeSingle();

  if (error || !data) return null;
  return (data.grid as string[][]) || null;
}

export async function saveMyTimetable(grid: string[][], classId: string): Promise<void> {
  if (!classId) throw new Error('Chưa chọn lớp, không thể lưu thời khóa biểu.');

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error('Chưa đăng nhập, không thể lưu thời khóa biểu.');

  const { error } = await supabase
    .from('teacher_timetables')
    .upsert(
      { teacher_id: uid, class_id: classId, grid, updated_at: new Date().toISOString() },
      { onConflict: 'teacher_id,class_id' }
    );

  if (error) {
    throw new Error(`Không thể lưu thời khóa biểu: ${error.message}`);
  }
}

export async function deleteMyTimetable(classId: string): Promise<void> {
  if (!classId) return;

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error('Chưa đăng nhập, không thể xóa thời khóa biểu.');

  const { error } = await supabase
    .from('teacher_timetables')
    .delete()
    .eq('teacher_id', uid)
    .eq('class_id', classId);

  if (error) {
    throw new Error(`Không thể xóa thời khóa biểu: ${error.message}`);
  }
}
