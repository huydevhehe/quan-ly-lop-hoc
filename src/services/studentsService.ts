import { supabase } from '../lib/supabaseClient';
import { Student } from '../types';

export interface StudentInput {
  code: string;
  name: string;
  gender?: 'Nam' | 'Nữ' | string;
  dob?: string;
  avatar?: string;
}

/**
 * Lấy danh sách học sinh theo lớp
 */
export async function listStudentsByClass(classId: string): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, class_id, student_code, full_name, avatar, created_at')
    .eq('class_id', classId)
    .order('student_code', { ascending: true });

  if (error) {
    throw new Error(`Lỗi khi lấy danh sách học sinh: ${error.message}`);
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    classId: s.class_id,
    code: s.student_code,
    name: s.full_name,
    gender: (s.gender as 'Nam' | 'Nữ') || 'Nam',
    dob: s.dob || '2018-01-01',
    avatar: s.avatar || '',
    attendance: 'present',
    stars: 0,
    speeches: 0,
  }));
}

/**
 * Thêm danh sách học sinh vào lớp.
 * Giữ nguyên lỗi vi phạm Unique Constraint của Postgres nếu mã học sinh trùng lặp trong cùng một lớp.
 */
export async function upsertStudents(classId: string, students: StudentInput[]): Promise<Student[]> {
  if (students.length === 0) return [];

  const payload = students.map((s) => ({
    class_id: classId,
    student_code: s.code.trim(),
    full_name: s.name.trim(),
    avatar: s.avatar || null,
  }));

  const { data, error } = await supabase
    .from('students')
    .insert(payload)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    classId: s.class_id,
    code: s.student_code,
    name: s.full_name,
    gender: (s.gender as 'Nam' | 'Nữ') || 'Nam',
    dob: s.dob || '2018-01-01',
    avatar: s.avatar || '',
    attendance: 'present',
    stars: 0,
    speeches: 0,
  }));
}

/**
 * Xóa học sinh theo ID
 */
export async function deleteStudent(id: string): Promise<void> {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Không thể xóa học sinh: ${error.message}`);
  }
}
