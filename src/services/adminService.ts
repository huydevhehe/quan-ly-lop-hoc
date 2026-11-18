import { supabase } from '../lib/supabaseClient';
import { UserAccount } from '../types';

export const adminService = {
  /**
   * Lấy danh sách tài khoản nhân viên (giáo viên, admin) từ bảng profiles
   */
  async listStaff(): Promise<UserAccount[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Lỗi khi lấy danh sách tài khoản: ${error.message}`);
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      username: p.email || 'user',
      fullName: p.full_name || 'Giáo viên',
      role: p.role as 'admin' | 'teacher',
      status: p.status === 'locked' ? 'locked' : 'active',
      avatar: p.avatar || undefined,
      createdAt: p.created_at || new Date().toISOString(),
    }));
  },

  /**
   * Cập nhật họ tên / vai trò của tài khoản (ghi thật vào bảng profiles)
   */
  async updateStaffProfile(id: string, patch: { fullName?: string; role?: 'admin' | 'teacher' }): Promise<void> {
    const updatePayload: Record<string, any> = {};
    if (patch.fullName !== undefined) updatePayload.full_name = patch.fullName.trim();
    if (patch.role !== undefined) updatePayload.role = patch.role;

    const { error } = await supabase.from('profiles').update(updatePayload).eq('id', id);
    if (error) {
      throw new Error(`Không thể cập nhật tài khoản: ${error.message}`);
    }
  },

  /**
   * Đổi mật khẩu đăng nhập thật của tài khoản qua Edge Function `manage-staff-account`
   */
  async resetStaffPassword(userId: string, newPassword: string): Promise<{ error?: string }> {
    const { data, error } = await supabase.functions.invoke('manage-staff-account', {
      body: { action: 'reset_password', userId, newPassword },
    });
    if (error) return { error: error.message || 'Lỗi khi đổi mật khẩu' };
    if (data?.error) return { error: data.error };
    return {};
  },

  /**
   * Khóa / mở tài khoản thật (chặn đăng nhập) qua Edge Function `manage-staff-account`
   */
  async setStaffLocked(userId: string, locked: boolean): Promise<{ error?: string }> {
    const { data, error } = await supabase.functions.invoke('manage-staff-account', {
      body: { action: 'set_ban', userId, banned: locked },
    });
    if (error) return { error: error.message || 'Lỗi khi khóa/mở tài khoản' };
    if (data?.error) return { error: data.error };

    await supabase.from('profiles').update({ status: locked ? 'locked' : 'active' }).eq('id', userId);
    return {};
  },

  /**
   * Xóa hẳn tài khoản (cả đăng nhập lẫn hồ sơ) qua Edge Function `manage-staff-account`
   */
  async deleteStaffAccount(userId: string): Promise<{ error?: string }> {
    const { data, error } = await supabase.functions.invoke('manage-staff-account', {
      body: { action: 'delete', userId },
    });
    if (error) return { error: error.message || 'Lỗi khi xóa tài khoản' };
    if (data?.error) return { error: data.error };
    return {};
  },

  /**
   * Tạo tài khoản giáo viên mới thông qua Edge Function `create-staff-account`
   * (sử dụng service_role key ở server-side để tạo user trong auth.users)
   */
  async createStaffAccount(
    email: string,
    password: string,
    fullName: string,
    role: 'admin' | 'teacher' = 'teacher'
  ): Promise<{ userId: string } | { error: string }> {
    const { data, error } = await supabase.functions.invoke('create-staff-account', {
      body: { email, password, fullName, role },
    });

    if (error) {
      // Supabase-js chỉ trả message chung "Edge Function returned a non-2xx
      // status code" khi function trả lỗi; lý do thật nằm trong body response
      // (error.context), nên phải tự đọc lại để báo đúng cho người dùng.
      const context = (error as any).context;
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json();
          if (body?.error) {
            return { error: body.error };
          }
        } catch {
          // body không phải JSON hợp lệ, dùng message mặc định bên dưới
        }
      }
      return { error: error.message || 'Lỗi khi gọi tạo tài khoản' };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { userId: data?.userId || '' };
  },

  /**
   * Tự đổi mật khẩu của chính tài khoản đang đăng nhập (xác thực lại mật khẩu cũ trước khi đổi)
   */
  async changeOwnPassword(
    email: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ error?: string }> {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: oldPassword });
    if (signInError) {
      return { error: 'Mật khẩu cũ không chính xác!' };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { error: error.message || 'Không thể đổi mật khẩu' };
    }
    return {};
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
