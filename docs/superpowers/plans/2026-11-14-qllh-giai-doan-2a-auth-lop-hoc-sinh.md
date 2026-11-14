# QLLH — Giai đoạn 2A: Chuyển Đăng nhập, Lớp học, Học sinh sang Supabase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay toàn bộ phần Đăng nhập, Lớp học, Học sinh đang chạy trên `localStorage` + Firestore "1 document" (`src/firebase.ts`, `src/utils/dbStorage.ts`, `src/utils/userScope.ts`) bằng gọi thẳng Supabase (schema đã tạo ở Giai đoạn 1: `profiles`, `classes`, `students`, `room_sessions`), để quyền hạn được chặn thật ở database (RLS) thay vì chỉ lọc ở giao diện.

**Architecture:** Thêm lớp `src/lib/supabaseClient.ts` + `src/services/*` gọi Supabase JS SDK. Các component (`LoginModal.tsx`, `RoomCodeModal.tsx`, `ClassroomManager.tsx`, `App.tsx`) đổi từ gọi `dbStorage.ts`/`firebase.ts` sang gọi `services/*`. Attendance/Scores/Quiz/Resources **chưa đổi** ở plan này — vẫn chạy trên `dbStorage.ts` cũ, sẽ có plan riêng (Giai đoạn 2B/2C/2D) vì đây là các subsystem độc lập.

**Tech Stack:** `@supabase/supabase-js`, React 19, TypeScript, Vite (stack hiện có của project, không đổi).

**Spec:** `docs/superpowers/specs/2026-11-14-qllh-rebuild-design.md`; schema tham chiếu: `docs/superpowers/plans/2026-11-14-qllh-nen-tang-be.md`.

## Global Constraints

- Không được đọc/ghi mật khẩu dạng chữ thường ở bất kỳ đâu trong code mới — mật khẩu GV/Admin đăng nhập qua Supabase Auth (`supabase.auth.signInWithPassword`), không còn so khớp thủ công với trường `password` trong `UserAccount`.
- Không được tự ý giữ lại cơ chế lọc phía client (`filterClassesForUser`, `isClassVisibleForUser`) làm hàng rào bảo mật duy nhất — RLS ở Supabase mới là hàng rào thật; code FE có thể vẫn hiển thị theo thứ tự nhưng không dựa vào nó để "giấu" dữ liệu.
- Học sinh vào bằng mã phòng phải qua `supabase.auth.signInAnonymously()` + ghi `room_sessions`, không tự chế cơ chế khác.
- Giữ nguyên `UserAccount`, `Classroom`, `Student` ở `src/types/index.ts` làm kiểu dữ liệu hiển thị cho UI (để không phải sửa hết mọi component cùng lúc) — các hàm service mới chịu trách nhiệm chuyển đổi (map) giữa cột Supabase (`snake_case`) và các interface này (`camelCase`).

## Review Focus

- Giáo viên đăng nhập sai mật khẩu 3 lần liên tiếp → Supabase Auth phải trả lỗi rõ ràng, UI không được crash hay hiện "đăng nhập thành công" nhầm.
- Học sinh nhập mã phòng sai (không tồn tại lớp nào có `room_code` đó) → phải báo lỗi "mã phòng không đúng", không được tạo `room_sessions` trỏ tới `class_id = null`.
- Giáo viên A (đã đăng nhập thật qua Supabase Auth) gọi `classesService.listMyClasses()` → chỉ nhận lớp của mình, dù trước đó từng là Admin xem được hết (kiểm tra RLS thật hoạt động, không phải do code FE lọc).
- Tạo 2 học sinh cùng mã (`student_code`) trong cùng 1 lớp qua `studentsService.upsertStudents` → phải nhận lỗi rõ ràng từ Supabase (vi phạm unique), không được âm thầm ghi đè hay crash trắng màn hình.
- Học sinh đã vào lớp A (có `room_sessions` hợp lệ) nhưng URL/code cố truyền `classId` của lớp B vào `studentsService.listStudentsByClass('<lớp B>')` → phải trả về mảng rỗng (RLS chặn), không phải lỗi 500.

---

### Task 1: Khởi tạo Supabase client trong FE

**Files:**
- Create: `src/lib/supabaseClient.ts`
- Modify: `.env.example` (thêm 2 biến mới)
- Test: `src/lib/__tests__/supabaseClient.test.ts`

**Interfaces:**
- Produces: `export const supabase: SupabaseClient` (export duy nhất, đã cấu hình `auth: { persistSession: true, autoRefreshToken: true }`).

- [x] **Step 1: Cài package**
  Chạy: `npm install @supabase/supabase-js`.

- [x] **Step 2: Thêm biến môi trường**
  Thêm vào `.env.example`:
  ```
  VITE_SUPABASE_URL="MY_SUPABASE_URL"
  VITE_SUPABASE_ANON_KEY="MY_SUPABASE_ANON_KEY"
  ```

- [x] **Step 3: Viết `src/lib/supabaseClient.ts`**
  Đọc `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, tạo client bằng `createClient()`. Nếu thiếu biến môi trường, `throw new Error('Thiếu cấu hình Supabase — kiểm tra file .env')` ngay khi import (fail sớm, không để lỗi mơ hồ lúc gọi API sau này).

- [x] **Step 4: Viết test**
  Test: giả lập thiếu `VITE_SUPABASE_URL` (mock `import.meta.env`) → import module phải ném lỗi đúng message trên.

- [x] **Step 5: Chạy test**
  Chạy: `npm run lint` (project dùng `tsc --noEmit` làm lint, chưa có test runner — nếu chưa có Vitest, thêm `vitest` vào devDependencies trước, chạy `npx vitest run src/lib/__tests__/supabaseClient.test.ts`).
  Expected: PASS.

- [x] **Step 6: Commit**
  ```bash
  git add package.json package-lock.json .env.example src/lib/supabaseClient.ts src/lib/__tests__/supabaseClient.test.ts
  git commit -m "feat: add Supabase client setup"
  ```

---

### Task 2: `authService` — đăng nhập GV/Admin + học sinh qua mã phòng

**Files:**
- Create: `src/services/authService.ts`
- Test: `src/services/__tests__/authService.test.ts`

**Interfaces:**
- Consumes: `supabase` từ Task 1; bảng `profiles`, `classes`, `room_sessions` (từ Giai đoạn 1).
- Produces:
  - `signInStaff(email: string, password: string): Promise<{ profile: UserAccount } | { error: string }>`
  - `signInStudentWithRoomCode(roomCode: string, studentDisplayName: string): Promise<{ classId: string } | { error: string }>`
  - `signOut(): Promise<void>`
  - `getCurrentSession(): Promise<{ role: 'admin' | 'teacher' | 'student' | null }>`

- [x] **Step 1: Viết test cho `signInStaff` sai mật khẩu**
  ```ts
  test('signInStaff tra loi khi sai mat khau', async () => {
    const result = await signInStaff('gv1@qllh.local', 'sai-mat-khau');
    expect('error' in result).toBe(true);
  });
  ```

- [x] **Step 2: Chạy test, xác nhận fail**
  Chạy: `npx vitest run src/services/__tests__/authService.test.ts -t "signInStaff tra loi"`.
  Expected: FAIL với "signInStaff is not defined".

- [x] **Step 3: Implement `signInStaff`**
  Gọi `supabase.auth.signInWithPassword({ email, password })`. Nếu lỗi → trả `{ error: 'Sai email hoặc mật khẩu' }`. Nếu thành công → `select * from profiles where id = auth.uid()` lấy role/full_name, map sang `UserAccount` (điền `username: email`, bỏ trống `password`), trả `{ profile }`.

- [x] **Step 4: Viết test cho `signInStudentWithRoomCode` — mã phòng sai**
  ```ts
  test('signInStudentWithRoomCode tra loi khi ma phong khong ton tai', async () => {
    const result = await signInStudentWithRoomCode('MA-KHONG-TON-TAI', 'Nguyen Van A');
    expect('error' in result).toBe(true);
  });
  ```

- [x] **Step 5: Chạy test, xác nhận fail rồi implement**
  Implement `signInStudentWithRoomCode`: gọi `supabase.auth.signInAnonymously()` nếu chưa có session anon; `select id from classes where room_code = roomCode`; nếu không tìm thấy → `signOut()` session anon vừa tạo rồi trả `{ error: 'Mã phòng không đúng' }` (đúng Review Focus #2 — không được tạo `room_sessions` trỏ `class_id = null`); nếu tìm thấy → `insert into room_sessions (auth_uid, class_id) values (auth.uid(), classId)` rồi trả `{ classId }`.

- [x] **Step 6: Chạy lại toàn bộ test file**
  Chạy: `npx vitest run src/services/__tests__/authService.test.ts`.
  Expected: PASS cả 2 test.

- [x] **Step 7: Commit**
  ```bash
  git add src/services/authService.ts src/services/__tests__/authService.test.ts
  git commit -m "feat: add authService for staff login and student room-code join"
  ```

---

### Task 3: `classesService`

**Files:**
- Create: `src/services/classesService.ts`
- Test: `src/services/__tests__/classesService.test.ts`

**Interfaces:**
- Consumes: `supabase` từ Task 1; `Classroom` type từ `src/types/index.ts`.
- Produces:
  - `listMyClasses(): Promise<Classroom[]>`
  - `createClass(input: { name: string; grade: number; schoolYearId: string }): Promise<Classroom>`
  - `updateClass(id: string, patch: Partial<{ name: string; grade: number; isOpen: boolean }>): Promise<void>`
  - `deleteClass(id: string): Promise<void>`

- [x] **Step 1: Viết test "GV chỉ thấy lớp mình" (Review Focus #3)**
  Test tích hợp (cần 2 tài khoản GV mẫu đã seed ở Giai đoạn 1 `supabase/seed/seed.sql`): đăng nhập GV A qua `authService.signInStaff`, gọi `listMyClasses()` → kết quả không được chứa lớp nào có `created_by` khác GV A.

- [x] **Step 2: Chạy test, xác nhận fail**
  Expected: FAIL vì `classesService` chưa tồn tại.

- [x] **Step 3: Implement 4 hàm**
  `listMyClasses`: `select * from classes` (RLS tự lọc theo `is_class_owner`, không cần `where` thủ công ở FE) → map `room_code → roomCode`, `school_year_id → ...`, đếm `totalStudents` bằng `select count(*) from students where class_id = ...` riêng mỗi lớp hoặc 1 query `group by`. `createClass`: sinh `room_code` ngẫu nhiên 6 ký tự hoa (giữ đúng định dạng cũ kiểu `F08AF1`) nếu không truyền sẵn, `insert into classes`. `updateClass`/`deleteClass`: update/delete thẳng theo `id`, dựa vào RLS để chặn nếu không phải chủ lớp.

- [x] **Step 4: Chạy lại test**
  Expected: PASS.

- [x] **Step 5: Commit**
  ```bash
  git add src/services/classesService.ts src/services/__tests__/classesService.test.ts
  git commit -m "feat: add classesService backed by Supabase"
  ```

---

### Task 4: `studentsService`

**Files:**
- Create: `src/services/studentsService.ts`
- Test: `src/services/__tests__/studentsService.test.ts`

**Interfaces:**
- Consumes: `supabase` từ Task 1; `Student` type từ `src/types/index.ts`; `classesService` từ Task 3 (chỉ để lấy `classId` hợp lệ trong test).
- Produces:
  - `listStudentsByClass(classId: string): Promise<Student[]>`
  - `upsertStudents(classId: string, students: Array<{ code: string; name: string; gender: 'Nam'|'Nữ'; dob: string }>): Promise<Student[]>`
  - `deleteStudent(id: string): Promise<void>`

- [x] **Step 1: Viết test trùng mã học sinh (Review Focus #4)**
  ```ts
  test('upsertStudents bao loi khi trung student_code trong cung lop', async () => {
    await upsertStudents(classId, [{ code: 'HS001', name: 'A', gender: 'Nam', dob: '2018-01-01' }]);
    await expect(
      upsertStudents(classId, [{ code: 'HS001', name: 'B', gender: 'Nữ', dob: '2018-02-02' }])
    ).rejects.toThrow();
  });
  ```

- [x] **Step 2: Chạy test, xác nhận fail**
  Expected: FAIL vì `studentsService` chưa tồn tại.

- [x] **Step 3: Implement 3 hàm**
  `upsertStudents`: dùng `supabase.from('students').insert(...)` — **không** dùng `upsert` tự động đè (vì schema Giai đoạn 1 chỉ có `unique(class_id, student_code)`, không có cột `id` nghiệp vụ để upsert theo); nếu `student_code` trùng, để lỗi unique của Postgres nổi lên nguyên văn (không nuốt lỗi), đúng Global Constraints "báo lỗi rõ ràng". `listStudentsByClass`/`deleteStudent`: thẳng theo Supabase, map cột `student_code → code`.

- [x] **Step 4: Viết test "học sinh đọc nhầm lớp khác" (Review Focus #5)**
  ```ts
  test('listStudentsByClass tra mang rong neu khong co quyen', async () => {
    // dang nhap hoc sinh qua room_code cua lop A (authService.signInStudentWithRoomCode)
    const result = await listStudentsByClass(classBId); // co tinh truyen id lop khac
    expect(result).toEqual([]);
  });
  ```

- [x] **Step 5: Chạy lại toàn bộ test**
  Expected: PASS cả 2.

- [x] **Step 6: Commit**
  ```bash
  git add src/services/studentsService.ts src/services/__tests__/studentsService.test.ts
  git commit -m "feat: add studentsService backed by Supabase"
  ```

---

### Task 5: Nối `LoginModal.tsx` và `RoomCodeModal.tsx` vào service mới

**Files:**
- Modify: `src/components/LoginModal.tsx`
- Modify: `src/components/RoomCodeModal.tsx`
- Modify: `src/App.tsx` (khởi tạo phiên đăng nhập lúc load app)
- Test: thủ công qua `npm run dev` (không viết unit test cho component ở task này — xem Step 4)

**Interfaces:**
- Consumes: `authService.signInStaff`, `authService.signInStudentWithRoomCode`, `authService.getCurrentSession` từ Task 2.

- [ ] **Step 1: Đọc `LoginModal.tsx` hiện tại**
  Tìm đoạn code đang so khớp `username`/`password` với mảng `accounts` (đọc từ `localStorage.getItem('qllh_user_accounts')` hoặc tương đương) — đây là đoạn cần thay.

- [ ] **Step 2: Thay logic đăng nhập GV/Admin**
  Thay đoạn so khớp thủ công bằng gọi `authService.signInStaff(email, password)`; nếu trả `error`, hiện đúng thông báo đó lên form (không còn thông báo "sai tài khoản" tự chế cũ).

- [ ] **Step 3: Thay logic trong `RoomCodeModal.tsx`**
  Tìm đoạn đang so khớp `roomCode` với danh sách `classes` lấy từ `dbStorage`/`firebase` cũ, thay bằng gọi `authService.signInStudentWithRoomCode(roomCode, displayName)`.

- [ ] **Step 4: Kiểm tra thủ công**
  Chạy: `npm run dev`, mở trình duyệt, thử đăng nhập GV đúng/sai mật khẩu, thử nhập mã phòng đúng/sai. Ghi lại kết quả quan sát được (vì đây là UI, không có test tự động ở bước này).

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/LoginModal.tsx src/components/RoomCodeModal.tsx src/App.tsx
  git commit -m "feat: wire login and room-code UI to new authService"
  ```

---

### Task 6: Nối `ClassroomManager.tsx` vào `classesService`/`studentsService`

**Files:**
- Modify: `src/components/ClassroomManager.tsx`

**Interfaces:**
- Consumes: `classesService`, `studentsService` từ Task 3/4.

- [ ] **Step 1: Tìm mọi chỗ gọi hàm cũ**
  Tìm trong `ClassroomManager.tsx` (và component con nếu có) mọi lời gọi tới `getSavedClasses`, `saveClassesPermanently`, `getSavedStudents`, `saveStudentsPermanently`, `deleteClassFromFirestore`, `deleteStudentFromFirestore` (từ `dbStorage.ts`/`firebase.ts`).

- [ ] **Step 2: Thay từng lời gọi**
  `getSavedClasses` → `classesService.listMyClasses()`; `saveClassesPermanently` (tạo mới) → `classesService.createClass()`; `saveClassesPermanently` (sửa) → `classesService.updateClass()`; `deleteClassFromFirestore` → `classesService.deleteClass()`; tương tự với học sinh qua `studentsService`.

- [ ] **Step 3: Kiểm tra thủ công**
  Chạy: `npm run dev`, thử tạo lớp mới, thêm học sinh, xóa lớp, xóa học sinh trên giao diện thật. Xác nhận dữ liệu lên đúng Supabase (xem qua Supabase Studio hoặc `supabase db execute` một câu `select`).

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/ClassroomManager.tsx
  git commit -m "feat: wire ClassroomManager to Supabase-backed services"
  ```

---

## Self-Review (đã thực hiện)

1. **Spec coverage:** Đăng nhập GV/Admin, đăng nhập học sinh qua mã phòng, CRUD lớp, CRUD học sinh — đều có task. Attendance/Scores/Quiz/Resources cố tình **không** nằm trong plan này (ghi rõ ở Architecture) vì là subsystem riêng, sẽ có plan 2B/2C/2D kế tiếp — đúng nguyên tắc tách plan theo subsystem độc lập.
2. **Step scan:** Mỗi step cho ra đúng 1 việc làm cụ thể; các bước "tìm mọi chỗ gọi hàm cũ" (Task 6 Step 1) là tìm kiếm cụ thể theo tên hàm, không phải "xử lý các trường hợp còn lại" mơ hồ.
3. **Type consistency:** Tên hàm `listMyClasses`, `createClass`, `listStudentsByClass`, `upsertStudents` dùng nhất quán giữa phần Interfaces và các bước Implement của từng Task.
4. **Review Focus:** cả 5 mục đều có test cụ thể (sai mật khẩu → Task 2; mã phòng sai → Task 2; GV chỉ thấy lớp mình → Task 3; trùng mã học sinh → Task 4; học sinh đọc nhầm lớp → Task 4).
5. **Proportion:** Task 5/6 (nối UI) không viết sẵn code JSX cụ thể vì chưa đọc toàn bộ nội dung 2 file đó trong phiên lập plan này — thay vào đó chỉ rõ **tên hàm cần tìm và tên hàm cần thay vào**, đủ để người thực hiện (đọc đúng 2 file đó) biết chính xác phải sửa gì mà không cần đoán.
