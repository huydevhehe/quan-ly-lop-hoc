import { supabase } from '../lib/supabaseClient';
import { Classroom } from '../types';

export interface CreateClassInput {
  name: string;
  grade: number;
  schoolYearId?: string;
  schoolYearName?: string;
  roomCode?: string;
  schoolId?: string;
}

export interface UpdateClassInput {
  name?: string;
  grade?: number;
  isOpen?: boolean;
  schoolYearId?: string;
  roomCode?: string;
}

/**
 * Sinh mã phòng ngẫu nhiên 6 ký tự viết hoa (giữ đúng định dạng cũ như F08AF1)
 */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Lấy danh sách lớp học mà giáo viên/admin có quyền xem (RLS tại Supabase tự lọc)
 */
export async function listMyClasses(): Promise<Classroom[]> {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      id,
      name,
      grade,
      room_code,
      school_year_id,
      school_id,
      is_open,
      created_by,
      created_at,
      students (count),
      school_years (name),
      profiles!classes_created_by_fkey (full_name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Lỗi khi lấy danh sách lớp học: ${error.message}`);
  }

  return (data || []).map((c: any) => {
    const studentCount = Array.isArray(c.students) && c.students[0]?.count != null
      ? c.students[0].count
      : 0;
    const yearName = Array.isArray(c.school_years) ? c.school_years[0]?.name : c.school_years?.name;
    const creatorName = Array.isArray(c.profiles) ? c.profiles[0]?.full_name : c.profiles?.full_name;

    return {
      id: c.id,
      name: c.name,
      grade: c.grade || 1,
      academicYear: yearName || 'Chưa gán năm học',
      totalStudents: studentCount,
      roomCode: c.room_code,
      createdBy: c.created_by || undefined,
      createdByName: creatorName || undefined,
      schoolId: c.school_id || undefined,
    };
  });
}

/**
 * Lấy uid + school_id của người đang tạo lớp: ưu tiên trường của chính người tạo (giáo
 * viên tự tạo lớp của mình), nếu là admin (không gắn 1 trường cố định) và chưa chọn
 * trường thì lấy trường đầu tiên trong hệ thống.
 */
async function resolveCreatorContext(): Promise<{ uid: string | null; schoolId: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id || null;
  if (uid) {
    const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', uid).maybeSingle();
    if (profile?.school_id) return { uid, schoolId: profile.school_id };
  }
  const { data: firstSchool } = await supabase
    .from('schools')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return { uid, schoolId: firstSchool?.id || null };
}

/**
 * Tạo mới lớp học. Giáo viên tự tạo lớp của mình (created_by = chính họ) thì tự động
 * là chủ lớp luôn, không cần admin "Phân công lớp" nữa.
 */
export async function createClass(input: CreateClassInput): Promise<Classroom> {
  const roomCode = input.roomCode?.trim().toUpperCase() || generateRoomCode();
  const { uid, schoolId: defaultSchoolId } = await resolveCreatorContext();
  const schoolId = input.schoolId || defaultSchoolId;

  const { data, error } = await supabase
    .from('classes')
    .insert({
      name: input.name.trim(),
      grade: input.grade,
      room_code: roomCode,
      school_year_id: input.schoolYearId || null,
      school_id: schoolId,
      created_by: uid,
      is_open: true,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Không thể tạo lớp học: ${error?.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    grade: data.grade || 1,
    academicYear: input.schoolYearName || 'Chưa gán năm học',
    totalStudents: 0,
    roomCode: data.room_code,
    schoolId: data.school_id || undefined,
  };
}

/**
 * Cập nhật thông tin lớp học
 */
export async function updateClass(id: string, patch: UpdateClassInput): Promise<void> {
  const updatePayload: Record<string, any> = {};
  if (patch.name !== undefined) updatePayload.name = patch.name.trim();
  if (patch.grade !== undefined) updatePayload.grade = patch.grade;
  if (patch.isOpen !== undefined) updatePayload.is_open = patch.isOpen;
  if (patch.schoolYearId !== undefined) updatePayload.school_year_id = patch.schoolYearId;
  if (patch.roomCode !== undefined) updatePayload.room_code = patch.roomCode.trim().toUpperCase();

  const { error } = await supabase
    .from('classes')
    .update(updatePayload)
    .eq('id', id);

  if (error) {
    throw new Error(`Không thể cập nhật lớp học: ${error.message}`);
  }
}

/**
 * Xóa lớp học
 */
export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Không thể xóa lớp học: ${error.message}`);
  }
}
