import { supabase } from '../lib/supabaseClient';

export type Semester = 'hk1' | 'ca_nam';

export interface ScoreItem {
  studentId: string;
  theoryScore: number | null;
  practiceScore: number | null;
  totalScore: number | null;
  classification: 'T' | 'H' | 'C' | null;
}

/**
 * Lấy danh sách điểm số theo lớp và học kỳ ('hk1' | 'ca_nam')
 * Cột classification đọc thẳng từ generated column của Postgres, không tự tính ở FE.
 */
export async function getClassScores(
  classId: string,
  semester: Semester
): Promise<ScoreItem[]> {
  const { data, error } = await supabase
    .from('scores')
    .select(`
      student_id,
      theory_score,
      practice_score,
      total_score,
      classification,
      students!inner (
        class_id
      )
    `)
    .eq('students.class_id', classId)
    .eq('semester', semester);

  if (error) {
    throw new Error(`Lỗi khi lấy bảng điểm: ${error.message}`);
  }

  return (data || []).map((item: any) => ({
    studentId: item.student_id,
    theoryScore: item.theory_score !== null ? Number(item.theory_score) : null,
    practiceScore: item.practice_score !== null ? Number(item.practice_score) : null,
    totalScore: item.total_score !== null ? Number(item.total_score) : null,
    classification: item.classification || null,
  }));
}

/**
 * Lưu hoặc cập nhật điểm của học sinh theo học kỳ.
 * Validate khoảng điểm 0-10 cả ở FE và qua Postgres Check Constraint.
 */
export async function saveScore(
  studentId: string,
  semester: Semester,
  theoryScore: number,
  practiceScore: number
): Promise<void> {
  if (
    theoryScore < 0 ||
    theoryScore > 10 ||
    practiceScore < 0 ||
    practiceScore > 10
  ) {
    throw new Error('Điểm số phải nằm trong khoảng từ 0 đến 10');
  }

  const { error } = await supabase
    .from('scores')
    .upsert(
      {
        student_id: studentId,
        semester,
        theory_score: theoryScore,
        practice_score: practiceScore,
      },
      { onConflict: 'student_id,semester' }
    );

  if (error) {
    throw new Error(`Không thể lưu điểm: ${error.message}`);
  }
}
