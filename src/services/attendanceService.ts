import { supabase } from '../lib/supabaseClient';

export type AttendanceStatus = 'present' | 'excused' | 'unexcused';

export interface AttendanceRecord {
  status: AttendanceStatus;
  note?: string;
}

export interface SaveAttendanceInput {
  studentId: string;
  status: AttendanceStatus;
  note?: string;
}

/**
 * Lấy dữ liệu điểm danh theo lớp và số tuần (1-35)
 * Trả về Map / Record với key là student_id
 */
export async function getWeekAttendance(
  classId: string,
  weekNumber: number
): Promise<Record<string, AttendanceRecord>> {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      student_id,
      status,
      note,
      students!inner (
        class_id
      )
    `)
    .eq('students.class_id', classId)
    .eq('week_number', weekNumber);

  if (error) {
    throw new Error(`Lỗi khi tải điểm danh tuần ${weekNumber}: ${error.message}`);
  }

  const result: Record<string, AttendanceRecord> = {};
  for (const item of data || []) {
    result[item.student_id] = {
      status: item.status as AttendanceStatus,
      note: item.note || undefined,
    };
  }

  return result;
}

/**
 * Lưu / cập nhật điểm danh cả tuần cho danh sách học sinh (upsert tránh tạo dòng trùng)
 */
export async function saveWeekAttendance(
  weekNumber: number,
  records: SaveAttendanceInput[]
): Promise<void> {
  if (records.length === 0) return;

  const payload = records.map((r) => ({
    student_id: r.studentId,
    week_number: weekNumber,
    status: r.status,
    note: r.note || null,
  }));

  const { error } = await supabase
    .from('attendance')
    .upsert(payload, { onConflict: 'student_id,week_number' });

  if (error) {
    throw new Error(`Không thể lưu điểm danh tuần ${weekNumber}: ${error.message}`);
  }
}

/**
 * Lấy nhận xét / đánh giá tuần của lớp theo số tuần (1-35)
 * Trả về Map / Record với key là student_id, value là chuỗi nhận xét
 */
export async function getWeekEvaluations(
  classId: string,
  weekNumber: number
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('weekly_evaluations')
    .select(`
      student_id,
      comment,
      students!inner (
        class_id
      )
    `)
    .eq('students.class_id', classId)
    .eq('week_number', weekNumber);

  if (error) {
    throw new Error(`Lỗi khi tải nhận xét tuần ${weekNumber}: ${error.message}`);
  }

  const result: Record<string, string> = {};
  for (const item of data || []) {
    if (item.comment) {
      result[item.student_id] = item.comment;
    }
  }

  return result;
}

/**
 * Lưu / cập nhật nhận xét tuần cho 1 học sinh
 */
export async function saveWeekEvaluation(
  studentId: string,
  weekNumber: number,
  comment: string
): Promise<void> {
  const { error } = await supabase
    .from('weekly_evaluations')
    .upsert(
      {
        student_id: studentId,
        week_number: weekNumber,
        comment: comment.trim(),
      },
      { onConflict: 'student_id,week_number' }
    );

  if (error) {
    throw new Error(`Không thể lưu nhận xét: ${error.message}`);
  }
}
