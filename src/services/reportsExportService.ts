import { supabase } from '../lib/supabaseClient';
import { AttendanceStatus } from './attendanceService';
import { CommentBankEntry } from './commentBankService';

export type ReportTerm = 'hk1' | 'hk2';

/**
 * Ranh giới số tuần cho Học kỳ 1 / Cả năm.
 * Codebase hiện tại (ClassroomManager.tsx) chỉ có 1 bộ chọn tuần dùng chung 1-35, không có
 * ranh giới HK1/HK2 được định nghĩa sẵn ở đâu khác, nên dùng quy ước phổ biến của chương trình
 * (Học kỳ 1 = tuần 1-18, Cả năm = tuần 1-35) làm mốc tổng hợp điểm danh cho báo cáo.
 */
export const HK1_END_WEEK = 18;
export const TOTAL_WEEKS = 35;

export function getWeekRangeForTerm(term: ReportTerm): { start: number; end: number } {
  return term === 'hk1' ? { start: 1, end: HK1_END_WEEK } : { start: 1, end: TOTAL_WEEKS };
}

export interface StudentAttendanceSummary {
  present: number;
  excused: number;
  unexcused: number;
}

export interface StudentAttendanceWeek {
  weekNumber: number;
  status: AttendanceStatus;
}

/**
 * Tổng hợp điểm danh (số buổi có mặt / vắng có phép / vắng không phép) theo khoảng tuần,
 * cho nhiều lớp cùng lúc. Dùng cho bảng tổng quan dashboard và xuất Excel tổng hợp.
 */
export async function getAttendanceSummaryForClasses(
  classIds: string[],
  weekStart: number,
  weekEnd: number
): Promise<Record<string, StudentAttendanceSummary>> {
  const result: Record<string, StudentAttendanceSummary> = {};
  if (classIds.length === 0) return result;

  const { data, error } = await supabase
    .from('attendance')
    .select(
      `
      student_id,
      status,
      week_number,
      students!inner ( class_id )
    `
    )
    .in('students.class_id', classIds)
    .gte('week_number', weekStart)
    .lte('week_number', weekEnd);

  if (error) {
    throw new Error(`Lỗi khi tải tổng hợp điểm danh: ${error.message}`);
  }

  for (const item of (data as any[]) || []) {
    const sId = item.student_id as string;
    if (!result[sId]) {
      result[sId] = { present: 0, excused: 0, unexcused: 0 };
    }
    const status = item.status as AttendanceStatus;
    if (status === 'present') result[sId].present++;
    else if (status === 'excused') result[sId].excused++;
    else if (status === 'unexcused') result[sId].unexcused++;
  }

  return result;
}

/**
 * Lấy lịch sử điểm danh theo từng tuần của 1 học sinh trong khoảng tuần cho trước.
 * Dùng cho modal chi tiết học sinh.
 */
export async function getStudentAttendanceHistory(
  studentId: string,
  weekStart: number,
  weekEnd: number
): Promise<StudentAttendanceWeek[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('week_number, status')
    .eq('student_id', studentId)
    .gte('week_number', weekStart)
    .lte('week_number', weekEnd)
    .order('week_number', { ascending: true });

  if (error) {
    throw new Error(`Lỗi khi tải lịch sử điểm danh học sinh: ${error.message}`);
  }

  return ((data as any[]) || []).map((d) => ({
    weekNumber: d.week_number as number,
    status: d.status as AttendanceStatus,
  }));
}

// ---------------------------------------------------------------------------
// Ngân hàng nhận xét mặc định theo Khối (sao chép nguyên văn từ
// StudentCommentsManager.tsx để kết quả nhận xét trong báo cáo tổng hợp luôn
// khớp với chức năng "Xuất đánh giá Excel" đã có — không đổi nội dung câu nào).
// ---------------------------------------------------------------------------

export const DEFAULT_GRADE_COMMENTS_T: Record<string, string[]> = {
  '1': [
    'Em học giỏi, tiếp thu bài nhanh và thực hành tốt.',
    'Em chăm ngoan, làm quen với máy tính nhanh và thao tác chuột khéo léo.',
    'Em thực hành tốt các bài tập sử dụng chuột và nhận biết các bộ phận máy tính.',
    'Biết cách cầm chuột đúng cách, nhấp chuột và kéo thả chính xác.',
    'Hào hứng học tập, nhận biết nhanh màn hình, bàn phím và thân máy.',
    'Thực hành vẽ và tô màu phần mềm Paint rất khéo léo, sáng tạo.',
    'Ngồi đúng tư thế khi ngồi trước máy tính, giữ gìn thiết bị tốt.',
    'Tiếp thu bài nhanh, làm quen với bàn phím và gõ phím cơ bản rất tốt.',
    'Thực hành tốt, tích cực tham gia các trò chơi học tập trên máy tính.',
  ],
  '2': [
    'Em gõ phím nhanh, rèn luyện tư thế gõ 10 ngón đúng vị trí.',
    'Sử dụng chuột và bàn phím thành thạo, hoàn thành tốt các bài luyện gõ.',
    'Em thao tác trên phần mềm học tập tự tin và chuẩn xác.',
    'Có ý thức học tập tốt, mở và lưu bài vẽ đúng theo hướng dẫn.',
    'Nhớ vị trí các phím chức năng cơ bản như Enter, Spacebar, Backspace.',
    'Thực hành luyện gõ từ ngữ nhanh và chính xác.',
    'Chăm chỉ luyện tập gõ phím, hoàn thành xuất sắc các yêu cầu bài học.',
    'Thực hành thành thạo các thao tác cơ bản trên máy tính.',
  ],
  '3': [
    'Em thao tác tệp và thư mục nhanh chóng, biết cách lưu bài gọn gàng.',
    'Gõ tiếng Việt có dấu thành thạo theo kiểu gõ Telex/Vni.',
    'Tạo và đổi tên thư mục đúng quy định, biết quản lý dữ liệu học tập.',
    'Sử dụng phần mềm Unikey tốt, gõ đúng chính tả tiếng Việt.',
    'Biết tìm kiếm tranh ảnh trên Internet phục vụ cho việc học tập.',
    'Thao tác sao chép, di chuyển tệp và thư mục rất thành thạo.',
    'Làm bài thực hành nhanh, giúp đỡ bạn bè cùng hoàn thành bài tập.',
    'Hiểu bài sâu sắc, có kỹ năng sử dụng máy tính và quản lý tệp tốt.',
  ],
  '4': [
    'Soạn thảo văn bản và chèn hình ảnh trên Word rất đẹp mắt và chuẩn xác.',
    'Biết định dạng phông chữ, cỡ chữ, màu sắc và căn lề văn bản đúng chuẩn.',
    'Tạo bài trình chiếu PowerPoint sinh động, biết chèn hình và tạo hiệu ứng.',
    'Sử dụng bảng biểu và chèn tranh ảnh vào văn bản một cách sáng tạo.',
    'Biết sử dụng Internet an toàn, tìm kiếm thông tin học tập hiệu quả.',
    'Thực hành soạn thảo nhanh, bố cục trang văn bản hài hòa, rõ ràng.',
    'Thuyết trình tự tin với các slide trình chiếu tự thiết kế.',
    'Kỹ năng tin học xuất sắc, sáng tạo trong các bài thực hành.',
  ],
  '5': [
    'Tư duy lập trình tốt, hoàn thành xuất sắc các dự án Scratch/Logo.',
    'Thiết kế bài trình chiếu đa phương tiện ấn tượng, bố cục chuyên nghiệp.',
    'Nắm vững thuật toán cơ bản, biết điều khiển nhân vật chuyển động sáng tạo.',
    'Sử dụng phần mềm bảng tính và lập công thức tính toán thành thạo.',
    'Có khả năng tự học và giải quyết các bài toán lập trình rất tốt.',
    'Kỹ năng công nghệ thông tin nổi bật, tư duy logic và sáng tạo cao.',
    'Tích cực trao đổi, sáng tạo nhiều sản phẩm tin học có tính ứng dụng cao.',
    'Thao tác máy tính điêu luyện, tự tin thuyết trình sản phẩm công nghệ.',
  ],
};

export const DEFAULT_GRADE_COMMENTS_H: Record<string, string[]> = {
  '1': [
    'Em hoàn thành các nội dung bài học theo yêu cầu.',
    'Em hoàn thành nội dung làm quen với máy tính theo yêu cầu.',
    'Đã biết cách cầm chuột và nhấp chuột, cần rèn thêm kỹ năng kéo thả.',
    'Nhận biết được các bộ phận cơ bản của máy tính, chăm chú nghe giảng.',
    'Hoàn thành bài thực hành tô màu trên máy, cần chú ý tư thế ngồi học.',
    'Biết thao tác bật/tắt máy theo hướng dẫn của thầy cô.',
    'Có cố gắng trong các tiết thực hành, cần tự tin hơn khi sử dụng chuột.',
    'Nhận biết được hàng phím cơ bản, cần rèn luyện thêm.',
    'Thực hiện được các yêu cầu cơ bản của giáo viên trong giờ học.',
  ],
  '2': [
    'Em hoàn thành các bài học rèn luyện gõ bàn phím theo yêu cầu.',
    'Biết vị trí các phím cơ bản, cần rèn thêm tốc độ gõ phím.',
    'Thao tác mở và đóng phần mềm học tập đạt yêu cầu.',
    'Cần tập trung hơn trong giờ thực hành để gõ phím chuẩn xác hơn.',
    'Hoàn thành bài tập luyện gõ, cần chú ý dùng đủ các ngón tay.',
    'Biết mở bài tập trên máy tính và lưu lại theo hướng dẫn.',
    'Có tinh thần học hỏi, cần tích cực luyện tập gõ từ ngữ thường xuyên.',
    'Thực hiện được các thao tác cơ bản với bàn phím và chuột.',
  ],
  '3': [
    'Hoàn thành nội dung bài học về quản lý tệp và thư mục.',
    'Biết tạo thư mục cá nhân, cần chú ý cách đặt tên thư mục không dấu.',
    'Gõ được tiếng Việt có dấu, cần luyện tập thêm quy tắc gõ Telex/Vni.',
    'Thao tác lưu bài đúng nơi quy định, cần rèn thêm tốc độ thao tác.',
    'Nắm được các bước tìm kiếm thông tin cơ bản trên Internet.',
    'Có cố gắng trong giờ thực hành, cần tự tin hơn khi quản lý dữ liệu.',
    'Hoàn thành bài tập tại lớp, cần chú ý nghe hướng dẫn của giáo viên.',
    'Thực hiện được các thao tác sao chép tệp đơn giản.',
  ],
  '4': [
    'Hoàn thành bài tập soạn thảo văn bản và chèn hình ảnh theo yêu cầu.',
    'Biết định dạng chữ cơ bản, cần rèn thêm kỹ năng căn lề và bố cục.',
    'Tạo được các trang chiếu PowerPoint cơ bản, cần luyện thêm cách tạo hiệu ứng.',
    'Biết tìm kiếm và lưu hình ảnh vào bài làm, cần chú ý chọn hình phù hợp.',
    'Có ý thức học tập, cần chú ý kiểm tra chính tả khi soạn thảo văn bản.',
    'Hoàn thành bài thực hành trình chiếu, cần tự tin hơn khi trình bày.',
    'Nắm được kiến thức bài học, cần rèn luyện thêm kỹ năng sử dụng phần mềm.',
    'Thực hiện được các yêu cầu thực hành của giáo viên.',
  ],
  '5': [
    'Hoàn thành các nội dung bài học lập trình và trình chiếu theo yêu cầu.',
    'Hiểu các lệnh cơ bản trong Scratch/Logo, cần rèn thêm tư duy giải thuật.',
    'Tạo được bài trình chiếu hoàn chỉnh, cần chú ý phối hợp màu sắc hài hòa.',
    'Biết nhập dữ liệu vào bảng tính, cần rèn thêm cách lập công thức tính.',
    'Có tinh thần cố gắng trong học tập, cần chủ động hơn khi giải quyết bài toán.',
    'Hoàn thành dự án học tập đúng hạn, cần rèn thêm kỹ năng gỡ lỗi chương trình.',
    'Nắm được kiến thức tin học cơ bản, cần luyện tập thêm trên máy tính.',
    'Thực hiện đạt yêu cầu các bài thực hành được giao.',
  ],
};

/** Xác định Khối của 1 lớp từ field grade hoặc ký tự đầu tên lớp (vd '5/2' -> Khối 5). */
export function resolveClassGrade(classGrade: string | undefined, className: string): string {
  const cleanGrade = classGrade ? String(classGrade).replace(/[^0-9]/g, '') : '';
  const nameFirstChar = className.trim().charAt(0);
  return cleanGrade || nameFirstChar || '1';
}

/** Lấy đúng ngân hàng nhận xét (đã nạp từ Supabase hoặc mặc định) theo Khối + loại T/H. */
export function pickCommentBank(
  grade: string,
  type: 'T' | 'H',
  loadedBanks: { T: Record<string, CommentBankEntry>; H: Record<string, CommentBankEntry> }
): string[] {
  const loaded = type === 'T' ? loadedBanks.T[grade] : loadedBanks.H[grade];
  if (loaded && loaded.comments.length > 0) return loaded.comments;
  const defaults = type === 'T' ? DEFAULT_GRADE_COMMENTS_T : DEFAULT_GRADE_COMMENTS_H;
  return defaults[grade] || defaults['1'];
}

/**
 * Xác định xếp loại T/H của học sinh từ dữ liệu điểm, giống đúng logic ở
 * StudentCommentsManager.tsx (ưu tiên classification đã lưu, nếu chưa có thì suy
 * ra từ tổng điểm >= 9, mặc định H nếu chưa có điểm).
 */
export function resolveClassification(
  rank: string | undefined,
  total: string | number | undefined
): 'T' | 'H' {
  const cleaned = (rank || '').trim().toUpperCase();
  if (cleaned === 'T' || cleaned === 'H') return cleaned as 'T' | 'H';
  const totalNum = total !== undefined && total !== '' ? Number(total) : NaN;
  if (!isNaN(totalNum)) return totalNum >= 9 ? 'T' : 'H';
  return 'H';
}
