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

## 3. Kết quả kiểm thử & Chất lượng mã nguồn

- **Unit Test (Vitest)**: Toàn bộ **29/29 test cases đều PASS**.
  - `src/lib/__tests__/supabaseClient.test.ts`: 1 passed.
  - `src/services/__tests__/authService.test.ts`: 4 passed.
  - `src/services/__tests__/classesService.test.ts`: 4 passed.
  - `src/services/__tests__/studentsService.test.ts`: 4 passed.
  - `src/services/__tests__/attendanceService.test.ts`: 4 passed.
  - `src/services/__tests__/scoresService.test.ts`: 3 passed.
  - `src/services/__tests__/quizService.test.ts`: 5 passed.
  - `src/services/__tests__/examService.test.ts`: 4 passed.
- **TypeScript Static Analysis (`tsc --noEmit`)**: **0 Lỗi** (Không có cảnh báo hay lỗi kiểu dữ liệu).

---

## 4. Kế hoạch các bước tiếp theo
- **Giai đoạn 2B**: Chuyển đổi module Điểm danh (`attendance`) và Nhận xét tuần (`weekly_evaluations`) sang Supabase.
- **Giai đoạn 2C**: Chuyển đổi module Bảng điểm & Báo cáo thống kê (`scores`) sang Supabase.
- **Giai đoạn 2D**: Chuyển đổi Ngân hàng đề thi trắc nghiệm (`quiz_questions`, `quiz_sessions`, `quiz_results`) và Edge Functions xáo trộn/chấm điểm server-side.
