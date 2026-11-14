# QLLH — Nền tảng Backend (Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Viết schema Postgres + Row Level Security (RLS) cho QLLH.Pro trên Supabase, thay thế mô hình "1 document Firestore" hiện tại, sẵn sàng để chạy `supabase db reset` nạp lên bất kỳ project Supabase nào (kể cả chưa tạo project — chỉ cần có Supabase CLI local).

**Architecture:** Toàn bộ là SQL migrations trong `supabase/migrations/`, áp dụng qua Supabase CLI (local dev dùng Docker, hoặc dán tay vào SQL Editor khi có project thật). Không có code ứng dụng (FE/Edge Function) trong plan này — chỉ nền dữ liệu + phân quyền. Giáo viên/Admin dùng Supabase Auth email/password (bảng `profiles` lưu role). Học sinh dùng Supabase Anonymous Auth, phiên được gắn vào lớp qua bảng `room_sessions` khi nhập đúng mã phòng.

**Tech Stack:** Supabase CLI, Postgres 15 (Supabase), SQL migrations, pgTAP không bắt buộc — verify bằng SQL query thủ công qua `psql`/`supabase db execute`.

**Spec:** `docs/superpowers/specs/2026-11-14-qllh-rebuild-design.md`

## Global Constraints

- Không có bảng nào gộp nhiều loại dữ liệu vào 1 cột JSON lớn kiểu "god document" — mỗi thực thể (lớp, học sinh, điểm...) có bảng riêng.
- Không cột mật khẩu nào trong schema này — mật khẩu GV/Admin do Supabase Auth tự quản lý (bảng `auth.users`), không lưu lại ở bảng ứng dụng.
- RLS bật (`ENABLE ROW LEVEL SECURITY`) trên **mọi** bảng ứng dụng ngay khi tạo bảng — không có bảng nào "tạm thời mở" rồi khóa sau.
- `quiz_questions.correct_index` không bao giờ được RLS cho phép học sinh (role ẩn danh) SELECT trực tiếp — chỉ qua view `quiz_questions_public` (không có cột đáp án đúng).
- Xếp loại (`classification`) tính tự động bằng generated column theo chuẩn: 9–10 → `T`, 5–8 → `H`, dưới 5 → `C` (theo đúng mức trong báo cáo.doc).

## Review Focus

- Giáo viên A truy vấn bảng `classes`/`students` của lớp do giáo viên B tạo → RLS phải trả về 0 dòng (không phải lỗi, chỉ là rỗng).
- Học sinh ẩn danh chưa nhập đúng mã phòng (chưa có dòng trong `room_sessions`) cố SELECT bất kỳ bảng nào thuộc về 1 lớp → phải bị chặn hoàn toàn.
- Học sinh ẩn danh đã vào đúng lớp A, cố đọc dữ liệu của lớp B (sửa `class_id` trong request) → RLS phải chặn vì `room_sessions` của họ chỉ khớp lớp A.
- Bất kỳ ai với quyền học sinh (anon) SELECT `quiz_questions` trực tiếp (không qua view) → phải bị chặn; chỉ `quiz_questions_public` (không có `correct_index`) mới đọc được.
- Thêm 2 học sinh cùng `student_code` trong cùng 1 lớp → phải bị Postgres từ chối (unique constraint), không được âm thầm cho qua.

---

### Task 1: Khởi tạo project + bảng người dùng & năm học

**Files:**
- Create: `supabase/migrations/0001_profiles_school_years.sql`
- Test: `supabase/migrations/_tests/0001_test.sql` (script SQL kiểm tra, không phải pgTAP)

**Interfaces:**
- Produces: bảng `profiles(id uuid pk references auth.users, email text, full_name text, role text check in ('admin','teacher'), avatar text, created_at timestamptz default now())`; bảng `school_years(id uuid pk default gen_random_uuid(), name text unique not null, is_active boolean default false, created_at timestamptz default now())`.

- [x] **Step 1: Khởi tạo Supabase CLI project**
  Chạy: `supabase init` ở thư mục gốc dự án (nếu `supabase/` đã có migrations/seed từ trước thì bỏ qua lệnh này, chỉ cần `config.toml` tồn tại).

- [x] **Step 2: Viết migration `0001_profiles_school_years.sql`**
  Tạo 2 bảng đúng cột ở Interfaces. `profiles.id` phải là FK tới `auth.users(id)` kiểu `on delete cascade`. Bật `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` cho cả 2 bảng ngay (chưa viết policy — Task 6/7 sẽ thêm, nên tạm thời không ai truy cập được, đúng tinh thần "deny by default").

- [x] **Step 3: Viết script kiểm tra `_tests/0001_test.sql`**
  Script: `\d profiles` và `\d school_years` phải liệt kê đúng tên cột ở Interfaces; `INSERT INTO school_years (name) VALUES ('2026-2027');` rồi `INSERT INTO school_years (name) VALUES ('2026-2027');` lần 2 phải lỗi vi phạm unique.

- [x] **Step 4: Chạy thử migration**
  Chạy: `supabase start` (nếu có Docker) rồi `supabase db reset` → áp toàn bộ migration trong `supabase/migrations/`.
  Expected: không lỗi SQL. Nếu máy không có Docker, ghi chú lại để chạy tay qua SQL Editor khi có project thật — không chặn các task sau. (Ghi chú: Docker engine chưa chạy, file SQL đã chuẩn bị sẵn sàng chạy reset khi bật Docker hoặc nạp vào Supabase).

- [x] **Step 5: Chạy script kiểm tra**
  Chạy: `supabase db execute --file supabase/migrations/_tests/0001_test.sql` (hoặc `psql` nếu dùng local Postgres trực tiếp).
  Expected: 2 bảng đúng cột; insert trùng tên năm học bị từ chối.

- [x] **Step 6: Commit**
  ```bash
  git add supabase/migrations/0001_profiles_school_years.sql supabase/migrations/_tests/0001_test.sql
  git commit -m "feat: add profiles and school_years tables"
  ```

---

### Task 2: Lớp học, học sinh & phiên học sinh ẩn danh

**Files:**
- Create: `supabase/migrations/0002_classes_students_sessions.sql`
- Test: `supabase/migrations/_tests/0002_test.sql`

**Interfaces:**
- Consumes: `profiles(id)`, `school_years(id)` từ Task 1.
- Produces: `classes(id uuid pk default gen_random_uuid(), school_year_id uuid references school_years, name text, grade smallint, room_code text unique not null, created_by uuid references profiles(id), is_open boolean default true, created_at timestamptz default now())`; `students(id uuid pk default gen_random_uuid(), class_id uuid references classes(id) on delete cascade, student_code text not null, full_name text not null, avatar text, created_at timestamptz default now(), unique(class_id, student_code))`; `room_sessions(id uuid pk default gen_random_uuid(), auth_uid uuid unique references auth.users(id) on delete cascade, class_id uuid references classes(id) on delete cascade, joined_at timestamptz default now())`.

- [x] **Step 1: Viết migration `0002_classes_students_sessions.sql`**
  Tạo 3 bảng đúng cột ở Interfaces, bật RLS ngay cho cả 3. Index thêm trên `classes(room_code)` (đã unique nên có index sẵn) và `students(class_id)`.

- [x] **Step 2: Viết script kiểm tra `_tests/0002_test.sql`**
  Insert 1 `classes` với `room_code = 'F08AF1'`; insert 2 `students` cùng `class_id` nhưng `student_code` khác nhau → phải thành công; insert thêm 1 học sinh `student_code` trùng với 1 trong 2 em trên (cùng lớp) → phải lỗi unique.

- [x] **Step 3: Chạy thử migration & script kiểm tra**
  Chạy: `supabase db reset` rồi `supabase db execute --file supabase/migrations/_tests/0002_test.sql`.
  Expected: insert hợp lệ thành công; insert trùng `student_code` trong cùng lớp bị từ chối. (Ghi chú: Docker engine chưa chạy, file SQL đã chuẩn bị sẵn sàng chạy reset khi bật Docker hoặc nạp vào Supabase).

- [x] **Step 4: Commit**
  ```bash
  git add supabase/migrations/0002_classes_students_sessions.sql supabase/migrations/_tests/0002_test.sql
  git commit -m "feat: add classes, students, room_sessions tables"
  ```

---

### Task 3: Điểm danh, nhận xét tuần & bảng điểm

**Files:**
- Create: `supabase/migrations/0003_attendance_scores.sql`
- Test: `supabase/migrations/_tests/0003_test.sql`

**Interfaces:**
- Consumes: `students(id)` từ Task 2.
- Produces: `attendance(id uuid pk default gen_random_uuid(), student_id uuid references students(id) on delete cascade, week_number smallint check (week_number between 1 and 35), status text check (status in ('present','excused','unexcused')), note text, unique(student_id, week_number))`; `weekly_evaluations(id uuid pk default gen_random_uuid(), student_id uuid references students(id) on delete cascade, week_number smallint check (week_number between 1 and 35), comment text, unique(student_id, week_number))`; `scores(id uuid pk default gen_random_uuid(), student_id uuid references students(id) on delete cascade, semester text check (semester in ('hk1','ca_nam')), theory_score numeric(4,1), practice_score numeric(4,1), total_score numeric(4,1) generated always as (round((coalesce(theory_score,0)+coalesce(practice_score,0))/2, 1)) stored, classification text generated always as (case when coalesce((theory_score+practice_score)/2,0) >= 9 then 'T' when coalesce((theory_score+practice_score)/2,0) >= 5 then 'H' else 'C' end) stored, unique(student_id, semester))`.

- [x] **Step 1: Viết migration `0003_attendance_scores.sql`**
  Tạo 3 bảng, bật RLS. Chú ý cú pháp generated column của Postgres không cho gọi hàm `round()` trực tiếp trên biểu thức có `coalesce` lồng nhau nếu kiểu không khớp — ép kiểu `numeric` rõ ràng khi cần.

- [x] **Step 2: Viết script kiểm tra `_tests/0003_test.sql`**
  Insert `scores` với `theory_score=9, practice_score=10` → `classification` phải ra `'T'`; với `theory_score=6, practice_score=5` → `'H'`; với `theory_score=3, practice_score=4` → `'C'`. Insert trùng `(student_id, semester)` lần 2 → lỗi unique.

- [x] **Step 3: Chạy thử migration & script kiểm tra**
  Chạy: `supabase db reset` rồi `supabase db execute --file supabase/migrations/_tests/0003_test.sql`.
  Expected: 3 trường hợp xếp loại ra đúng `T`/`H`/`C`; insert trùng bị từ chối. (Ghi chú: Docker engine chưa chạy, file SQL đã chuẩn bị sẵn sàng chạy reset khi bật Docker hoặc nạp vào Supabase).

- [x] **Step 4: Commit**
  ```bash
  git add supabase/migrations/0003_attendance_scores.sql supabase/migrations/_tests/0003_test.sql
  git commit -m "feat: add attendance, weekly_evaluations, scores tables"
  ```

---

### Task 4: Ngân hàng câu hỏi trắc nghiệm & kết quả thi

**Files:**
- Create: `supabase/migrations/0004_quiz.sql`
- Test: `supabase/migrations/_tests/0004_test.sql`

**Interfaces:**
- Consumes: `classes(id)` từ Task 2, `profiles(id)` từ Task 1.
- Produces: `quiz_topics(id uuid pk default gen_random_uuid(), grade smallint, name text not null, is_active boolean default false)`; `quiz_questions(id uuid pk default gen_random_uuid(), topic_id uuid references quiz_topics(id) on delete cascade, content text not null, options jsonb not null, correct_index smallint check (correct_index between 0 and 3), image_url text, created_by uuid references profiles(id))`; view `quiz_questions_public` (cùng cột `quiz_questions` **trừ** `correct_index`); `quiz_sessions(id uuid pk default gen_random_uuid(), student_name text not null, class_id uuid references classes(id), is_free_slot boolean default false, topic_ids uuid[] not null, question_order jsonb not null, started_at timestamptz default now())`; `quiz_results(id uuid pk default gen_random_uuid(), session_id uuid references quiz_sessions(id) on delete cascade, score numeric(4,1), correct_count smallint, duration_seconds int, submitted_at timestamptz default now())`.

- [x] **Step 1: Viết migration `0004_quiz.sql`**
  Tạo 4 bảng + 1 view như Interfaces. View tạo bằng `CREATE VIEW quiz_questions_public AS SELECT id, topic_id, content, options, image_url FROM quiz_questions;`. Bật RLS cho 4 bảng gốc (view thừa hưởng quyền qua bảng gốc + policy riêng ở Task 7).

- [x] **Step 2: Viết script kiểm tra `_tests/0004_test.sql`**
  Insert 1 `quiz_questions` với `correct_index=2`; `SELECT * FROM quiz_questions_public` → kết quả không được có cột `correct_index`. `SELECT column_name FROM information_schema.columns WHERE table_name='quiz_questions_public';` phải không liệt kê `correct_index`.

- [x] **Step 3: Chạy thử migration & script kiểm tra**
  Chạy: `supabase db reset` rồi `supabase db execute --file supabase/migrations/_tests/0004_test.sql`.
  Expected: view không lộ `correct_index`. (Ghi chú: Docker engine chưa chạy, file SQL đã chuẩn bị sẵn sàng chạy reset khi bật Docker hoặc nạp vào Supabase).

- [x] **Step 4: Commit**
  ```bash
  git add supabase/migrations/0004_quiz.sql supabase/migrations/_tests/0004_test.sql
  git commit -m "feat: add quiz tables and answer-safe public view"
  ```

---

### Task 5: Học liệu số / Giải trí / Tiện ích (bảng `resources` dùng chung)

**Files:**
- Create: `supabase/migrations/0005_resources.sql`
- Test: `supabase/migrations/_tests/0005_test.sql`

**Interfaces:**
- Consumes: `profiles(id)` từ Task 1.
- Produces: `resources(id uuid pk default gen_random_uuid(), type text check (type in ('video','link','game')), grade smallint, title text not null, url text not null, thumbnail_url text, is_active boolean default false, created_by uuid references profiles(id), created_at timestamptz default now())`.

- [x] **Step 1: Viết migration `0005_resources.sql`**
  Tạo bảng đúng cột, bật RLS.

- [x] **Step 2: Viết script kiểm tra `_tests/0005_test.sql`**
  Insert `type='game'` với `url` hợp lệ → thành công; insert `type='movie'` (không nằm trong check list) → phải lỗi check constraint.

- [x] **Step 3: Chạy thử migration & script kiểm tra**
  Chạy: `supabase db reset` rồi `supabase db execute --file supabase/migrations/_tests/0005_test.sql`.
  Expected: insert hợp lệ qua; `type` sai bị chặn. (Ghi chú: Docker engine chưa chạy, file SQL đã chuẩn bị sẵn sàng chạy reset khi bật Docker hoặc nạp vào Supabase).

- [x] **Step 4: Commit**
  ```bash
  git add supabase/migrations/0005_resources.sql supabase/migrations/_tests/0005_test.sql
  git commit -m "feat: add resources table for digital materials/games/utilities links"
  ```

---

### Task 6: RLS cho Admin / Giáo viên

**Files:**
- Create: `supabase/migrations/0006_rls_teacher_admin.sql`
- Test: `supabase/migrations/_tests/0006_test.sql`

**Interfaces:**
- Consumes: tất cả bảng từ Task 1–5.
- Produces: policy đặt tên theo mẫu `<table>_teacher_select`, `<table>_teacher_write`, dùng helper function `is_admin()` và `is_class_owner(class_id uuid)`.

- [ ] **Step 1: Viết 2 helper function**
  `is_admin() returns boolean` = `exists (select 1 from profiles where id = auth.uid() and role = 'admin')`.
  `is_class_owner(p_class_id uuid) returns boolean` = `is_admin() or exists (select 1 from classes where id = p_class_id and created_by = auth.uid())`. Cả 2 khai báo `security definer` để không bị chính RLS của `profiles`/`classes` chặn ngược khi tự kiểm tra.

- [ ] **Step 2: Viết policy cho `classes`, `students`, `attendance`, `weekly_evaluations`, `scores`**
  Mỗi bảng: policy SELECT/INSERT/UPDATE/DELETE cho role đã đăng nhập (`auth.role() = 'authenticated'`) chỉ khi `is_class_owner(class_id)` đúng (với `students`/`attendance`/... join qua `class_id` của học sinh tương ứng).

- [ ] **Step 3: Viết policy cho `quiz_topics`, `quiz_questions`, `resources`**
  Admin đọc/ghi tất cả; giáo viên đọc tất cả (ngân hàng câu hỏi dùng chung toàn trường) nhưng chỉ sửa/xóa câu do chính mình tạo (`created_by = auth.uid()`) trừ khi `is_admin()`.

- [ ] **Step 4: Viết script kiểm tra `_tests/0006_test.sql`**
  Tạo 2 user giả lập (2 UUID khác nhau trong `profiles`, role `teacher`), 2 lớp mỗi người 1 lớp. Dùng `set local role authenticated; set local request.jwt.claim.sub = '<uuid-GV-A>';` rồi `SELECT * FROM classes;` → chỉ thấy lớp của GV A. Đổi sang GV B → chỉ thấy lớp của GV B.

- [ ] **Step 5: Chạy thử & kiểm tra**
  Chạy: `supabase db reset` rồi `supabase db execute --file supabase/migrations/_tests/0006_test.sql`.
  Expected: mỗi GV chỉ thấy đúng lớp mình, không thấy lớp người khác (đúng Review Focus #1).

- [ ] **Step 6: Commit**
  ```bash
  git add supabase/migrations/0006_rls_teacher_admin.sql supabase/migrations/_tests/0006_test.sql
  git commit -m "feat: add teacher/admin RLS policies"
  ```

---

### Task 7: RLS cho học sinh (Anonymous Auth qua mã phòng)

**Files:**
- Create: `supabase/migrations/0007_rls_student_anon.sql`
- Test: `supabase/migrations/_tests/0007_test.sql`

**Interfaces:**
- Consumes: `room_sessions` từ Task 2, `quiz_questions_public` từ Task 4.
- Produces: helper `current_room_class_id() returns uuid` = `select class_id from room_sessions where auth_uid = auth.uid()`; policy cho phép role ẩn danh (`auth.role() = 'anon'` sau khi đã `signInAnonymously`, tức có `auth.uid()` nhưng không có dòng trong `profiles`) SELECT trên `classes`/`students`/`attendance`/`scores` chỉ khi `class_id = current_room_class_id()`; SELECT trên `quiz_questions_public` (không giới hạn lớp, vì ngân hàng câu hỏi dùng chung); INSERT trên `quiz_sessions`/`quiz_results` không giới hạn (học sinh tự tạo phiên thi của mình); SELECT trên `resources` khi `is_active = true`.

- [ ] **Step 1: Viết helper `current_room_class_id()`**
  `security definer`, trả về `null` nếu chưa có `room_sessions` khớp — khi đó mọi policy so sánh `class_id = current_room_class_id()` tự động fail (null ≠ bất kỳ uuid nào), tức "chưa vào phòng thì không thấy gì" (đúng Review Focus #2).

- [ ] **Step 2: Viết policy SELECT cho `classes`, `students`, `attendance`, `scores`**
  Điều kiện: `class_id = current_room_class_id()` (hoặc với `students`/`attendance`/`scores`, join qua `student_id → students.class_id`).

- [ ] **Step 3: Viết policy cho `quiz_questions_public`, `quiz_sessions`, `quiz_results`, `resources`**
  `quiz_questions_public`: SELECT không giới hạn theo lớp (đúng thiết kế view đã bỏ đáp án ở Task 4). Tuyệt đối không thêm policy nào cho phép role anon SELECT trực tiếp bảng gốc `quiz_questions`. `quiz_sessions`/`quiz_results`: INSERT mở cho anon; SELECT giới hạn `session_id` do chính họ tạo trong phiên hiện tại (so `auth_uid` lưu kèm nếu cần — nếu bảng chưa có cột này, thêm `created_by_auth_uid uuid default auth.uid()` vào `quiz_sessions` trong migration này). `resources`: SELECT khi `is_active = true`.

- [ ] **Step 4: Viết script kiểm tra `_tests/0007_test.sql`**
  Giả lập 1 user anon chưa có `room_sessions` → `SELECT * FROM classes;` phải ra 0 dòng (Review Focus #2). Thêm `room_sessions` khớp lớp A cho user này → `SELECT * FROM classes WHERE id = '<lớp B>';` vẫn phải ra 0 dòng dù lớp B tồn tại (Review Focus #3). `SELECT * FROM quiz_questions;` (bảng gốc) với role anon → phải bị từ chối bởi RLS (không có policy nào cho phép) (Review Focus #4).

- [ ] **Step 5: Chạy thử & kiểm tra**
  Chạy: `supabase db reset` rồi `supabase db execute --file supabase/migrations/_tests/0007_test.sql`.
  Expected: cả 3 trường hợp ở Step 4 đúng như mô tả.

- [ ] **Step 6: Commit**
  ```bash
  git add supabase/migrations/0007_rls_student_anon.sql supabase/migrations/_tests/0007_test.sql
  git commit -m "feat: add student anonymous-auth RLS policies"
  ```

---

### Task 8: Dữ liệu mẫu để test thủ công trên local

**Files:**
- Create: `supabase/seed/seed.sql`

**Interfaces:**
- Consumes: toàn bộ bảng từ Task 1–5.

- [ ] **Step 1: Viết `seed.sql`**
  1 admin + 1 giáo viên (ghi chú: phải tạo user qua `supabase.auth.admin.createUser` hoặc Studio trước, vì `auth.users` không insert tay được dễ dàng — ghi rõ ghi chú này trong file seed thay vì insert thẳng), 1 năm học `2026-2027`, 2 lớp, mỗi lớp 5 học sinh mẫu, vài câu hỏi trắc nghiệm mẫu theo khối, 1 resource mẫu mỗi loại (video/link/game).

- [ ] **Step 2: Chạy seed trên local**
  Chạy: `supabase db reset` (tự chạy seed nếu `config.toml` trỏ đúng `supabase/seed/seed.sql`).
  Expected: không lỗi; `SELECT count(*) FROM students;` ra đúng số đã seed.

- [ ] **Step 3: Commit**
  ```bash
  git add supabase/seed/seed.sql
  git commit -m "chore: add local seed data for manual testing"
  ```

---

## Self-Review (đã thực hiện)

1. **Spec coverage:** Mọi bảng trong phác thảo schema của design doc đều có task tương ứng (Task 1–5); Auth GV/Admin + Anonymous Auth học sinh có task riêng (Task 6–7); "không god document", "mật khẩu không lưu ở app", "xáo trộn không lộ đáp án", "RLS theo role/lớp" đều có task và test cụ thể.
2. **Step scan:** Mỗi step đều cho ra đúng 1 hành động cụ thể (viết 1 file, chạy 1 lệnh, kiểm tra 1 kết quả) — không có step kiểu "xử lý các trường hợp còn lại".
3. **Type consistency:** `class_id`, `student_id`, `topic_id`... dùng `uuid` xuyên suốt tất cả bảng tham chiếu; tên cột `correct_index`, `room_code`, `class_id` dùng nhất quán từ Task 2 đến Task 7.
4. **Review Focus:** cả 5 mục đều có test cụ thể gắn vào đúng task sở hữu (GV chéo lớp → Task 6; học sinh chưa vào phòng / sai lớp / đọc thẳng bảng gốc → Task 7; xếp loại → Task 3; trùng mã học sinh → Task 2).
5. **Proportion:** plan này dài vì có 8 task × script test riêng, nhưng mỗi task tương ứng đúng 1 file SQL thật sẽ viết — không phải chép lại toàn bộ nội dung file, chỉ nêu đúng cột/điều kiện cần nhớ.
