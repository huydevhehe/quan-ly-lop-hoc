import { supabase } from '../lib/supabaseClient';
import { UserAccount } from '../types';

export type AuthResult = { profile: UserAccount } | { error: string };
export type StudentJoinResult = { classId: string } | { error: string };

/**
 * Đăng nhập dành cho Giáo viên / Quản trị viên bằng email & mật khẩu qua Supabase Auth
 */
export async function signInStaff(email: string, password: string): Promise<AuthResult> {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (authError || !authData.user) {
    return { error: 'Sai email hoặc mật khẩu' };
  }

  // Lấy profile tương ứng từ database (bảng profiles)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, avatar')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Không tìm thấy hồ sơ người dùng trong hệ thống' };
  }

  const mappedUser: UserAccount = {
    id: profile.id,
    username: profile.email || email,
    fullName: profile.full_name || 'Người dùng',
    role: profile.role as 'admin' | 'teacher',
    status: 'active',
    avatar: profile.avatar || undefined,
    createdAt: new Date().toISOString(),
  };

  return { profile: mappedUser };
}

/**
 * Học sinh đăng nhập ẩn danh và tham gia lớp học thông qua mã phòng (roomCode)
 */
export async function signInStudentWithRoomCode(
  roomCode: string,
  _studentDisplayName?: string
): Promise<StudentJoinResult> {
  const normalizedCode = roomCode.trim().toUpperCase();

  // Đăng nhập Anonymous Auth
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();

  if (authError || !authData.user) {
    return { error: 'Không thể tạo phiên đăng nhập ẩn danh cho học sinh' };
  }

  // Tra cứu xem có lớp nào khớp với room_code không
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('id')
    .eq('room_code', normalizedCode)
    .single();

  if (classError || !classData) {
    // Không tìm thấy phòng -> Hủy phiên anon vừa tạo để tránh rác
    await supabase.auth.signOut();
    return { error: 'Mã phòng không đúng' };
  }

  // Lưu phiên vào bảng room_sessions
  const { error: sessionError } = await supabase.from('room_sessions').insert({
    auth_uid: authData.user.id,
    class_id: classData.id,
  });

  if (sessionError) {
    await supabase.auth.signOut();
    return { error: 'Lỗi khi lưu phiên vào phòng học' };
  }

  return { classId: classData.id };
}

/**
 * Đăng xuất khỏi hệ thống
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Khôi phục phiên đăng nhập thật (nếu có) khi tải lại trang.
 * Trả về null nếu chưa đăng nhập, hoặc đang đăng nhập ẩn danh (học sinh).
 */
export async function restoreSession(): Promise<UserAccount | null> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user || session.user.is_anonymous) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, avatar')
    .eq('id', session.user.id)
    .single();

  if (error || !profile || (profile.role !== 'admin' && profile.role !== 'teacher')) {
    return null;
  }

  return {
    id: profile.id,
    username: profile.email || session.user.email || '',
    fullName: profile.full_name || 'Người dùng',
    role: profile.role,
    status: 'active',
    avatar: profile.avatar || undefined,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Lấy vai trò phiên hiện tại
 */
export async function getCurrentSession(): Promise<{ role: 'admin' | 'teacher' | 'student' | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return { role: null };
  }

  if (session.user.is_anonymous) {
    return { role: 'student' };
  }

  // Tra cứu profile để biết admin hay teacher
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role === 'admin' || profile?.role === 'teacher') {
    return { role: profile.role };
  }

  return { role: 'teacher' };
}
