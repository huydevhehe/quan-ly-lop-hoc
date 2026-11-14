import { supabase } from '../lib/supabaseClient';
import { Resource } from '../types';

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
    throw new Error(`Lỗi khi lấy danh sách tài nguyên: ${error.message}`);
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
 * Tạo mới tài nguyên, validate URL hợp lệ (phải bắt đầu bằng http:// hoặc https://)
 */
export async function createResource(input: Omit<Resource, 'id'>): Promise<string> {
  const trimmedUrl = input.url?.trim() || '';
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    throw new Error('URL không hợp lệ');
  }

  const { data, error } = await supabase
    .from('resources')
    .insert({
      type: input.type,
      grade: input.grade || null,
      title: input.title.trim(),
      url: trimmedUrl,
      thumbnail_url: input.thumbnailUrl?.trim() || null,
      is_active: input.isActive ?? false,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Không thể tạo tài nguyên: ${error?.message}`);
  }

  return data.id;
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
    throw new Error(`Không thể cập nhật trạng thái tài nguyên: ${error.message}`);
  }
}

/**
 * Xóa tài nguyên
 */
export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase.from('resources').delete().eq('id', id);

  if (error) {
    throw new Error(`Không thể xóa tài nguyên: ${error.message}`);
  }
}
