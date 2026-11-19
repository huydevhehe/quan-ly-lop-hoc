import { supabase } from '../lib/supabaseClient';
import { School } from '../types';

/**
 * Lấy danh sách trường (dùng cho admin chọn/gán giáo viên, lớp học)
 */
export async function listSchools(): Promise<School[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Lỗi khi lấy danh sách trường: ${error.message}`);
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    createdAt: s.created_at,
  }));
}

/**
 * Tạo trường mới
 */
export async function createSchool(name: string): Promise<School> {
  const { data, error } = await supabase
    .from('schools')
    .insert({ name: name.trim() })
    .select('id, name, created_at')
    .single();

  if (error || !data) {
    throw new Error(`Không thể tạo trường: ${error?.message}`);
  }

  return { id: data.id, name: data.name, createdAt: data.created_at };
}

/**
 * Đổi tên trường
 */
export async function renameSchool(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('schools').update({ name: name.trim() }).eq('id', id);
  if (error) {
    throw new Error(`Không thể đổi tên trường: ${error.message}`);
  }
}
