import { supabase } from '../lib/supabaseClient';
import { WeekDateRecord } from '../components/ClassroomManager';

/**
 * Lay toan bo ngay bat dau/ket thuc cac tuan da luu cua 1 lop, key theo "classId_weekNumber"
 * (giong dung format key cua state `weeksData` trong ClassroomManager de khong phai doi logic
 * tinh toan tu dong noi suy ngay cho cac tuan chua nhap).
 */
export async function getClassWeekDates(classId: string): Promise<Record<string, WeekDateRecord>> {
  const { data, error } = await supabase
    .from('class_week_dates')
    .select('week_number, start_date, end_date')
    .eq('class_id', classId);

  if (error) {
    throw new Error(`Lỗi khi tải ngày các tuần học: ${error.message}`);
  }

  const result: Record<string, WeekDateRecord> = {};
  for (const row of data || []) {
    if (row.start_date && row.end_date) {
      result[`${classId}_${row.week_number}`] = { start: row.start_date, end: row.end_date };
    }
  }
  return result;
}

export async function saveClassWeekDates(
  classId: string,
  weekNumber: number,
  start: string,
  end: string
): Promise<void> {
  const { error } = await supabase
    .from('class_week_dates')
    .upsert(
      { class_id: classId, week_number: weekNumber, start_date: start || null, end_date: end || null, updated_at: new Date().toISOString() },
      { onConflict: 'class_id,week_number' }
    );

  if (error) {
    throw new Error(`Không thể lưu ngày tuần học: ${error.message}`);
  }
}
