# QLLH.Pro Rebuild — Design Doc

## Bối cảnh & mục đích (Intent)
QLLH.Pro là web quản lý lớp học hiện có (quanlylophoc11989.vercel.app), được "vibe code" bằng React + Firestore. Khảo sát thực tế (DevTools) phát hiện: toàn bộ dữ liệu (tài khoản, mật khẩu plaintext, lớp, học sinh) gộp vào MỘT document Firestore (`qllh_data/global_data_v1`); mỗi thay đổi nhỏ ghi đè lại toàn bộ document (~100KB/lần, hàng trăm request ghi chỉ trong vài chục giây) → đụng độ, mất dữ liệu, "lúc chạy lúc không". Chủ dự án hiện không liên lạc được.

Mục đích: viết lại kiến trúc theo chuẩn đúng (schema quan hệ, auth thật, phân quyền ở tầng DB), giữ nguyên toàn bộ tính năng hiện có, rồi thêm các tính năng mới theo yêu cầu trong `báo cáo.doc`.

## Goals
1. Thay mô hình "1 document" bằng schema Postgres (Supabase) chuẩn hóa theo quan hệ.
2. Auth thật: GV/Admin qua Supabase Auth (email/password, hash sẵn); học sinh vào bằng "mã phòng" qua Supabase Anonymous Auth gắn với lớp.
3. Row Level Security (RLS): GV chỉ thấy lớp mình phụ trách (trừ admin thấy hết); học sinh chỉ thấy đúng lớp/điểm của chính mình.
4. Giữ nguyên tính năng hiện có (feature-parity) trước khi thêm tính năng mới.
5. Thêm tính năng mới theo docx (đã rà soát chi tiết ở các lượt trao đổi trước — không có tính năng nào Supabase không đáp ứng được):
   - Báo cáo/Điểm: bộ lọc + tìm kiếm, 2 biểu đồ (pie xếp loại, bar phổ điểm & chuyên cần), nút lọc nhanh, banner cảnh báo, thêm cột Chuyên cần + Hành động, popup hồ sơ nhanh (sparkline), 2 kiểu xuất Excel định dạng chuẩn (multi-sheet, font/border/auto-fit).
   - Trắc nghiệm: ảnh minh họa câu hỏi (Supabase Storage), import Excel hàng loạt, **xáo trộn câu hỏi/đáp án chống gian lận xử lý phía server (Edge Function)**, màn hình bật/tắt chủ đề cho học sinh thi, đếm số câu động.
   - Học liệu số & Tiện ích: thêm lưu link tới trang khác.
   - Giải trí: thêm card game (tên, link, ảnh nền 16:9, nút kích hoạt).
6. FE deploy Vercel (giữ React), tổ chức code rõ layer (components/pages/services/hooks). BE hoàn toàn trong Supabase (Postgres + Auth + Storage + Edge Functions) — không dùng server Node riêng.

## Non-goals
- Không build app mobile native (giữ dạng PWA "cài đặt về máy" nếu đang có, không phát triển thêm).
- Không hỗ trợ multi-school/multi-tenant — chỉ 1 trường, nhiều GV, nhiều lớp.
- Không cần real-time collaborative editing phức tạp — chỉ cần đồng bộ cơ bản qua Supabase Realtime.
- Không migrate dữ liệu thật của thầy chủ ngay (web đang giai đoạn test) — bắt đầu với dữ liệu mẫu; migrate dữ liệu thật là việc riêng, làm sau khi họ duyệt kiến trúc mới.

## Anti-goals (coi là thất bại dù "chạy được")
- Lặp lại lỗi gốc: ghi đè toàn bộ blob dữ liệu khi có 1 thay đổi nhỏ.
- Lưu mật khẩu dạng plaintext ở bất cứ đâu (DB, log, network payload).
- Học sinh xem được đáp án đúng trước khi nộp bài (qua DevTools/Network) — xáo trộn & chấm điểm phải nằm ở server, không phải client.
- RLS mở toang kiểu "ai cũng đọc/ghi được" như Firestore hiện tại.

## Constraints
- Chủ dự án thật hiện không liên lạc được → làm tạm trên Supabase org mới do người triển khai hiện tại đứng tên Owner, sẽ mời chủ thật vào làm Owner khi họ online lại (Supabase hỗ trợ mời thành viên Owner, không cần "transfer" phức tạp).
- Ưu tiên free tier (Supabase free, Vercel free) ở giai đoạn test; lưu ý Supabase free tier tự pause sau ~7 ngày không hoạt động — cần nhớ để không lặp lại tình trạng "ngủ" như hiện tại.
- Người triển khai chính chưa dùng Supabase bao giờ, quen Node.js hơn, nhưng đã quyết định đi full-Supabase (Edge Functions thay vì tự host Node) để giảm số hạ tầng phải quản lý.
- "Làm từ từ" — ưu tiên chia nhỏ theo milestone, không cần xong hết 1 lần.
- Project hiện chưa có git repo (`d:\Dự án lớp học` chưa init git), chưa có Supabase project, chưa có Vercel project riêng cho bản rebuild.

## Approaches đã cân nhắc (đã chốt qua trao đổi trước)

**Kiến trúc tổng thể:**
1. Vá tại chỗ trên Firestore (tách collection, bật rules) — loại, vì không tận dụng được sức mạnh quan hệ/thống kê của Postgres cho phần Báo cáo, và lệch với kế hoạch dùng Supabase Storage đã có sẵn trong docx.
2. Node.js BE riêng + Supabase chỉ làm DB — loại, người dùng không muốn thêm 1 hạ tầng server phải tự vận hành/deploy riêng.
3. **Full Supabase (Postgres + Auth + Storage + Edge Functions) + FE Vercel — ĐÃ CHỌN.** Giữ mô hình serverless, không hạ tầng phải tự quản, đủ sức làm mọi tính năng đã rà soát.

**Xác thực học sinh (mã phòng, không cần tài khoản thật):**
1. **Supabase Anonymous Auth gắn phiên với mã lớp — ĐÃ CHỌN.** Dùng tính năng có sẵn của Supabase, mỗi học sinh có `auth.uid()` thật để RLS kiểm soát chặt; cần 1 job dọn user ẩn danh định kỳ.
2. Tự phát hành token riêng qua Edge Function — loại, phức tạp hơn không cần thiết.
3. Mở quyền đọc/ghi theo mã phòng không qua Auth — loại, lặp lại đúng lỗ hổng bảo mật hiện tại.

## Quyết định đã chốt
- Stack: FE Vercel (React) · BE Supabase (Postgres + Auth + Storage + Edge Functions).
- GV/Admin: Supabase Auth email/password; vai trò lưu trong bảng `profiles` (`role`: admin|teacher); RLS theo role + theo lớp phụ trách.
- Tài khoản GV mới do **Admin tạo sẵn và gán lớp phụ trách** (không có luồng GV tự đăng ký) — khớp với mô tả module "Quản trị & Phân quyền" hiện có ("Tạo tài khoản người dùng, chỉ định quyền xem"). *(Quyết định của người viết doc, builder có thể điều chỉnh nếu phát sinh nhu cầu khác.)*
- Supabase free tier tự pause sau ~7 ngày không hoạt động: ở giai đoạn test, **chấp nhận pause và resume thủ công khi cần dùng lại**, không xây cơ chế keep-alive/cron ngay. Việc này sẽ xem lại khi đưa vào dùng thật (nâng gói trả phí hoặc build keep-alive lúc đó). *(Quyết định của người viết doc.)*
- Việc "ai có quyền duyệt migrate dữ liệu thật từ Firestore" nằm ngoài phạm vi milestone hiện tại (đã ghi rõ ở Non-goals: không migrate dữ liệu thật ngay) — để ngỏ, quyết định khi nào chủ dự án thật (hoặc người đang giữ quyền truy cập Firestore) sẵn sàng.
- Nội dung `báo cáo.doc` đã được đọc và rà soát đầy đủ qua các lượt trao đổi trước khi viết doc này (trích xuất bằng antiword, đối chiếu với web thật qua DevTools); mục Goals #5 phản ánh đúng toàn bộ yêu cầu trong file gốc.
- Học sinh: Supabase Anonymous Auth + mã phòng (`room_code`) gắn vào lớp.
- Chấm điểm & xáo trộn câu hỏi/đáp án trắc nghiệm: xử lý trong Edge Function (server-side), tuyệt đối không tính ở client.
- Thứ tự triển khai: (1) Nền tảng (schema + Auth + RLS + hạ tầng git/Supabase/Vercel) → (2) Rà soát & đưa tính năng cũ lên nền mới (feature-parity) → (3) Tính năng mới theo docx.
- Không migrate dữ liệu Firestore thật ngay; dùng dữ liệu mẫu cho giai đoạn test.

## Phác thảo schema (builder tinh chỉnh khi lên plan chi tiết)
- `profiles` (id, email, full_name, role: admin|teacher, avatar)
- `school_years` (id, name, is_active)
- `classes` (id, school_year_id, name, grade, room_code, created_by, is_open)
- `students` (id, class_id, student_code, full_name, avatar)
- `attendance` (student_id, week_number, status, note)
- `weekly_evaluations` (student_id, week_number, comment)
- `scores` (student_id, semester, theory_score, practice_score, total_score, classification)
- `quiz_topics` (id, grade, name, is_active)
- `quiz_questions` (id, topic_id, content, options jsonb, correct_index, image_url)
- `quiz_sessions` (id, student_name, class_id, is_free_slot, topic_ids, question_order jsonb, started_at) — **không lưu đáp án đúng ở phía gửi cho client**, chỉ Edge Function biết.
- `quiz_results` (session_id, score, correct_count, duration_seconds, submitted_at)
- `resources` (id, type: video|link|game, grade, title, url, thumbnail_url, is_active) — dùng chung cho Học liệu số / Giải trí / Tiện ích phần lưu link.

## Để lại cho builder (khi viết plan chi tiết)
- Chốt chính xác tên bảng/cột, kiểu dữ liệu, index, generated column cho `classification`.
- Viết RLS policy cụ thể cho từng bảng theo từng role (admin/teacher/student-anon).
- Thiết kế chi tiết luồng Anonymous Auth ↔ mã phòng: timeout phiên, nhiều thiết bị cùng dùng 1 mã.
- Danh sách Edge Functions cần viết (endpoint, input/output) — ít nhất: tạo phiên thi (xáo trộn + ẩn đáp án), chấm bài, import Excel câu hỏi, xuất Excel báo cáo/đánh giá.
- Cấu trúc thư mục FE (components/pages/services/hooks) áp cho từng module.
- Checklist rà soát từng module cũ: còn thiếu gì so với bản Firestore gốc.
- Việc setup hạ tầng (git init, tạo repo, tạo Supabase project mới, link Vercel project mới) — làm ngay sau khi doc này được duyệt, trước khi viết code.
