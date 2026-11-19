import { supabase } from '../lib/supabaseClient';
import { Resource } from '../types';
import { translateSupabaseError } from '../utils/errorMessages';

/**
 * Lấy danh sách tài nguyên theo loại ('video' | 'link' | 'game') và khối lớp tuỳ chọn
 */
export async function listResources(
  type: 'video' | 'link' | 'game',
  grade?: number
): Promise<Resource[]> {
  let query = supabase
    .from('resources')
    .select('id, type, grade, title, url, thumbnail_url, is_active')
    .eq('type', type);

  if (grade !== undefined) {
    query = query.eq('grade', grade);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(translateSupabaseError(error, 'Không thể tải danh sách tài nguyên. Vui lòng thử lại.'));
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    type: r.type,
    grade: r.grade || undefined,
    title: r.title,
    url: r.url,
    thumbnailUrl: r.thumbnail_url || undefined,
    isActive: r.is_active ?? false,
  }));
}

/**
 * Lấy school_id của người tạo (giáo viên); admin không gắn 1 trường cố định nên lấy
 * trường đầu tiên trong hệ thống, để tiện ích tự thêm luôn có 1 trường sở hữu hợp lệ.
 */
async function resolveCreatorSchoolId(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (uid) {
    const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', uid).maybeSingle();
    if (profile?.school_id) return profile.school_id;
  }
  const { data: firstSchool } = await supabase
    .from('schools')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return firstSchool?.id || null;
}

/**
 * Tạo mới tài nguyên, validate URL hợp lệ (phải bắt đầu bằng http:// hoặc https://)
 */
export async function createResource(input: Omit<Resource, 'id'>): Promise<string> {
  const trimmedUrl = input.url?.trim() || '';
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    throw new Error('URL không hợp lệ');
  }

  const schoolId = await resolveCreatorSchoolId();

  const { data, error } = await supabase
    .from('resources')
    .insert({
      type: input.type,
      grade: input.grade || null,
      title: input.title.trim(),
      url: trimmedUrl,
      thumbnail_url: input.thumbnailUrl?.trim() || null,
      is_active: input.isActive ?? false,
      school_id: schoolId,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(translateSupabaseError(error, 'Không thể lưu liên kết. Vui lòng kiểm tra lại thông tin và thử lại.'));
  }

  return data.id;
}

/**
 * Cập nhật tài nguyên đã có (sửa tiêu đề, URL, khối lớp, ảnh thumbnail)
 */
export async function updateResource(
  id: string,
  input: Partial<Pick<Resource, 'title' | 'url' | 'grade' | 'thumbnailUrl'>>
): Promise<void> {
  const patch: Record<string, any> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.url !== undefined) {
    const trimmedUrl = input.url.trim();
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      throw new Error('URL không hợp lệ');
    }
    patch.url = trimmedUrl;
  }
  if (input.grade !== undefined) patch.grade = input.grade || null;
  if (input.thumbnailUrl !== undefined) patch.thumbnail_url = input.thumbnailUrl?.trim() || null;

  const { error } = await supabase.from('resources').update(patch).eq('id', id);

  if (error) {
    throw new Error(translateSupabaseError(error, 'Không thể cập nhật liên kết. Vui lòng thử lại.'));
  }
}

/**
 * Bật / tắt kích hoạt tài nguyên
 */
export async function setResourceActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('resources')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) {
    throw new Error(translateSupabaseError(error, 'Không thể cập nhật trạng thái tài nguyên. Vui lòng thử lại.'));
  }
}

/**
 * Xóa tài nguyên
 */
export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase.from('resources').delete().eq('id', id);

  if (error) {
    throw new Error(translateSupabaseError(error, 'Không thể xóa tài nguyên. Vui lòng thử lại.'));
  }
}
