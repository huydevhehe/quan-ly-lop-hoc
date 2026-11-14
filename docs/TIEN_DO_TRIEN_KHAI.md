# Báo Cáo Tiến Độ Dự Án QLLH.Pro Rebuild

**Ngày cập nhật**: 14/11/2026  
**Kho mã nguồn**: `https://github.com/huydevhehe/quan-ly-lop-hoc`  
**Nhánh hiện tại**: `dev`

---

## 1. Tổng quan kiến trúc & Mục tiêu
- Chuyển đổi mô hình "1 document Firestore" sang cơ sở dữ liệu quan hệ **PostgreSQL trên nền tảng Supabase**.
- Toàn bộ bảo mật, phân quyền dữ liệu được thực thi bằng **Row Level Security (RLS)** trên Database, loại bỏ cơ chế lọc thủ công không an toàn ở client.
- **Giáo viên & Quản trị viên**: Xác thực qua Supabase Auth (Email/Password), thông tin tài khoản và vai trò nằm trong bảng `profiles`.
- **Học sinh**: Tham gia lớp học bằng mã phòng (`room_code`) thông qua Supabase Anonymous Auth (`room_sessions`), bảo vệ kết quả bài thi và không thể đọc trực tiếp đáp án đúng từ ngân hàng câu hỏi.
- **Frontend**: Tiếp tục phát triển trên React 19 + TypeScript + Vite, chuyển đổi dần từng phân hệ (subsystem) từ Firestore sang Supabase Services.

---

## 2. Chi tiết các hạng mục đã hoàn thành

### Giai đoạn 1: Nền tảng Backend (Postgres Schema + RLS)
Đã triển khai 8 Task độc lập với các file migration chuẩn PostgreSQL trong thư mục `supabase/migrations/` và file kiểm thử SQL tương ứng:

1. **Task 1: profiles & school_years**
   - File: `supabase/migrations/0001_profiles_school_years.sql`
   - Tạo bảng `profiles` (FK `auth.users`, role `admin` | `teacher`), bảng `school_years` (năm học, unique `name`). Bật RLS ngay khi khởi tạo.
   - Test SQL: `supabase/migrations/_tests/0001_test.sql`.

2. **Task 2: classes, students & room_sessions**
   - File: `supabase/migrations/0002_classes_students_sessions.sql`
   - Tạo bảng `classes` (unique `room_code`), `students` (unique `class_id, student_code`), `room_sessions` (phiên học sinh ẩn danh).
   - Test SQL: `supabase/migrations/_tests/0002_test.sql`.

3. **Task 3: attendance, weekly_evaluations & scores**
   - File: `supabase/migrations/0003_attendance_scores.sql`
   - Bảng `attendance` (điểm danh theo tuần), `weekly_evaluations` (nhận xét tuần), `scores` (tính `total_score` và xếp loại `classification` tự động qua generated columns `STORED`).
   - Test SQL: `supabase/migrations/_tests/0003_test.sql`.

4. **Task 4: quiz_topics, quiz_questions & quiz_results**
   - File: `supabase/migrations/0004_quiz.sql`
   - Tạo bảng câu hỏi có `correct_index`. Tạo View an toàn `quiz_questions_public` loại bỏ hoàn toàn cột đáp án đúng để chống gian lận trên client.
   - Test SQL: `supabase/migrations/_tests/0004_test.sql`.

5. **Task 5: resources (Học liệu số, Game, Tiện ích)**
   - File: `supabase/migrations/0005_resources.sql`
   - Tạo bảng `resources` với ràng buộc kiểm tra loại tài nguyên (`video`, `link`, `game`).
   - Test SQL: `supabase/migrations/_tests/0005_test.sql`.

6. **Task 6: RLS Phân quyền Giáo viên & Quản trị viên**
   - File: `supabase/migrations/0006_rls_teacher_admin.sql`
   - Helper functions: `is_admin()`, `is_class_owner(class_id)` với `security definer`.
   - Giáo viên chỉ có quyền truy vấn, chỉnh sửa dữ liệu trên lớp học do mình phụ trách. Admin có toàn quyền.
   - Test SQL: `supabase/migrations/_tests/0006_test.sql`.

7. **Task 7: RLS Phân quyền Học sinh ẩn danh (Anonymous Auth)**
   - File: `supabase/migrations/0007_rls_student_anon.sql`
   - Helper function: `current_room_class_id()`.
   - Học sinh chỉ đọc được danh sách học sinh, điểm danh của đúng phòng đã nhập mã. **Cấm tuyệt đối** quyền SELECT bảng gốc `quiz_questions`, chỉ được đọc qua `quiz_questions_public`.
   - Test SQL: `supabase/migrations/_tests/0007_test.sql`.

8. **Task 8: Dữ liệu mẫu (Seed Data)**
   - File: `supabase/seed/seed.sql`
   - Dữ liệu mẫu gồm: 1 admin, 1 giáo viên, 1 năm học, 2 lớp, 10 học sinh, 3 câu hỏi trắc nghiệm, 3 học liệu.

---

### Giai đoạn 2A: Chuyển đổi Đăng nhập, Lớp học, Học sinh sang Supabase
Đã hoàn thành 6 Task tích hợp tầng dịch vụ và giao diện phía Frontend:

1. **Task 1: Khởi tạo Supabase Client**
   - Cài đặt `@supabase/supabase-js`, `vitest`.
   - File: `src/lib/supabaseClient.ts` cấu hình client với `autoRefreshToken` và `persistSession`. Bắt lỗi rõ ràng nếu thiếu biến môi trường.
   - File kiểm thử: `src/lib/__tests__/supabaseClient.test.ts` (PASS).

2. **Task 2: Xây dựng authService**
   - File: `src/services/authService.ts`
   - `signInStaff(email, password)`: Đăng nhập Supabase Auth chuẩn, map sang `UserAccount`.
   - `signInStudentWithRoomCode(roomCode, displayName)`: Đăng nhập Anonymous Auth, kiểm tra mã phòng hợp lệ và ghi phiên vào `room_sessions`.
   - `signOut()`, `getCurrentSession()`.
   - File kiểm thử: `src/services/__tests__/authService.test.ts` (PASS 4/4).

3. **Task 3: Xây dựng classesService**
   - File: `src/services/classesService.ts`
   - `listMyClasses()`: Lấy danh sách lớp kèm số lượng học sinh (được RLS Supabase tự động lọc theo quyền).
   - `createClass(input)`: Tạo lớp mới, tự động sinh mã phòng 6 ký tự ngẫu nhiên dạng `F08AF1`.
   - `updateClass(id, patch)`, `deleteClass(id)`.
   - File kiểm thử: `src/services/__tests__/classesService.test.ts` (PASS 4/4).

4. **Task 4: Xây dựng studentsService**
   - File: `src/services/studentsService.ts`
   - `listStudentsByClass(classId)`: Lấy học sinh theo lớp.
   - `upsertStudents(classId, students)`: Thêm học sinh, giữ nguyên ngoại lệ unique constraint của PostgreSQL khi trùng mã học sinh.
   - `deleteStudent(id)`.
   - File kiểm thử: `src/services/__tests__/studentsService.test.ts` (PASS 4/4).

5. **Task 5: Nối LoginModal & StudentPortal vào authService**
   - File: `src/components/LoginModal.tsx`: Bỏ so khớp mật khẩu plaintext cũ, chuyển sang `signInStaff`.
   - File: `src/components/StudentPortal.tsx`: Chuyển phần xác thực mã phòng học sinh sang gọi `signInStudentWithRoomCode`.

6. **Task 6: Nối ClassroomManager vào Supabase Services**
   - File: `src/components/ClassroomManager.tsx`: Tích hợp các service mới `listMyClasses`, `createClass`, `updateClass`, `deleteClass`, `listStudentsByClass`, `upsertStudents`, `deleteStudent`. Giữ nguyên các phần điểm và điểm danh cũ để không gây ảnh hưởng.

---

### Giai đoạn 2B: Điểm danh, Đánh giá tuần, Bảng điểm sang Supabase
Đã hoàn thành 4 Task đưa các subsystem Điểm danh, Nhận xét tuần, và Bảng điểm sang kết nối trực tiếp với Supabase:

1. **Task 1: attendanceService**
   - File: `src/services/attendanceService.ts`
   - `getWeekAttendance(classId, weekNumber)`: Lấy dữ liệu điểm danh theo lớp và tuần, join qua `students`.
   - `saveWeekAttendance(weekNumber, records)`: Upsert mảng điểm danh theo `(student_id, week_number)` tránh trùng lặp.
   - `getWeekEvaluations(classId, weekNumber)` & `saveWeekEvaluation(studentId, weekNumber, comment)`: Quản lý nhận xét học sinh theo tuần.
   - Unit test: `src/services/__tests__/attendanceService.test.ts` (PASS 4/4).

2. **Task 2: scoresService & Score Range Constraint**
   - Migration: `supabase/migrations/0008_scores_range_check.sql` bổ sung check constraint 0 <= điểm <= 10 cho `theory_score` và `practice_score`.
   - File: `src/services/scoresService.ts`
   - `getClassScores(classId, semester)`: Lấy điểm thi học kỳ 1 / Cả năm, đọc trực tiếp cột generated `classification` từ database.
   - `saveScore(studentId, semester, theoryScore, practiceScore)`: Validate khoảng điểm [0, 10] và upsert vào database.
   - Unit test: `src/services/__tests__/scoresService.test.ts` (PASS 3/3).

3. **Task 3: Nối ClassroomManager (tab Tuần) vào attendanceService**
   - File: `src/components/ClassroomManager.tsx`: Đồng bộ điểm danh và đánh giá tuần của học sinh vào `attendanceService`.

4. **Task 4: Nối ReportsSection (tab Điểm) vào scoresService**
   - File: `src/components/ReportsSection.tsx`: Tải bảng điểm trực tiếp từ `scoresService.getClassScores` theo học kỳ đã chọn.

---

### Giai đoạn 2C: Ngân hàng câu hỏi & Kết quả thi sang Supabase
Đã hoàn thành 4 Task đưa toàn bộ hệ thống Trắc nghiệm và Bảng điểm thi sang Supabase:

1. **Task 1: quizService (Phía Giáo viên)**
   - File: `src/services/quizService.ts`
   - `listTopics()`: Lấy danh sách chủ đề thi, đếm chính xác số câu hỏi qua `quiz_questions(count)`.
   - `createTopic()`, `setTopicActive()`: Quản lý chủ đề thi.
   - `listQuestionsByTopic()`, `createQuestion()`, `deleteQuestion()`: Thao tác CRUD câu hỏi trong ngân hàng đề.
   - `listExamResults()`: Đọc kết quả thi học sinh từ `quiz_results` join `quiz_sessions`.
   - Unit test: `src/services/__tests__/quizService.test.ts` (PASS 5/5).

2. **Task 2: examService (Phía Học sinh) & Prevent Duplicate Submission**
   - Migration: `supabase/migrations/0009_quiz_results_unique_session.sql` thêm unique constraint trên `session_id`.
   - File: `src/services/examService.ts`
   - `listActiveTopics(grade)`: Lấy các chủ đề đang bật.
   - `startExamSession()`: Tạo phiên thi, chỉ đọc câu hỏi an toàn từ View `quiz_questions_public` (không chứa cột đáp án).
   - `submitExamResult()`: Nộp bài bằng upsert theo `session_id`, validate thời lượng làm bài > 0.
   - Unit test: `src/services/__tests__/examService.test.ts` (PASS 4/4).

3. **Task 3: Nối QuizBank UI vào quizService / examService**
   - File: `src/components/QuizBank.tsx`: Tải kết quả thi học sinh trực tiếp từ `quizService.listExamResults`.

4. **Task 4: Nối StudentPortal UI vào examService**
   - File: `src/components/StudentPortal.tsx`: Tích hợp nộp bài thi trắc nghiệm lưu kết quả vào Supabase `quiz_results`.

---

### Giai đoạn 2D: Học liệu số, Giải trí, Tiện ích, Quản trị & Phân quyền sang Supabase
Đã hoàn thành 4 Task đưa Học liệu, Tiện ích, Game và Quản trị phân quyền sang Supabase:

1. **Task 1: Migration student_permissions & Edge Function create-staff-account**
   - Migration: `supabase/migrations/0010_student_permissions.sql` tạo bảng phân quyền chung với RLS an toàn.
   - Edge Function: `supabase/functions/create-staff-account/index.ts` (Deno) kiểm tra quyền admin và tạo tài khoản an toàn qua service role key server-side.

2. **Task 2: resourcesService**
   - File: `src/services/resourcesService.ts`
   - Quản lý chung tài nguyên video, link học liệu và game giải trí với validate URL nghiêm ngặt.
   - Unit test: `src/services/__tests__/resourcesService.test.ts` (PASS 5/5).

3. **Task 3: adminService & studentPermissionsService**
   - File: `src/services/adminService.ts`: Tạo tài khoản giáo viên mới qua Edge Function, gán lớp phụ trách.
   - File: `src/services/studentPermissionsService.ts`: Đọc và cập nhật phân quyền xem của học sinh.
   - Unit test: `src/services/__tests__/adminService.test.ts` (PASS 4/4).

4. **Task 4: Nối UI**
   - Cập nhật `DigitalResources.tsx` và `AdminPanel.tsx` gọi trực tiếp các service Supabase.

---

### Giai đoạn 3A: Mở rộng Báo cáo & Bảng điểm (Tính năng mới theo docx)
Đã hoàn thành 4 Task nâng cấp toàn diện phân hệ Báo cáo:

1. **Task 1: Thống kê scoresService**
   - File: `src/services/scoresService.ts`
   - `getClassStats(classId, semester)`: Thống kê số lượng theo nhóm xếp loại (T, H, C, Chưa có điểm), phổ điểm 4 mốc (9-10, 7-8, 5-6, dưới 5) và mốc vắng học sinh (>2 buổi).
   - Unit test: `src/services/__tests__/scoresService.test.ts` (PASS 5/5).

2. **Task 2: Biểu đồ, Bộ lọc và Banner cảnh báo**
   - File: `src/components/reports/ClassificationPieChart.tsx`: Biểu đồ tròn xếp loại Recharts.
   - File: `src/components/reports/ScoreAttendanceBarChart.tsx`: Biểu đồ cột phổ điểm & chuyên cần Recharts.
   - File: `src/components/reports/WarningBanner.tsx`: Banner thông minh tự động cảnh báo học sinh chưa có điểm hoặc vắng nhiều (tự ẩn khi không có học sinh cảnh báo).

3. **Task 3: Cột Chuyên cần & Popup hồ sơ nhanh**
   - File: `src/components/reports/StudentQuickProfilePopup.tsx`: Popup hiển thị tóm tắt hồ sơ, xếp loại, điểm và nhận xét khi click vào học sinh.

4. **Task 4: Xuất Excel chuẩn in ấn (exceljs)**
   - File: `src/services/excelExportService.ts`:
     - `exportFinalReportExcel`: Xuất bảng điểm chuẩn định dạng Times New Roman, border, auto-fit độ rộng cột chống cắt chữ.
     - `exportWeeklyCommentsExcel`: Xuất bảng nhận xét chi tiết 35 tuần của cả lớp.
   - Unit test: `src/services/__tests__/excelExportService.test.ts` (PASS 2/2).

---

### Giai đoạn 3B: Trắc nghiệm Nâng cao & Chống Gian Lận
Đã hoàn thành 4 Task nâng cấp hệ thống Trắc nghiệm:

1. **Task 1: Upload ảnh câu hỏi trắc nghiệm qua Supabase Storage**
   - Migration: `supabase/migrations/0011_quiz_questions_image_storage_policy.sql` tạo bucket `quiz-images` (public read, authenticated write).
   - Service: `src/services/quizImageService.ts` validate kích thước (<= 2MB), định dạng (PNG/JPEG/WEBP) và upload tạo public URL.
   - Unit test: `src/services/__tests__/quizImageService.test.ts` (PASS 3/3).

2. **Task 2: Import câu hỏi hàng loạt từ file Excel**
   - File: `src/services/quizService.ts` bổ sung `parseQuestionsExcelFile`, `validateAndFormatQuestionRows`, `bulkInsertQuestions` (all-or-nothing), `generateSampleExcelTemplate`.
   - Nối nút "Tải file mẫu" và "Nhập file Excel" vào giao diện `src/components/QuizBank.tsx`.
   - Unit test: `src/services/__tests__/quizService.test.ts` (PASS 7/7).

3. **Task 3: Edge Functions Chấm điểm & Xáo trộn Server-side**
   - Edge Function `supabase/functions/start-exam-session/index.ts`: Thuật toán Fisher-Yates xáo trộn thứ tự câu hỏi và thứ tự 4 đáp án (dùng `crypto.getRandomValues`), bảo mật giấu hoàn toàn `correct_index` ở phía server.
   - Edge Function `supabase/functions/submit-exam-session/index.ts`: Tự động chấm điểm đối chiếu với map đáp án server-side, bảo đảm chống can thiệp từ client.
   - `src/services/examService.ts` tích hợp gọi Edge Functions và cơ chế fallback linh hoạt.
   - Unit test: `src/services/__tests__/examService.test.ts` (PASS 5/5).

4. **Task 4: Màn hình Bật/Tắt và Quản lý Chủ đề thi**
   - Component: `src/components/QuizTopicActivationPanel.tsx`: Quản lý danh sách chủ đề theo khối lớp, bật/tắt kích hoạt từng chủ đề hoặc toàn bộ chủ đề cùng lúc, thêm chủ đề mới tức thì.
   - Tích hợp trực tiếp vào tab Ngân hàng câu hỏi của `src/components/QuizBank.tsx`.

---

### Giai đoạn 3C: Học liệu số/Tiện ích (Lưu link) & Giải trí (Thêm thẻ game)
Đã hoàn thành 3 Task:

1. **Task 1: Form lưu liên kết website cho Học liệu số và Tiện ích**
   - File: `src/components/resources/SaveLinkForm.tsx`: Nhập tiêu đề, URL, chọn khối lớp, hiển thị lỗi validate inline ngay dưới ô nhập.
   - Nối vào `DigitalResources.tsx` và `UtilitiesSection.tsx` (thêm tab Liên kết tiện ích).
   - Đảm bảo lưu đúng `type: 'link'` và tải lại danh sách tức thì.

2. **Task 2: Form thêm thẻ trò chơi giáo dục 16:9 cho Giải trí**
   - Migration: `supabase/migrations/0012_resource_images_storage_policy.sql` tạo bucket `resource-images` với RLS public select, authenticated insert/delete.
   - Component: `src/components/resources/GameCardForm.tsx`: Cho phép upload ảnh hoặc nhập link, tự động kiểm tra tỉ lệ ảnh (khuyên dùng chuẩn 16:9 ~ 1.78:1).
   - Nối vào `GamesSection.tsx`: Hiển thị danh sách card game trực tuyến, nút kích hoạt mở/tắt cho học sinh, nút mở chơi thử và nút xóa.

3. **Task 3: Hiển thị phía học sinh (StudentPortal.tsx)**
   - Tích hợp tải danh sách link tài nguyên và thẻ game được kích hoạt (`is_active = true`) từ Supabase `resourcesService`.
   - Bổ sung cơ chế bảo vệ link hỏng hoặc rỗng (báo lỗi thân thiện, không làm trắng trang khi liên kết bị gỡ).

---

### Giai đoạn 2F: Sửa lỗi "Nối dây thật" & Gỡ Dual-write
Đã hoàn thành 6 Task:
1. **Task 1 (`ClassroomManager.tsx`)**: Nối thật 100% với Supabase services (`listMyClasses`, `listStudentsByClass`, `upsertStudents`, `deleteStudent`, `getClassScores`, `saveScore`, `getWeekAttendance`, `saveWeekAttendance`), gỡ sạch các hàm `save*Permanently` và `pushAllDataToFirestore`.
2. **Task 2 (`ReportsSection.tsx`)**: Sửa triệt để lỗi lệch ID giữa localStorage chuỗi cũ và UUID Supabase. Tải danh sách lớp và học sinh từ Supabase, hiển thị điểm chính xác.
3. **Task 3 (`QuizBank.tsx`, `DigitalResources.tsx`, `StudentPortal.tsx`)**: Gỡ bỏ 100% các lời gọi `pushAllDataToFirestore` và `syncQuizSubmissionToFirestore` khi thêm/xóa câu hỏi, tài nguyên, nộp bài thi.
4. **Task 4 (`AdminPanel.tsx`)**: Chuyển quản lý tài khoản sang `adminService.listStaff()`, `createStaffAccount()`, gỡ bỏ tab cấu hình Firebase.
5. **Task 5 (`App.tsx`, `Sidebar.tsx`, `DataBackupModal.tsx`, `StudentCommentsManager.tsx`)**: Gỡ bỏ realtime Firestore listener và các import legacy, đồng bộ trạng thái qua Supabase services.
6. **Task 6 (`src/__tests__/no-legacy-imports.test.ts`)**: Viết test guard tự động quét toàn bộ component và App.tsx để đảm bảo không bị tái nhập bất kỳ file legacy nào (PASS 26/26 tests).

---

### Giai đoạn 2E: Dọn dẹp code cũ (Firestore/localStorage)
Đã hoàn thành toàn bộ 3 Task:
1. **Task 1**: Kiểm tra an toàn trước khi xóa — đảm bảo không còn bất kỳ component hay file nào trong dự án phụ thuộc vào tầng dữ liệu cũ.
2. **Task 2**: Xóa vĩnh viễn 3 file `src/firebase.ts`, `src/utils/dbStorage.ts`, `src/utils/userScope.ts`. Gỡ package `firebase` khỏi `package.json` và `node_modules`.
3. **Task 3**: Dọn dẹp `.env.example` loại bỏ các config không dùng đến, giữ lại cấu hình Supabase chuẩn.

---

## 3. Kết quả kiểm thử & Chất lượng mã nguồn

- **Unit Test (Vitest)**: Toàn bộ **74/74 test cases (13 test files) đều PASS 100%**.
  - `src/__tests__/no-legacy-imports.test.ts`: 26 passed.
  - `src/lib/__tests__/supabaseClient.test.ts`: 1 passed.
  - `src/services/__tests__/authService.test.ts`: 4 passed.
  - `src/services/__tests__/classesService.test.ts`: 4 passed.
  - `src/services/__tests__/studentsService.test.ts`: 4 passed.
  - `src/services/__tests__/attendanceService.test.ts`: 4 passed.
  - `src/services/__tests__/scoresService.test.ts`: 5 passed.
  - `src/services/__tests__/quizService.test.ts`: 7 passed.
  - `src/services/__tests__/examService.test.ts`: 5 passed.
  - `src/services/__tests__/resourcesService.test.ts`: 5 passed.
  - `src/services/__tests__/adminService.test.ts`: 4 passed.
  - `src/services/__tests__/excelExportService.test.ts`: 2 passed.
  - `src/services/__tests__/quizImageService.test.ts`: 3 passed.
- **TypeScript Static Analysis (`npm run lint` / `tsc --noEmit`)**: **0 Lỗi**.
- **Production Build (`npm run build`)**: **Thành công 100%** trong < 1s.

---

## 4. Kế hoạch các bước tiếp theo
- **Giai đoạn 3A**: Báo cáo mở rộng & Biểu đồ phân tích chuyên sâu (`2026-11-14-qllh-giai-doan-3a-bao-cao-mo-rong.md`).
- **Giai đoạn 3B**: Hoàn thiện Edge Function Chống gian lận (đã xong phần core).
- **Giai đoạn 3C**: Hoàn thiện Học liệu & Giải trí mới (đã xong phần core).
