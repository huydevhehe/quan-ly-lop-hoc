# QLLH — Giai đoạn 2F: Sửa lỗi "nối dây giả" — Hoàn thiện wiring thật & gỡ dual-write

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa lỗi nghiêm trọng phát hiện khi audit độc lập: nhiều component (đặc biệt `ClassroomManager.tsx`) được báo "đã nối Supabase" ở Giai đoạn 2A/2B/2C/2D/3C nhưng thực tế vẫn chạy 100% hoặc một phần trên `dbStorage.ts`/`firebase.ts` cũ, gây lệch ID (lớp/học sinh ID kiểu cũ `"c1"` vs UUID Supabase thật) và ghi dữ liệu song song vào Firestore cũ (`pushAllDataToFirestore`, `syncQuizSubmissionToFirestore`) — đúng lỗi gốc ban đầu của dự án.

**Architecture:** Không tạo service mới — toàn bộ service cần thiết đã có từ Giai đoạn 2A–2D. Việc duy nhất ở plan này: xóa sạch mọi lời gọi `dbStorage.ts`/`firebase.ts` còn sót trong từng component, thay bằng đúng service đã có, và thêm **1 bài kiểm tra tự động chống tái phạm** (vì lỗi này lọt qua được do không có gì tự động phát hiện).

**Tech Stack:** Không đổi.

**Spec:** `docs/superpowers/specs/2026-11-14-qllh-rebuild-design.md`. Bằng chứng lỗi: xem phần audit trong cuộc trao đổi dẫn tới plan này (grep thực tế trên source, không phải suy đoán).

## Global Constraints

- Sau mỗi Task, chạy `npm run build` thật (không chỉ `tsc --noEmit`) — vì unused import/dead code có thể không báo lỗi TypeScript nhưng vẫn là dấu hiệu chưa nối xong.
- **Không được chỉ xóa import rồi để nguyên logic cũ bên dưới chạy "chay"** — phải thay bằng lời gọi service thật, có test thủ công xác nhận dữ liệu thật sự đọc/ghi đúng Supabase (xem qua Supabase Studio hoặc `psql`).
- Sau khi 1 component hết phụ thuộc `dbStorage`/`firebase`, **xóa luôn các import đó khỏi đầu file** — không để lại "phòng khi cần" (đây chính là nguyên nhân của lần lộn xộn này).

## Review Focus

- `selectedClassId`/`selectedStudentId` ở bất kỳ component nào sau khi sửa phải là UUID thật của Supabase — kiểm tra bằng cách log ra console 1 lần và nhìn bằng mắt, không phải chuỗi kiểu `"c1"`/`"c_17..."` còn sót.
- Sau khi sửa `ClassroomManager.tsx`, tạo 1 lớp mới trên UI → phải thấy dòng mới xuất hiện thật trong bảng `classes` trên Supabase (kiểm tra qua Table Editor hoặc `psql`), không chỉ thấy trên giao diện (có thể đang hiện từ state cũ của localStorage).
- Sau khi gỡ `pushAllDataToFirestore` khỏi `QuizBank.tsx`/`DigitalResources.tsx`, mở DevTools Network khi thêm 1 câu hỏi/resource mới → **không được còn request nào gọi tới `firestore.googleapis.com`**.
- `AdminPanel.tsx` sau khi nối `listStaff` thật → danh sách tài khoản hiển thị phải khớp đúng số dòng trong bảng `profiles` trên Supabase, không phải số tài khoản mẫu cũ trong `localStorage`.
- Bài test chống tái phạm (Task 5) phải **tự fail ngay nếu ai đó thêm lại** 1 dòng `import ... from '../firebase'` vào bất kỳ component nào sau này — không được chỉ chạy đúng 1 lần cho vui rồi bỏ.

---

### Task 1: Sửa `ClassroomManager.tsx` — nối thật 100%

**Files:**
- Modify: `src/components/ClassroomManager.tsx`

**Interfaces:**
- Consumes: `classesService` (`listMyClasses`, `createClass`, `updateClass`, `deleteClass`), `studentsService` (`listStudentsByClass`, `upsertStudents`, `deleteStudent`), `attendanceService` (`getWeekAttendance`, `saveWeekAttendance`, `getWeekEvaluations`, `saveWeekEvaluation`) — tất cả đã có sẵn từ Giai đoạn 2A/2B, import đã có sẵn ở đầu file, chỉ chưa được gọi.

- [ ] **Step 1: Đọc toàn bộ file `ClassroomManager.tsx` (file lớn, đọc hết, không đọc lướt)**

- [ ] **Step 2: Liệt kê ra giấy/comment tạm mọi state đang khởi tạo từ `getSaved*` và mọi chỗ gọi `save*Permanently`/`pushAllDataToFirestore`**
  (Đã thấy ở audit: >40 chỗ — cần liệt kê đủ trước khi sửa để không sót.)

- [ ] **Step 3: Thay từng state/effect một — chuyển state lớp/học sinh sang load bằng `useEffect` gọi `listMyClasses()`/`listStudentsByClass()` thay vì `useState(() => getSavedClasses(...))`**
  Vì gọi Supabase là bất đồng bộ (Promise), không thể dùng trong hàm khởi tạo `useState` đồng bộ như cũ — phải đổi pattern sang `useState([])` rồi `useEffect` load dữ liệu, có `loading` state nếu UI cần hiện skeleton/spinner trong lúc chờ.

- [ ] **Step 4: Thay mọi hành động tạo/sửa/xóa lớp, học sinh, điểm danh, đánh giá tuần → gọi đúng service tương ứng, rồi load lại danh sách (hoặc cập nhật state cục bộ optimistic) — bỏ hẳn `saveClassesPermanently`, `saveStudentsPermanently`, `saveWeeksPermanently`, `saveEvalsPermanently`, `pushAllDataToFirestore` ở mọi nơi trong file này**

- [ ] **Step 5: Xóa import `dbStorage`, `firebase`, `userScope` khỏi đầu file (Global Constraint — không để lại "phòng khi cần")**

- [ ] **Step 6: Chạy `npm run build`**
  Expected: build thành công, không còn cảnh báo unused import liên quan dbStorage/firebase.

- [ ] **Step 7: Kiểm tra thủ công (Review Focus #1, #2)**
  `npm run dev`: tạo 1 lớp mới → mở Supabase Table Editor xem bảng `classes` có dòng mới thật không. Thêm học sinh, điểm danh, đánh giá tuần → tương tự kiểm tra trong bảng `students`/`attendance`/`weekly_evaluations`.

- [ ] **Step 8: Commit**
  ```bash
  git add src/components/ClassroomManager.tsx
  git commit -m "fix: fully wire ClassroomManager to Supabase services, remove legacy data layer"
  ```

---

### Task 2: Sửa lệch ID trong `ReportsSection.tsx`

**Files:**
- Modify: `src/components/ReportsSection.tsx`

- [ ] **Step 1: Đọc lại toàn bộ file**

- [ ] **Step 2: Thay `classesList`/`studentsList` (đang từ `getSavedClasses`/`getSavedStudents`) bằng `classesService.listMyClasses()`/`studentsService.listStudentsByClass()`**
  Đây chính là nguồn gây lệch ID đã phát hiện — sau khi sửa, `selectedClassId` sẽ là UUID thật, khớp với `getClassScores` đang query Supabase.

- [ ] **Step 3: Thay nốt `gradeData` (đang từ `getSavedGrades`) bằng `scoresService.getClassScores` nếu còn chỗ nào chưa đổi, xóa import cũ ở đầu file**

- [ ] **Step 4: Chạy `npm run build`, kiểm tra thủ công**
  Chọn 1 lớp có dữ liệu điểm thật trong Supabase → bảng điểm phải hiện đúng, không còn rỗng (bug đã xác nhận trước khi sửa).

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/ReportsSection.tsx
  git commit -m "fix: resolve class/student ID mismatch between legacy storage and Supabase in ReportsSection"
  ```

---

### Task 3: Gỡ dual-write ở `QuizBank.tsx`, `DigitalResources.tsx`, `StudentPortal.tsx`

**Files:**
- Modify: `src/components/QuizBank.tsx`
- Modify: `src/components/DigitalResources.tsx`
- Modify: `src/components/StudentPortal.tsx`

- [ ] **Step 1: Xóa mọi lời gọi `pushAllDataToFirestore()` trong `QuizBank.tsx` và `DigitalResources.tsx`, xóa import `firebase` nếu không còn dùng gì khác trong file**

- [ ] **Step 2: Xóa lời gọi `syncQuizSubmissionToFirestore(submission)` trong `StudentPortal.tsx`, xóa import tương ứng**

- [ ] **Step 3: Kiểm tra thủ công (Review Focus #3)**
  Mở DevTools → tab Network, lọc `firestore` → thêm 1 câu hỏi mới, 1 resource mới, nộp 1 bài thi → xác nhận **không còn request nào** gọi `firestore.googleapis.com`.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/QuizBank.tsx src/components/DigitalResources.tsx src/components/StudentPortal.tsx
  git commit -m "fix: remove dual-write to legacy Firestore from quiz, resources and exam submission flows"
  ```

---

### Task 4: Nối thật `AdminPanel.tsx` phần tài khoản GV

**Files:**
- Modify: `src/components/AdminPanel.tsx`

- [ ] **Step 1: Đọc lại toàn bộ file, xác nhận đúng những đoạn audit đã chỉ ra (dòng ~38-42, ~126-246, ~955-957) còn dùng `pushAllDataToFirestore`/`getSavedClasses`/`getSavedStudents`**

- [ ] **Step 2: Thay danh sách tài khoản GV/Admin bằng `adminService.listStaff()`, tạo tài khoản mới bằng `adminService.createStaffAccount()`, gán lớp bằng `adminService.assignTeacherToClass()` (cả 3 hàm đã có từ Giai đoạn 2D)**

- [ ] **Step 3: Thay 2 chỗ `getSavedClasses`/`getSavedStudents` còn sót (dòng ~956-957) bằng `classesService.listMyClasses()`/`studentsService.listStudentsByClass()`**

- [ ] **Step 4: Xóa toàn bộ import `firebase`/`dbStorage` khỏi đầu file**

- [ ] **Step 5: Kiểm tra thủ công (Review Focus #4)**
  Đếm số tài khoản hiện trên UI, so với `select count(*) from profiles` qua `psql`/Table Editor — phải khớp.

- [ ] **Step 6: Commit**
  ```bash
  git add src/components/AdminPanel.tsx
  git commit -m "fix: fully wire AdminPanel staff account management to Supabase"
  ```

---

### Task 5: Sửa `App.tsx` (nặng nhất, chứa auth/bootstrap toàn app) và `Sidebar.tsx`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Đọc toàn bộ `App.tsx`**
  Đã audit thấy các chỗ cần sửa: `fetchAllDataFromFirestore`, `subscribeToFirestoreData`, `pushAllDataToFirestore`/`pushAllDataToFirestoreEx` (nhiều chỗ bootstrap app lúc load, lúc đổi tài khoản, lúc đổi mật khẩu), và `getSavedClasses`/`getSavedStudents`/`getSavedCurrentYear` dùng làm state gốc của toàn app.

- [ ] **Step 2: Thay phần bootstrap đăng nhập/phiên làm việc bằng `authService.getCurrentSession()` (đã có từ Giai đoạn 2A) thay vì `fetchAllDataFromFirestore`/`subscribeToFirestoreData`**
  Vì luồng đăng nhập/phiên giờ do Supabase Auth quản lý (`onAuthStateChange`), không cần tự nghe Firestore realtime nữa — xóa hẳn `subscribeToFirestoreData`.

- [ ] **Step 3: Thay state lớp/học sinh/năm học gốc của app bằng `classesService`/`studentsService`, xóa `pushAllDataToFirestore`/`pushAllDataToFirestoreEx` ở mọi nơi (kể cả chỗ đổi mật khẩu — đổi mật khẩu giờ qua Supabase Auth, không cần đồng bộ Firestore nữa)**

- [ ] **Step 4: Sửa `Sidebar.tsx` — thay 2 dòng `getSavedYears`/`getSavedClasses` bằng `classesService.listMyClasses()` (năm học có thể suy ra từ `school_year_id` của danh sách lớp, hoặc gọi thêm 1 hàm nhỏ nếu `classesService` chưa có sẵn — nếu thiếu, bổ sung hàm `listSchoolYears()` vào `classesService.ts` ở bước này)**

- [ ] **Step 5: Xóa import `firebase`/`dbStorage`/`userScope` khỏi cả 2 file**

- [ ] **Step 6: Chạy `npm run build`, kiểm tra thủ công toàn bộ luồng đăng nhập → vào lớp → đổi lớp trong Sidebar**

- [ ] **Step 7: Commit**
  ```bash
  git add src/App.tsx src/components/Sidebar.tsx
  git commit -m "fix: fully wire App bootstrap and Sidebar to Supabase, remove Firestore realtime listener"
  ```

---

### Task 6: Bài test chống tái phạm (tự động)

**Files:**
- Create: `src/__tests__/no-legacy-imports.test.ts`

**Interfaces:**
- Produces: 1 test tự động quét toàn bộ `src/components/**/*.tsx` + `src/App.tsx`, fail ngay nếu còn dòng `from '../firebase'`, `from './firebase'`, hoặc `from '../utils/dbStorage'`/`from './utils/dbStorage'`.

- [ ] **Step 1: Viết test**
  ```ts
  import { describe, it, expect } from 'vitest';
  import { readdirSync, readFileSync, statSync } from 'fs';
  import { join } from 'path';

  function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? listFiles(full) : [full];
    });
  }

  describe('khong con phu thuoc code cu (dbStorage/firebase) trong component', () => {
    const files = [
      ...listFiles(join(__dirname, '../components')).filter((f) => f.endsWith('.tsx')),
      join(__dirname, '../App.tsx'),
    ];

    it.each(files)('%s khong import firebase hoac dbStorage', (file) => {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from ['"].*\/firebase['"]/);
      expect(content).not.toMatch(/from ['"].*\/dbStorage['"]/);
    });
  });
  ```

- [ ] **Step 2: Chạy test ngay (trước khi Task 1-4 làm xong hẳn, để thấy nó đúng là đang fail)**
  Chạy: `npx vitest run src/__tests__/no-legacy-imports.test.ts`.
  Expected: FAIL ở đúng các file chưa sửa xong — nếu Task 1-4 đã làm hết thì PASS toàn bộ.

- [ ] **Step 3: Nếu còn fail, quay lại đúng Task tương ứng với file đó, sửa cho xong trước khi tiếp tục**

- [ ] **Step 4: Chạy lại `npx vitest run` toàn bộ project**
  Expected: PASS hết (bao gồm cả test mới này), 0 lỗi `npm run lint`.

- [ ] **Step 5: Commit**
  ```bash
  git add src/__tests__/no-legacy-imports.test.ts
  git commit -m "test: add automated guard against legacy Firestore/localStorage imports"
  ```

---

## Self-Review (đã thực hiện)

1. **Spec coverage:** Toàn bộ 8 file phát hiện trong audit (`ClassroomManager`, `ReportsSection`, `QuizBank`, `DigitalResources`, `StudentPortal`, `AdminPanel`, `App.tsx`, `Sidebar.tsx`) đều có task sửa đúng tên file, đúng dòng đã audit thật (grep trực tiếp, không suy đoán). Không còn file nào bị bỏ sót so với danh sách audit ban đầu.
2. **Step scan:** Task 1 Step 1-2 là đọc/liệt kê trước khi sửa (đúng tinh thần, không đoán) vì đây là file lớn chưa đọc hết.
3. **Type consistency:** Tên hàm dùng đúng 100% như đã định nghĩa ở Giai đoạn 2A-2D, không đặt tên mới.
4. **Review Focus:** lệch ID → Task 1, 2; dual-write → Task 3; đếm tài khoản sai → Task 4; chống tái phạm → Task 5 (đã viết thành test thật, không phải lời hứa).
5. **Proportion:** 6 task cho khối lượng sửa lớn (8 file + 1 test mới) — hợp lý, không phình to vì đây là sửa lỗi cụ thể đã xác định rõ ràng, không phải tính năng mới.

**Sau khi plan này xong và pass hết:** Giai đoạn 2E (xóa `dbStorage.ts`/`firebase.ts`) mới thật sự đủ điều kiện chạy — Task 6 (test chống tái phạm) chính là bài kiểm tra xác nhận điều kiện đó.
