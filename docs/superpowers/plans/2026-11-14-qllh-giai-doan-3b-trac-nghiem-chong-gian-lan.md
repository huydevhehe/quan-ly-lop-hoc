# QLLH — Giai đoạn 3B: Trắc nghiệm nâng cao — Ảnh, Import Excel, Chống gian lận

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm vào `quizService`/`examService` (đã có từ Giai đoạn 2C): chèn/sửa ảnh minh họa câu hỏi (Supabase Storage), nhập câu hỏi hàng loạt từ Excel, **xáo trộn câu hỏi/đáp án khi học sinh thi xử lý thật ở server** (sửa đúng chỗ đã đánh dấu TODO ở Giai đoạn 2C), và màn hình bật/tắt chủ đề cho học sinh thi.

**Architecture:** Việc xáo trộn + ẩn đáp án đúng **phải chuyển hẳn qua 1 Edge Function mới** (`start-exam-session`) thay vì làm trong `examService.ts` phía client như tạm thời ở Giai đoạn 2C — vì code chạy trên trình duyệt luôn có thể bị đọc (F12), nên **bất kỳ logic nào cần giữ bí mật đáp án đúng đều không được chạy ở client dưới bất kỳ hình thức nào**, kể cả khi đã xáo trộn.

**Tech Stack:** Supabase Storage (ảnh), Supabase Edge Functions (Deno), thư viện đọc Excel đã có sẵn trong project (`xlsx`, dùng ở FE để đọc file trước khi gửi lên, không cần đổi thư viện).

**Spec:** `docs/superpowers/specs/2026-11-14-qllh-rebuild-design.md`; yêu cầu gốc: mục "Trắc nghiệm" trong `báo cáo.doc`.

## Global Constraints

- **Không bao giờ** trả `correct_index` (hay bất kỳ thông tin suy ra được đáp án đúng) từ Edge Function `start-exam-session` về client — kể cả trong log, kể cả trong response lỗi.
- Giới hạn file ảnh: chỉ JPG/PNG, tối đa 2MB — kiểm tra ở cả FE (trước khi upload, trải nghiệm nhanh) **và** ở Edge Function/Storage policy (an toàn thật, vì FE check có thể bị bỏ qua).
- Import Excel phải validate đủ 4 đáp án + có chính xác 1 đáp án đúng hợp lệ (A/B/C/D) cho mỗi dòng trước khi ghi — dòng nào sai thì báo rõ số dòng lỗi, không âm thầm bỏ qua hay crash giữa chừng làm nhập dở dang.

## Review Focus

- Học sinh mở DevTools xem Network response của `start-exam-session` → tuyệt đối không thấy được field nào chứa đáp án đúng, kể cả gián tiếp (ví dụ thứ tự mảng options không được giữ nguyên thứ tự gốc có thể đoán ra).
- 2 học sinh cùng thi 1 lúc, cùng chọn chung 1 bộ chủ đề → câu hỏi/đáp án của 2 em phải được xáo trộn **độc lập** (khác thứ tự nhau), không dùng chung 1 seed ngẫu nhiên.
- Upload ảnh 5MB hoặc định dạng `.gif` → bị chặn, có thông báo lỗi rõ ràng, không crash trắng màn hình.
- File Excel import có 1 dòng thiếu đáp án D → toàn bộ import phải dừng lại báo lỗi đúng dòng đó, **không được** nhập 9 dòng đúng rồi bỏ qua dòng sai (import phải all-or-nothing, tránh ngân hàng câu hỏi bị thiếu nửa chừng khó phát hiện).
- Tắt 1 chủ đề đang có học sinh **đang** làm bài dở (phiên đã bắt đầu trước khi tắt) → phiên đang làm dở không bị huỷ giữa chừng (chỉ chặn chủ đề đó cho phiên *mới*, không hồi tố phiên cũ).

---

### Task 1: Storage + upload ảnh câu hỏi

**Files:**
- Create: `supabase/migrations/0011_quiz_questions_image_storage_policy.sql`
- Create: `src/services/quizImageService.ts`
- Test: `src/services/__tests__/quizImageService.test.ts`

**Interfaces:**
- Produces: `uploadQuestionImage(file: File): Promise<{ url: string } | { error: string }>` — validate `file.type` chỉ `image/jpeg`/`image/png`, `file.size <= 2 * 1024 * 1024` trước khi gọi Storage.

- [x] **Step 1: Viết migration tạo bucket + policy**
  ```sql
  insert into storage.buckets (id, name, public) values ('quiz-images', 'quiz-images', true)
    on conflict (id) do nothing;

  create policy "quiz_images_teacher_upload" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'quiz-images');

  create policy "quiz_images_public_read" on storage.objects
    for select to public
    using (bucket_id = 'quiz-images');
  ```
  Chạy `npx supabase db push --remote`.

- [x] **Step 2: Viết test "file qua 2MB bi chan" (Review Focus #3)**
  ```ts
  test('uploadQuestionImage tra loi khi file qua 2MB', async () => {
    const bigFile = new File([new Uint8Array(3 * 1024 * 1024)], 'anh.png', { type: 'image/png' });
    const result = await uploadQuestionImage(bigFile);
    expect('error' in result).toBe(true);
  });
  ```

- [x] **Step 3: Chạy test, xác nhận fail rồi implement**
  Validate type/size trước, nếu sai trả `{ error: '...' }` ngay, không gọi Storage. Nếu hợp lệ, gọi `supabase.storage.from('quiz-images').upload(\`${crypto.randomUUID()}.${ext}\`, file)`, lấy `getPublicUrl`.

- [x] **Step 4: Chạy lại test**
  Expected: PASS.

- [x] **Step 5: Commit**
  ```bash
  git add supabase/migrations/0011_quiz_questions_image_storage_policy.sql src/services/quizImageService.ts src/services/__tests__/quizImageService.test.ts
  git commit -m "feat: add quiz question image upload via Supabase Storage"
  ```

---

### Task 2: Import câu hỏi hàng loạt từ Excel

**Files:**
- Modify: `src/services/quizService.ts`
- Test: `src/services/__tests__/quizService.test.ts`

**Interfaces:**
- Produces: `parseQuestionsExcelFile(file: File): Promise<{ rows: Array<{ content: string; options: string[]; correctIndex: number }> } | { error: string; lineNumber?: number }>`, `bulkInsertQuestions(topicId: string, rows: Array<{ content: string; options: string[]; correctIndex: number }>): Promise<void>` (all-or-nothing — dùng 1 lệnh `insert` nhiều dòng, không loop từng `insert` riêng để tránh nhập dở dang nếu giữa chừng lỗi mạng).

- [ ] **Step 1: Viết test "thieu 1 dap an bao loi dung dong" (Review Focus #4)**
  ```ts
  test('parseQuestionsExcelFile bao loi dung so dong khi thieu dap an D', async () => {
    const file = buildMockExcelFile([
      { cauHoi: 'Cau 1', A: 'a', B: 'b', C: 'c', D: 'd', dapAnDung: 'A' },
      { cauHoi: 'Cau 2', A: 'a', B: 'b', C: 'c', D: '', dapAnDung: 'B' }, // thieu D
    ]);
    const result = await parseQuestionsExcelFile(file);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.lineNumber).toBe(2);
  });
  ```

- [ ] **Step 2: Chạy test, xác nhận fail rồi implement**
  Dùng `xlsx` (đã có trong `dependencies`) đọc file thành mảng dòng, validate từng dòng: đủ 4 đáp án không rỗng, `dapAnDung` thuộc `['A','B','C','D']`; dòng nào sai → trả `{ error, lineNumber }` ngay (dừng ở dòng lỗi đầu tiên tìm thấy, không parse tiếp). Nếu toàn bộ hợp lệ, map `dapAnDung` sang `correctIndex` (0-3), trả `{ rows }`.

- [ ] **Step 3: Viết template file mẫu**
  Thêm hàm `generateSampleExcelTemplate(): Blob` tạo sẵn file mẫu đúng 6 cột đã ghi trong yêu cầu gốc (Câu hỏi, Đáp án A-D, Đáp án đúng — cột cuối dùng Data Validation dropdown A/B/C/D nếu `exceljs`/`xlsx` hỗ trợ, nếu không hỗ trợ dropdown thì ghi chú rõ trong code và chỉ để text thường, không block task vì đây là phần "nên có" chứ không phải điều kiện chặn).

- [ ] **Step 4: Chạy lại test, nối nút "Tải file mẫu"/"Nhập file Excel" trong `QuizBank.tsx`**

- [ ] **Step 5: Commit**
  ```bash
  git add src/services/quizService.ts src/services/__tests__/quizService.test.ts src/components/QuizBank.tsx
  git commit -m "feat: add bulk Excel import for quiz questions"
  ```

---

### Task 3: Edge Function `start-exam-session` — xáo trộn & giấu đáp án thật

**Files:**
- Create: `supabase/functions/start-exam-session/index.ts`
- Create: `supabase/functions/submit-exam-session/index.ts`
- Modify: `src/services/examService.ts`

**Interfaces:**
- Edge Function `start-exam-session` nhận `{ studentName, classId, isFreeSlot, topicIds }`, trả `{ sessionId: string; questions: Array<{ id: string; content: string; options: string[]; imageUrl?: string }> }` (KHÔNG có `correctIndex` ở bất kỳ đâu trong response).
- Edge Function `submit-exam-session` nhận `{ sessionId, answers: Array<{ questionId: string; selectedOptionIndex: number }>, durationSeconds }`, tự chấm điểm phía server (so với đáp án gốc lưu riêng, không gửi qua lại client), trả `{ score, correctCount, totalQuestions }`.

- [ ] **Step 1: Viết `start-exam-session`**
  Query `quiz_questions` (bảng gốc, Edge Function chạy với quyền `service_role` nên đọc được `correct_index`) theo `topic_ids`. Với mỗi câu: xáo trộn mảng 4 đáp án bằng thuật toán Fisher-Yates dùng `crypto.getRandomValues` (không dùng `Math.random`, để đảm bảo ngẫu nhiên tốt + độc lập giữa các lần gọi, đúng Review Focus #2), ghi nhớ **map vị trí mới → đúng/sai** riêng ở server. Xáo trộn luôn thứ tự các câu hỏi. Lưu `quiz_sessions` với `question_order` chứa đủ thông tin để chấm lại sau (thứ tự câu, map đáp án đã xáo trộn → index gốc) — cột này chỉ server đọc, không trả về client. Trả về client: chỉ `id, content, options (đã xáo trộn), image_url` — dùng `pick` rõ ràng từng field, không `return {...question}` tràn lan (tránh lỡ tay trả thêm field nhạy cảm, đúng Review Focus #1).

- [ ] **Step 2: Viết `submit-exam-session`**
  Đọc lại `quiz_sessions.question_order` theo `sessionId`, đối chiếu `answers` client gửi lên với map đã lưu để tính `correctCount`/`score`, gọi `submitExamResult`-logic tương tự Giai đoạn 2C (upsert theo `session_id`, Review Focus #2 của Giai đoạn 2C vẫn áp dụng).

- [ ] **Step 3: Deploy**
  Chạy: `npx supabase functions deploy start-exam-session && npx supabase functions deploy submit-exam-session`.

- [ ] **Step 4: Viết test thủ công kiểm tra không lộ đáp án (Review Focus #1)**
  Gọi `start-exam-session` qua `curl`, `grep -i "correct"` toàn bộ response JSON → phải không khớp gì cả.

- [ ] **Step 5: Đổi `examService.ts` sang gọi 2 Edge Function này thay vì tự xử lý ở client**
  Xóa đoạn code tạm thời đánh dấu `// TODO Giai đoạn 3B` ở Giai đoạn 2C; `startExamSession`/`submitExamResult` giờ chỉ là wrapper gọi `supabase.functions.invoke(...)`.

- [ ] **Step 6: Commit**
  ```bash
  git add supabase/functions/start-exam-session supabase/functions/submit-exam-session src/services/examService.ts
  git commit -m "feat: move quiz shuffling and grading to server-side edge functions"
  ```

---

### Task 4: Màn hình bật/tắt chủ đề cho học sinh thi

**Files:**
- Create: `src/components/QuizTopicActivationPanel.tsx`
- Modify: `src/components/QuizBank.tsx`

**Interfaces:**
- Consumes: `quizService.listTopics`, `quizService.setTopicActive`, `quizService.createTopic` (Giai đoạn 2C Task 1, chỉnh thêm nếu thiếu field).

- [ ] **Step 1: Viết `QuizTopicActivationPanel.tsx`**
  Dropdown checklist chủ đề (tick = `is_active = true`), checkbox "Tất cả chủ đề" (tick/bỏ tick toàn bộ cùng lúc — gọi `setTopicActive` cho từng chủ đề, dùng `Promise.all`), click vào tên chủ đề (không vào checkbox) → lọc hiển thị câu hỏi của chủ đề đó bên dưới (tái dùng `quizService.listQuestionsByTopic`). Nút "+ Thêm chủ đề mới": mở ô nhập nhỏ, lưu xong gọi `createTopic` rồi cập nhật state ngay (không cần reload trang — đúng yêu cầu gốc).

- [ ] **Step 2: Kiểm tra Review Focus #5 (tắt chủ đề không hủy phiên đang làm dở)**
  Mở 1 tab học sinh, bắt đầu làm bài (đã gọi `start-exam-session` thành công, câu hỏi đã tải về state của tab đó). Ở tab GV, tắt chủ đề đó. Quay lại tab học sinh, tiếp tục làm bài và nộp → `submit-exam-session` vẫn phải chấm được bình thường (vì nó đọc theo `session_id` đã tạo trước đó, không kiểm tra lại `is_active` tại thời điểm nộp).

- [ ] **Step 3: Nối vào `QuizBank.tsx` (header, nơi có "Ngân hàng câu hỏi (n)", "+ Thêm câu hỏi mới"...)**

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/QuizTopicActivationPanel.tsx src/components/QuizBank.tsx
  git commit -m "feat: add topic activation panel for student exam access"
  ```

---

## Self-Review (đã thực hiện)

1. **Spec coverage:** Ảnh (Task 1), import Excel (Task 2), xáo trộn + chấm điểm server-side (Task 3), bật/tắt chủ đề (Task 4) — đủ 4 mục chính trong docx phần Trắc nghiệm nâng cao.
2. **Step scan:** mỗi step ra đúng 1 việc; Task 3 Step 1 có 1 đoạn giải thuật (Fisher-Yates) vì đây đúng loại "thuật toán mà signature/test không tự quyết định được" — hợp lệ theo quy tắc viết step.
3. **Type consistency:** `topicId`/`questionId`/`sessionId` dùng nhất quán Task 1–4 và khớp với Giai đoạn 2C.
4. **Review Focus:** không lộ đáp án → Task 3 Step 1/4; xáo trộn độc lập mỗi học sinh → Task 3 Step 1 (random per-call, không seed chung); ảnh quá cỡ/sai định dạng → Task 1; import Excel all-or-nothing → Task 2; tắt chủ đề không hồi tố phiên cũ → Task 4 Step 2.
5. **Proportion:** 4 task cho 2 Edge Function mới + Storage + import Excel + 1 UI mới — tỉ lệ hợp lý vì đây là phần kỹ thuật phức tạp nhất của Giai đoạn 3 (phải đảm bảo bảo mật, không thể rút gọn step).
