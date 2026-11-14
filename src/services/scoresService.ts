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


export interface ClassStats {
  classificationCounts: { T: number; H: number; C: number; none: number };
  scoreBuckets: { '9-10': number; '7-8': number; '5-6': number; 'duoi-5': number };
  absenceBuckets: Record<string, number>;
}

/**
 * Thống kê bảng điểm và chuyên cần của lớp học
 */
export async function getClassStats(
  classId: string,
  semester: Semester
): Promise<ClassStats> {
  // 1. Lấy danh sách học sinh của lớp
  const { data: students, error: stdError } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', classId);

  if (stdError) {
    throw new Error(`Lỗi lấy học sinh: ${stdError.message}`);
  }

  const studentList = students || [];
  const totalStudents = studentList.length;

  if (totalStudents === 0) {
    return {
      classificationCounts: { T: 0, H: 0, C: 0, none: 0 },
      scoreBuckets: { '9-10': 0, '7-8': 0, '5-6': 0, 'duoi-5': 0 },
      absenceBuckets: { '0': 0, '1-2': 0, '>2': 0 },
    };
  }

  const studentIds = studentList.map((s: any) => s.id);

  // 2. Lấy điểm số của học sinh trong lớp theo học kỳ
  const { data: scoresData } = await supabase
    .from('scores')
    .select('student_id, total_score, classification')
    .eq('semester', semester);

  const scoreMap = new Map<string, any>();
  for (const item of scoresData || []) {
    if (studentIds.includes(item.student_id)) {
      scoreMap.set(item.student_id, item);
    }
  }

  const classificationCounts = { T: 0, H: 0, C: 0, none: 0 };
  const scoreBuckets = { '9-10': 0, '7-8': 0, '5-6': 0, 'duoi-5': 0 };

  for (const sId of studentIds) {
    const sc = scoreMap.get(sId);
    if (!sc || sc.total_score === null || sc.classification === null) {
      classificationCounts.none++;
    } else {
      if (sc.classification === 'T') classificationCounts.T++;
      else if (sc.classification === 'H') classificationCounts.H++;
      else if (sc.classification === 'C') classificationCounts.C++;
      else classificationCounts.none++;

      const t = Number(sc.total_score);
      if (t >= 9) scoreBuckets['9-10']++;
      else if (t >= 7) scoreBuckets['7-8']++;
      else if (t >= 5) scoreBuckets['5-6']++;
      else scoreBuckets['duoi-5']++;
    }
  }

  // 3. Đếm số buổi vắng không phép từ bảng attendance
  const { data: attData } = await supabase
    .from('attendance')
    .select('student_id, status')
    .eq('status', 'unexcused');

  const absenceCounts = new Map<string, number>();
  for (const a of attData || []) {
    if (studentIds.includes(a.student_id)) {
      absenceCounts.set(a.student_id, (absenceCounts.get(a.student_id) || 0) + 1);
    }
  }

  const absenceBuckets = { '0': 0, '1-2': 0, '>2': 0 };
  for (const sId of studentIds) {
    const count = absenceCounts.get(sId) || 0;
    if (count === 0) absenceBuckets['0']++;
    else if (count <= 2) absenceBuckets['1-2']++;
    else absenceBuckets['>2']++;
  }

  return {
    classificationCounts,
    scoreBuckets,
    absenceBuckets,
  };
}
