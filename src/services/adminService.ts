import { supabase } from '../lib/supabaseClient';
import { UserAccount } from '../types';

export const adminService = {
  /**
   * Lấy danh sách tài khoản nhân viên (giáo viên, admin) từ bảng profiles
   */
  async listStaff(): Promise<UserAccount[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Lỗi khi lấy danh sách tài khoản: ${error.message}`);
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      username: p.email || 'user',
      fullName: p.full_name || 'Giáo viên',
      role: p.role as 'admin' | 'teacher',
      status: 'active',
      avatar: p.avatar || undefined,
      createdAt: p.created_at || new Date().toISOString(),
    }));
  },

  /**
   * Tạo tài khoản giáo viên mới thông qua Edge Function `create-staff-account`
   * (sử dụng service_role key ở server-side để tạo user trong auth.users)
   */
  async createStaffAccount(
    email: string,
    password: string,
    fullName: string
  ): Promise<{ userId: string } | { error: string }> {
    const { data, error } = await supabase.functions.invoke('create-staff-account', {
      body: { email, password, fullName, role: 'teacher' },
    });

    if (error) {
      return { error: error.message || 'Lỗi khi gọi tạo tài khoản' };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { userId: data?.userId || '' };
  },

  /**
   * Gán giáo viên phụ trách cho lớp học (cập nhật trường created_by)
   */
  async assignTeacherToClass(classId: string, teacherId: string): Promise<void> {
    const { error } = await supabase
      .from('classes')
      .update({ created_by: teacherId })
      .eq('id', classId);

    if (error) {
      throw new Error(`Không thể gán giáo viên cho lớp: ${error.message}`);
    }
  },
};
