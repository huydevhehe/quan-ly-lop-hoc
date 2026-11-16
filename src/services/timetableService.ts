import { supabase } from '../lib/supabaseClient';

/**
 * Luu/doc thoi khoa bieu ca nhan cua giao vien dang dang nhap (1 dong duy nhat theo auth.uid()).
 */
export async function getMyTimetable(): Promise<string[][] | null> {
  const { data, error } = await supabase
    .from('teacher_timetables')
    .select('grid')
    .maybeSingle();

  if (error || !data) return null;
  return (data.grid as string[][]) || null;
}

export async function saveMyTimetable(grid: string[][]): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error('Chưa đăng nhập, không thể lưu thời khóa biểu.');

  const { error } = await supabase
    .from('teacher_timetables')
    .upsert({ teacher_id: uid, grid, updated_at: new Date().toISOString() }, { onConflict: 'teacher_id' });

  if (error) {
    throw new Error(`Không thể lưu thời khóa biểu: ${error.message}`);
  }
}
