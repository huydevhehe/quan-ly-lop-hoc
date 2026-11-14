import { supabase } from '../lib/supabaseClient';

export type CommentType = 'T' | 'H';

export interface CommentBankEntry {
  comments: string[];
  fileName?: string;
}

/**
 * Lấy toàn bộ ngân hàng nhận xét của 1 loại (T hoặc H), theo từng khối (1-5).
 * Khối nào chưa có dữ liệu riêng thì không xuất hiện trong kết quả (caller tự dùng mặc định).
 */
export async function getAllCommentBanks(type: CommentType): Promise<Record<string, CommentBankEntry>> {
  const { data, error } = await supabase
    .from('comment_bank')
    .select('grade, comments, file_name')
    .eq('type', type);

  if (error) {
    throw new Error(`Lỗi khi tải ngân hàng nhận xét: ${error.message}`);
  }

  const result: Record<string, CommentBankEntry> = {};
  for (const row of data || []) {
    result[String(row.grade)] = {
      comments: Array.isArray(row.comments) ? (row.comments as string[]) : [],
      fileName: row.file_name || undefined,
    };
  }
  return result;
}

/**
 * Lưu/cập nhật ngân hàng nhận xét của 1 khối, 1 loại (T hoặc H).
 */
export async function setCommentBank(
  type: CommentType,
  grade: number,
  comments: string[],
  fileName?: string
): Promise<void> {
  const { error } = await supabase.from('comment_bank').upsert(
    {
      type,
      grade,
      comments,
      file_name: fileName ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'type,grade' }
  );

  if (error) {
    throw new Error(`Không thể lưu ngân hàng nhận xét: ${error.message}`);
  }
}
