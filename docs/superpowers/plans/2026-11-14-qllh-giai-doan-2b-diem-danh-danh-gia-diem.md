# QLLH — Giai đoạn 2B: Điểm danh, Đánh giá tuần, Bảng điểm sang Supabase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay `getSavedWeeks`/`saveWeeksPermanently`, `getSavedEvals`/`saveEvalsPermanently`, `getSavedGrades`/`saveGradesPermanently` (trong `src/utils/dbStorage.ts`) bằng service gọi Supabase (bảng `attendance`, `weekly_evaluations`, `scores` đã tạo ở Giai đoạn 1), giữ nguyên tính năng hiện có (điểm danh theo tuần, nhận xét tuần, bảng điểm lý thuyết/thực hành/xếp loại) — KHÔNG thêm tính năng mới (biểu đồ, bộ lọc... là Giai đoạn 3A).

**Architecture:** 3 service mới cùng pattern với `classesService`/`studentsService` ở Giai đoạn 2A. Nối vào `ClassroomManager.tsx` (điểm danh + đánh giá tuần, theo `Student.attendance`/tab "Tuần") và `ReportsSection.tsx` (bảng điểm, theo tab "Điểm").

**Tech Stack:** Giữ nguyên stack Giai đoạn 2A (`@supabase/supabase-js`, Vitest).

**Spec:** `docs/superpowers/specs/2026-11-14-qllh-rebuild-design.md`; tiếp nối `docs/superpowers/plans/2026-11-14-qllh-giai-doan-2a-auth-lop-hoc-sinh.md`.

## Global Constraints

- Không migrate dữ liệu thật của thầy chủ ở plan này — chỉ đổi code, dữ liệu vẫn là dữ liệu test/seed.
- `classification` (xếp loại) không tự tính tay trong code FE — luôn đọc từ cột generated `scores.classification` đã tính sẵn ở Giai đoạn 1, tránh 2 nơi tính ra 2 kết quả khác nhau.
- Mọi hàm service mới đều phải áp dụng đúng kiểu học kỳ (`'hk1' | 'ca_nam'`) và `week_number` (1–35) đúng như constraint đã có trong schema — không tự ý đổi range.

## Review Focus

- Nhập điểm lý thuyết > 10 hoặc < 0 → phải bị chặn (constraint hoặc validate FE), không được lưu điểm vô lý.
- Lưu điểm 2 lần liên tiếp cho cùng 1 học sinh cùng học kỳ (sửa điểm) → phải **update** đúng dòng cũ, không tạo thêm dòng trùng (unique `student_id, semester` đã có ở schema, code phải dùng upsert đúng cách).
- Học sinh đã nghỉ (bị xóa khỏi `students`) nhưng còn dữ liệu `attendance`/`scores` cũ → khi xóa học sinh, dữ liệu liên quan phải tự mất theo (đã có `on delete cascade` ở schema — service không được tự ý "mồ côi" dữ liệu bằng cách xóa sai thứ tự).
- Tuần chưa có điểm danh/nhận xét nào → giao diện phải hiện đúng trạng thái rỗng ("Chưa lưu điểm danh tuần này"), không crash khi `select` trả về mảng rỗng.
- Giáo viên xem bảng điểm lớp mình, học sinh trong lớp có 46 em → tải dữ liệu không được gọi N+1 query (46 query riêng lẻ) — phải lấy 1 lần bằng `where student_id = any(...)` hoặc join.

---

### Task 1: `attendanceService`

**Files:**
- Create: `src/services/attendanceService.ts`
- Test: `src/services/__tests__/attendanceService.test.ts`

**Interfaces:**
- Consumes: `supabase` (Giai đoạn 2A Task 1); bảng `attendance`, `weekly_evaluations`.
- Produces:
  - `getWeekAttendance(classId: string, weekNumber: number): Promise<Record<string, { status: 'present'|'excused'|'unexcused'; note?: string }>>` (key = `student_id`)
  - `saveWeekAttendance(weekNumber: number, records: Array<{ studentId: string; status: 'present'|'excused'|'unexcused'; note?: string }>): Promise<void>`
  - `getWeekEvaluations(classId: string, weekNumber: number): Promise<Record<string, string>>` (key = `student_id`, value = comment)
  - `saveWeekEvaluation(studentId: string, weekNumber: number, comment: string): Promise<void>`

- [x] **Step 1: Viết test "sửa điểm danh không tạo dòng trùng" (Review Focus #2, áp dụng tương tự cho attendance)**
  ```ts
  test('saveWeekAttendance ghi de dung dong cu khi luu lai cung tuan', async () => {
    await saveWeekAttendance(5, [{ studentId: sId, status: 'present' }]);
    await saveWeekAttendance(5, [{ studentId: sId, status: 'unexcused', note: 'Vang khong phep' }]);
    const result = await getWeekAttendance(classId, 5);
    expect(Object.keys(result).length).toBe(1);
    expect(result[sId].status).toBe('unexcused');
  });
  ```

- [x] **Step 2: Chạy test, xác nhận fail**
  Expected: FAIL vì `attendanceService` chưa tồn tại.

- [x] **Step 3: Implement**
  `saveWeekAttendance`: `supabase.from('attendance').upsert(records.map(r => ({ student_id: r.studentId, week_number: weekNumber, status: r.status, note: r.note })), { onConflict: 'student_id,week_number' })`. `getWeekAttendance`: join `students` để lọc theo `class_id = classId` (vì `attendance` không có cột `class_id` trực tiếp — join qua `student_id`), map kết quả thành `Record<studentId, {...}>`. Tương tự cho 2 hàm evaluation.

- [x] **Step 4: Chạy lại test**
  Expected: PASS.

- [x] **Step 5: Commit**
  ```bash
  git add src/services/attendanceService.ts src/services/__tests__/attendanceService.test.ts
  git commit -m "feat: add attendanceService backed by Supabase"
  ```

---

### Task 2: `scoresService`

**Files:**
- Create: `src/services/scoresService.ts`
- Test: `src/services/__tests__/scoresService.test.ts`

**Interfaces:**
- Consumes: `supabase`; bảng `scores`.
- Produces:
  - `getClassScores(classId: string, semester: 'hk1'|'ca_nam'): Promise<Array<{ studentId: string; theoryScore: number|null; practiceScore: number|null; totalScore: number|null; classification: 'T'|'H'|'C'|null }>>`
  - `saveScore(studentId: string, semester: 'hk1'|'ca_nam', theoryScore: number, practiceScore: number): Promise<void>`

- [ ] **Step 1: Viết test "điểm ngoài khoảng 0-10 bị chặn" (Review Focus #1)**
  ```ts
  test('saveScore bao loi khi diem ngoai khoang 0-10', async () => {
    await expect(saveScore(sId, 'hk1', 15, 5)).rejects.toThrow();
  });
  ```

- [ ] **Step 2: Chạy test, xác nhận fail**
  Expected: FAIL vì `scoresService` chưa tồn tại (và vì schema `scores` ở Giai đoạn 1 chưa có CHECK constraint giới hạn 0-10 cho `theory_score`/`practice_score` — chỉ giới hạn `numeric(4,1)` về kiểu dữ liệu, không giới hạn khoảng giá trị).

- [ ] **Step 3: Bổ sung constraint còn thiếu + implement**
  Tạo thêm migration mới `supabase/migrations/0008_scores_range_check.sql`:
  ```sql
  alter table public.scores
    add constraint scores_theory_range check (theory_score is null or (theory_score >= 0 and theory_score <= 10)),
    add constraint scores_practice_range check (practice_score is null or (practice_score >= 0 and practice_score <= 10));
  ```
  Chạy `npx supabase db push --remote` để áp lên project thật. `saveScore`: `supabase.from('scores').upsert({ student_id: studentId, semester, theory_score: theoryScore, practice_score: practiceScore }, { onConflict: 'student_id,semester' })` — để lỗi constraint nổi nguyên văn lên, không nuốt lỗi. `getClassScores`: join `students` lọc theo `class_id`, map `classification` thẳng từ cột generated, không tính lại ở FE.

- [ ] **Step 4: Chạy lại test**
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add supabase/migrations/0008_scores_range_check.sql src/services/scoresService.ts src/services/__tests__/scoresService.test.ts
  git commit -m "feat: add scoresService and score range constraint"
  ```

---

### Task 3: Nối `ClassroomManager.tsx` (tab Tuần) vào `attendanceService`

**Files:**
- Modify: `src/components/ClassroomManager.tsx`

**Interfaces:**
- Consumes: `attendanceService` từ Task 1.

- [ ] **Step 1: Đọc file, tìm mọi chỗ gọi `getSavedWeeks`, `saveWeeksPermanently`, `getSavedEvals`, `saveEvalsPermanently` (từ `dbStorage.ts`) trong component xử lý tab "Tuần"**
  (Đây là component chưa đọc đầy đủ khi viết plan này — đọc trước khi sửa, không đoán tên biến/state.)

- [ ] **Step 2: Thay bằng gọi `attendanceService`**
  `getSavedWeeks`/`getSavedEvals` (đọc dữ liệu tuần đang chọn) → `attendanceService.getWeekAttendance(classId, weekNumber)` + `getWeekEvaluations(...)`. `saveWeeksPermanently`/`saveEvalsPermanently` (khi bấm nút điểm danh/lưu nhận xét) → `saveWeekAttendance`/`saveWeekEvaluation`.

- [ ] **Step 3: Kiểm tra thủ công**
  Chạy `npm run dev`, vào 1 lớp → tab Tuần → điểm danh + ghi nhận xét vài học sinh → đổi tuần rồi quay lại → dữ liệu phải còn nguyên (đọc đúng từ Supabase, không phải cache cũ của localStorage).

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/ClassroomManager.tsx
  git commit -m "feat: wire weekly attendance and evaluation UI to attendanceService"
  ```

---

### Task 4: Nối `ReportsSection.tsx` (tab Điểm) vào `scoresService`

**Files:**
- Modify: `src/components/ReportsSection.tsx`

**Interfaces:**
- Consumes: `scoresService` từ Task 2.

- [ ] **Step 1: Đọc file, tìm mọi chỗ gọi `getSavedGrades`, `saveGradesPermanently`**

- [ ] **Step 2: Thay bằng gọi `scoresService.getClassScores`/`saveScore`**
  Giữ nguyên UI hiện có (cột Lý thuyết/Thực hành/Tổng/Xếp loại, toggle Học kỳ 1/Cuối năm, nút Xuất Excel/Lưu điểm) — chỉ đổi nguồn dữ liệu, chưa thêm tính năng mới (bộ lọc/biểu đồ là Giai đoạn 3A).

- [ ] **Step 3: Kiểm tra thủ công**
  Chạy `npm run dev`, nhập điểm vài học sinh, đổi học kỳ, F5 lại trang → điểm phải còn nguyên từ Supabase.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/ReportsSection.tsx
  git commit -m "feat: wire scores table UI to scoresService"
  ```

---

## Self-Review (đã thực hiện)

1. **Spec coverage:** Điểm danh, đánh giá tuần, bảng điểm đều có task migrate; không lẫn tính năng mới của Giai đoạn 3A vào đây.
2. **Step scan:** Task 3/4 Step 1 yêu cầu đọc file trước khi sửa (vì chưa đọc ở thời điểm viết plan) — đúng tinh thần "không đoán", không phải bước mơ hồ.
3. **Type consistency:** `studentId`/`classId`/`weekNumber`/`semester` dùng nhất quán xuyên Task 1–4, khớp kiểu đã định nghĩa ở Giai đoạn 1 (`week_number smallint`, `semester text check in ('hk1','ca_nam')`).
4. **Review Focus:** điểm ngoài khoảng → Task 2; sửa không trùng dòng → Task 1; cascade khi xóa học sinh → đã có sẵn ở schema Giai đoạn 1, không cần task riêng (chỉ cần không viết code service nào tự xóa thủ công ngược lại); tuần rỗng → Task 1 (`Record` rỗng hợp lệ, không throw); N+1 query → Task 1/2 dùng 1 query join/`in`, không loop gọi API theo từng học sinh.
5. **Proportion:** 4 task, mỗi task đúng 1 file chính — không phình to so với lượng code thực tế (2 service + 2 lần nối UI).
