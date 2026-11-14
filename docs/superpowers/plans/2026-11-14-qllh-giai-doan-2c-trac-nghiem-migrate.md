# QLLH — Giai đoạn 2C: Ngân hàng câu hỏi & Kết quả thi sang Supabase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển `QuizBank.tsx` (ngân hàng câu hỏi, CRUD, trình chiếu) và phần bảng điểm học sinh thi (hiện lưu ở `localStorage.qllh_quiz_bank` / `qllh_quiz_submissions`, đồng bộ qua Firestore trong `firebase.ts`) sang bảng `quiz_topics`/`quiz_questions`/`quiz_sessions`/`quiz_results` (Giai đoạn 1). **Chưa làm** ở plan này: ảnh câu hỏi, import Excel, xáo trộn chống gian lận, bật/tắt chủ đề động — các việc đó thuộc Giai đoạn 3B vì cần Edge Function và đổi luồng làm bài, là subsystem riêng.

**Architecture:** Thêm `quizService` (GV dùng — CRUD câu hỏi/chủ đề) và `examService` (học sinh dùng — nộp bài, GV xem kết quả). Nối vào `QuizBank.tsx` và phần hiển thị bảng điểm thi trong đó, cùng `StudentPortal.tsx` (phần học sinh làm bài trắc nghiệm).

**Tech Stack:** Giữ nguyên stack đã dùng ở 2A/2B.

**Spec:** `docs/superpowers/specs/2026-11-14-qllh-rebuild-design.md`.

## Global Constraints

- `quizService` (phía giáo viên) thao tác thẳng bảng `quiz_questions` (có `correct_index`) vì RLS Giai đoạn 1 cho phép GV đọc/ghi bảng gốc.
- `examService` (phía học sinh) **chỉ được đọc** qua `quiz_questions_public` — không được import hay gọi bất kỳ hàm nào chạm bảng `quiz_questions` gốc, đúng như RLS đã chặn ở Giai đoạn 1 Task 7 (nếu lỡ gọi sai, Supabase trả về rỗng chứ không lỗi rõ ràng — nên cần tự kiểm tra bằng test, không dựa vào lỗi runtime để phát hiện).
- Chưa đổi cơ chế xáo trộn câu hỏi ở plan này — `quiz_sessions.question_order` tạm thời lưu thứ tự gốc (không xáo), việc xáo trộn thật sự nằm ở Giai đoạn 3B.

## Review Focus

- GV xóa 1 câu hỏi đang được dùng trong 1 `quiz_sessions` cũ (học sinh đã thi xong) → không được làm hỏng/mất `quiz_results` đã có của phiên đó (vì `quiz_sessions.topic_ids` không phụ thuộc trực tiếp vào từng câu hỏi — cần đảm bảo `quiz_results` không có FK cứng tới `quiz_questions`, đã đúng theo schema Giai đoạn 1).
- Học sinh nộp bài 2 lần cho cùng 1 phiên thi (double-click nút Nộp) → không được tạo 2 `quiz_results` cho cùng `session_id`.
- Đếm số câu hỏi hiển thị trên UI ("Ngân hàng câu hỏi (13)") phải lấy từ `count(*)` thật của `quiz_questions`, không phải số đếm tay/cứng.
- GV import nhiều câu hỏi cùng chủ đề (chưa active) → học sinh không được thấy chủ đề đó khi thi (dựa vào `quiz_topics.is_active`, RLS Giai đoạn 1 Task 7 đã lọc theo `is_active = true`), kiểm tra lại đúng hành vi này không bị phá khi đổi code.
- Thời gian làm bài (`duration_seconds`) tính sai (âm hoặc quá lớn bất thường) không được lưu — ví dụ đồng hồ máy học sinh bị lệch.

---

### Task 1: `quizService` (phía giáo viên)

**Files:**
- Create: `src/services/quizService.ts`
- Test: `src/services/__tests__/quizService.test.ts`

**Interfaces:**
- Consumes: `supabase`; bảng `quiz_topics`, `quiz_questions`.
- Produces:
  - `listTopics(): Promise<Array<{ id: string; grade: number; name: string; isActive: boolean; questionCount: number }>>`
  - `createTopic(grade: number, name: string): Promise<string>` (trả `id`)
  - `setTopicActive(topicId: string, isActive: boolean): Promise<void>`
  - `listQuestionsByTopic(topicId: string): Promise<QuizQuestion[]>` (dùng type `QuizQuestion` có sẵn ở `src/types/index.ts`, map `correct_index → correctIndex`)
  - `createQuestion(input: Omit<QuizQuestion, 'id'>): Promise<string>`
  - `deleteQuestion(id: string): Promise<void>`

- [x] **Step 1: Viết test "đếm câu hỏi đúng thật" (Review Focus #3)**
  ```ts
  test('listTopics tra ve questionCount dung so cau that su co', async () => {
    const topics = await listTopics();
    const found = topics.find(t => t.id === seededTopicId);
    expect(found?.questionCount).toBe(3); // seed co san 3 cau cho topic nay
  });
  ```

- [x] **Step 2: Chạy test, xác nhận fail**
  Expected: FAIL vì `quizService` chưa tồn tại.

- [x] **Step 3: Implement**
  `listTopics`: `select *, quiz_questions(count)` (Supabase hỗ trợ đếm quan hệ lồng `quiz_questions(count)`) hoặc 2 query riêng rồi gộp bằng `Map`. Các hàm còn lại thao tác thẳng theo `id`.

- [x] **Step 4: Chạy lại test**
  Expected: PASS.

- [x] **Step 5: Commit**
  ```bash
  git add src/services/quizService.ts src/services/__tests__/quizService.test.ts
  git commit -m "feat: add quizService for teacher question bank management"
  ```

---

### Task 2: `examService` (phía học sinh)

**Files:**
- Create: `src/services/examService.ts`
- Test: `src/services/__tests__/examService.test.ts`

**Interfaces:**
- Consumes: `supabase`; bảng `quiz_questions_public`, `quiz_sessions`, `quiz_results`.
- Produces:
  - `listActiveTopics(grade: number): Promise<Array<{ id: string; name: string }>>` (chỉ `is_active = true`)
  - `startExamSession(studentName: string, classId: string | null, isFreeSlot: boolean, topicIds: string[]): Promise<{ sessionId: string; questions: Array<{ id: string; content: string; options: string[]; imageUrl?: string }> }>`
  - `submitExamResult(sessionId: string, correctCount: number, totalQuestions: number, durationSeconds: number): Promise<void>`

- [x] **Step 1: Viết test "nộp bài 2 lần không tạo 2 kết quả" (Review Focus #2)**
  ```ts
  test('submitExamResult lan 2 khong tao them dong moi', async () => {
    await submitExamResult(sessionId, 8, 10, 120);
    await submitExamResult(sessionId, 8, 10, 120); // double-click gia lap
    const { count } = await supabase.from('quiz_results').select('*', { count: 'exact', head: true }).eq('session_id', sessionId);
    expect(count).toBe(1);
  });
  ```

- [x] **Step 2: Chạy test, xác nhận fail**
  Expected: FAIL vì `examService` chưa tồn tại (và bảng `quiz_results` ở Giai đoạn 1 chưa có cách chặn trùng `session_id` — cần bổ sung unique).

- [x] **Step 3: Bổ sung unique constraint còn thiếu + implement**
  Thêm vào migration mới `supabase/migrations/0009_quiz_results_unique_session.sql`:
  ```sql
  alter table public.quiz_results add constraint quiz_results_session_unique unique (session_id);
  ```
  Chạy `npx supabase db push --remote`. `submitExamResult`: dùng `upsert(..., { onConflict: 'session_id' })` thay vì `insert` thuần, để lần nộp thứ 2 **ghi đè** lần 1 (không lỗi, không tạo dòng mới) — chọn ghi đè vì double-click là lỗi UI tạm thời, không phải học sinh cố tình nộp 2 lần khác nhau. `startExamSession`: query `quiz_questions_public` theo `topic_ids`, tạo `quiz_sessions` với `question_order` lưu đúng thứ tự trả về (chưa xáo trộn — ghi chú rõ trong code `// TODO Giai đoạn 3B: xáo trộn câu hỏi/đáp án tại đây`). Validate `durationSeconds > 0` trước khi lưu (Review Focus #5), nếu âm/bất thường thì `throw`.

- [x] **Step 4: Chạy lại test**
  Expected: PASS.

- [x] **Step 5: Commit**
  ```bash
  git add supabase/migrations/0009_quiz_results_unique_session.sql src/services/examService.ts src/services/__tests__/examService.test.ts
  git commit -m "feat: add examService and prevent duplicate quiz submissions"
  ```

---

### Task 3: Nối `QuizBank.tsx` vào `quizService` + bảng điểm thi

**Files:**
- Modify: `src/components/QuizBank.tsx`

**Interfaces:**
- Consumes: `quizService` từ Task 1; `examService.listActiveTopics`-tương đương cho phần xem kết quả (GV xem `quiz_results` join `quiz_sessions` — thêm hàm `quizService.listExamResults(classId?: string): Promise<QuizSubmission[]>` nếu `QuizBank.tsx` có màn hình này, dùng type `QuizSubmission` có sẵn).

- [ ] **Step 1: Đọc file, tìm mọi chỗ đọc/ghi `localStorage.qllh_quiz_bank` và `qllh_quiz_submissions`, cùng lời gọi `syncQuizSubmissionToFirestore` (từ `firebase.ts`)**

- [ ] **Step 2: Thay bằng `quizService`/`examService`**
  CRUD câu hỏi/chủ đề → `quizService`. Hiển thị bảng điểm học sinh thi (STT, họ tên, lớp, khối, điểm số, số câu đúng, xếp loại, thời gian, ngày nộp) → thêm `quizService.listExamResults` đọc `quiz_results` join `quiz_sessions`, giữ nguyên UI đã có.

- [ ] **Step 3: Kiểm tra thủ công**
  `npm run dev`: thêm câu hỏi mới, xóa câu hỏi, bật/tắt chủ đề, xem số đếm "(n câu)" tự cập nhật đúng.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/QuizBank.tsx
  git commit -m "feat: wire QuizBank UI to quizService/examService"
  ```

---

### Task 4: Nối phần làm bài của `StudentPortal.tsx` vào `examService`

**Files:**
- Modify: `src/components/StudentPortal.tsx`

**Interfaces:**
- Consumes: `examService` từ Task 2.

- [ ] **Step 1: Đọc file, tìm đoạn chọn khối/chủ đề, bắt đầu làm bài, nộp bài**

- [ ] **Step 2: Thay bằng `examService`**
  Chọn chủ đề → `listActiveTopics`. Bắt đầu làm bài → `startExamSession`. Nộp bài → `submitExamResult`.

- [ ] **Step 3: Kiểm tra thủ công**
  Mở 1 tab ẩn danh (giả lập học sinh), vào bằng mã phòng, chọn chủ đề, làm bài, nộp — xem GV có thấy kết quả mới trong `QuizBank.tsx` không.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/StudentPortal.tsx
  git commit -m "feat: wire student exam flow to examService"
  ```

---

## Self-Review (đã thực hiện)

1. **Spec coverage:** Ngân hàng câu hỏi, chủ đề, làm bài, nộp bài, xem kết quả — đều có task. Ảnh/import/xáo trộn/bật-tắt-chủ-đề-động cố tình để lại Giai đoạn 3B, ghi rõ ở Goal.
2. **Step scan:** mỗi step ra đúng 1 việc; Task 3/4 Step 1 là đọc file trước khi sửa, không đoán.
3. **Type consistency:** `QuizQuestion`/`QuizSubmission` tái dùng nguyên `src/types/index.ts` đã có, không định nghĩa lại kiểu trùng tên khác nghĩa.
4. **Review Focus:** xóa câu hỏi không vỡ kết quả cũ → do thiết kế schema Giai đoạn 1 đã tách rời (không cần task riêng, chỉ cảnh báo trong Global Constraints); nộp trùng → Task 2; đếm đúng → Task 1; lọc chủ đề active → đã có RLS, Task 2 chỉ cần không phá; thời gian bất thường → Task 2 Step 3.
5. **Proportion:** 4 task, lượng code tương ứng 2 service + 2 lần nối UI, không phình to.
