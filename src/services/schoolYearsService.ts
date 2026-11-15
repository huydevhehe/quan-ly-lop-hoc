import { supabase } from '../lib/supabaseClient';

export interface SchoolYearItem {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * Lấy danh sách năm học thật trên server (bảng school_years)
 */
export async function listSchoolYears(): Promise<SchoolYearItem[]> {
  const { data, error } = await supabase
    .from('school_years')
    .select('id, name, is_active')
    .order('name', { ascending: false });

  if (error) {
    throw new Error(`Lỗi khi lấy danh sách năm học: ${error.message}`);
  }

  return (data || []).map((y: any) => ({
    id: y.id,
    name: y.name,
    isActive: Boolean(y.is_active),
  }));
}

/**
 * Tạo mới một năm học (chỉ Quản trị viên được tạo theo luật RLS)
 */
export async function createSchoolYear(name: string): Promise<SchoolYearItem> {
  const { data, error } = await supabase
    .from('school_years')
    .insert({ name: name.trim() })
    .select('id, name, is_active')
    .single();

  if (error || !data) {
    throw new Error(`Không thể tạo năm học mới: ${error?.message || 'Lỗi không xác định'}`);
  }

  return {
    id: data.id,
    name: data.name,
    isActive: Boolean(data.is_active),
  };
}
