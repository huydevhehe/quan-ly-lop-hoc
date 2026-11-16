/**
 * Dịch các lỗi kỹ thuật từ Supabase/Postgres/mạng sang tiếng Việt dễ hiểu,
 * để người dùng (giáo viên/học sinh) luôn thấy thông báo lỗi rõ ràng, không
 * phải message tiếng Anh/mã lỗi Postgres khó hiểu.
 */
export function translateSupabaseError(error: any, fallback: string): string {
  const msg: string = error?.message || String(error || '');

  if (error?.code === '42501' || /row-level security/i.test(msg)) {
    return 'Bạn không có quyền thực hiện thao tác này, hoặc phiên đăng nhập đã hết hạn. Vui lòng tải lại trang và đăng nhập lại.';
  }
  if (/JWT expired|invalid.*token|refresh_token/i.test(msg)) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang và đăng nhập lại.';
  }
  if (/Failed to fetch|NetworkError|network request failed|fetch failed/i.test(msg)) {
    return 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại mạng Internet và thử lại.';
  }
  if (/duplicate key|already exists/i.test(msg)) {
    return 'Dữ liệu này đã tồn tại, vui lòng kiểm tra lại.';
  }
  if (/violates foreign key/i.test(msg)) {
    return 'Dữ liệu liên quan không còn tồn tại (có thể đã bị xóa). Vui lòng tải lại trang.';
  }

  return fallback;
}
