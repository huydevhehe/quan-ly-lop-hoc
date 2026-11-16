import { supabase } from '../lib/supabaseClient';
import { translateSupabaseError } from '../utils/errorMessages';

export async function uploadQuestionImage(
  file: File
): Promise<{ url: string } | { error: string }> {
  // 1. Kiểm tra kích thước file (tối đa 2MB)
  if (file.size > 2 * 1024 * 1024) {
    return { error: 'Kích thước ảnh không được vượt quá 2MB' };
  }

  // 2. Kiểm tra định dạng (chỉ chấp nhận JPEG / PNG)
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    return { error: 'Định dạng ảnh không hợp lệ (chỉ chấp nhận JPG hoặc PNG)' };
  }

  try {
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const fileName = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('quiz-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return { error: translateSupabaseError(uploadError, 'Không thể tải ảnh lên. Vui lòng thử lại.') };
    }

    const { data } = supabase.storage.from('quiz-images').getPublicUrl(fileName);

    return { url: data.publicUrl };
  } catch (err: any) {
    return { error: err.message || 'Lỗi xử lý tải ảnh' };
  }
}
