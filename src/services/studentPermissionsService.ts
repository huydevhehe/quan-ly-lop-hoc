import { supabase } from '../lib/supabaseClient';
import { StudentPermissions } from '../types';

export const studentPermissionsService = {
  /**
   * Lấy cấu hình phân quyền xem của học sinh
   */
  async getPermissions(): Promise<StudentPermissions> {
    const { data, error } = await supabase
      .from('student_permissions')
      .select('can_view_classroom, can_view_quiz, can_view_resources, can_view_games, can_view_utilities')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Giá trị mặc định
      return {
        canViewClassroom: true,
        canViewQuiz: true,
        canViewResources: true,
        canViewGames: true,
        canViewUtilities: true,
      };
    }

    return {
      canViewClassroom: data.can_view_classroom ?? true,
      canViewQuiz: data.can_view_quiz ?? true,
      canViewResources: data.can_view_resources ?? true,
      canViewGames: data.can_view_games ?? true,
      canViewUtilities: data.can_view_utilities ?? true,
    };
  },

  /**
   * Cập nhật quyền xem của học sinh (chỉ Admin mới được phép qua RLS)
   */
  async updatePermissions(patch: Partial<StudentPermissions>): Promise<void> {
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (patch.canViewClassroom !== undefined) payload.can_view_classroom = patch.canViewClassroom;
    if (patch.canViewQuiz !== undefined) payload.can_view_quiz = patch.canViewQuiz;
    if (patch.canViewResources !== undefined) payload.can_view_resources = patch.canViewResources;
    if (patch.canViewGames !== undefined) payload.can_view_games = patch.canViewGames;
    if (patch.canViewUtilities !== undefined) payload.can_view_utilities = patch.canViewUtilities;

    // Lấy ID dòng hiện tại
    const { data: existing } = await supabase
      .from('student_permissions')
      .select('id')
      .limit(1)
      .single();

    if (existing?.id) {
      const { error } = await supabase
        .from('student_permissions')
        .update(payload)
        .eq('id', existing.id);

      if (error) {
        throw new Error(`Không thể cập nhật quyền học sinh: ${error.message}`);
      }
    }
  },
};
