# QLLH — Giai đoạn 3A: Mở rộng Báo cáo & Bảng điểm (tính năng mới theo docx)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm vào `ReportsSection.tsx` (đã chạy trên `scoresService`/`attendanceService` từ Giai đoạn 2B): ô tìm kiếm + bộ lọc, 2 biểu đồ (xếp loại, phổ điểm & chuyên cần), nút lọc nhanh, banner cảnh báo, cột Chuyên cần + Hành động, popup hồ sơ nhanh, 2 kiểu xuất Excel chuẩn — đúng yêu cầu trong `báo cáo.doc` mục "Báo cáo"/"Xuất Excel".

**Architecture:** Thêm 1 hàm thống kê ở `scoresService`/`attendanceService` (tính % xếp loại, phổ điểm) chạy bằng SQL aggregate (nhanh hơn tính tay ở FE với 46+ học sinh); 2 thư viện mới cho UI: biểu đồ (Recharts) và xuất Excel (`exceljs`, thay cho `xlsx` hiện có vì `exceljs` hỗ trợ style/border/font tốt hơn cho yêu cầu "định dạng chuẩn in ấn").

**Tech Stack:** Thêm `recharts`, `exceljs`.

**Spec:** `docs/superpowers/specs/2026-11-14-qllh-rebuild-design.md`; yêu cầu gốc: mục "Báo cáo" trong `báo cáo.doc` (đã trích xuất và liệt kê trong design doc mục Goals #5).

## Global Constraints

- Không tính toán xếp loại/thống kê 2 nơi khác nhau cho ra 2 kết quả — mọi con số % xếp loại, trung bình điểm phải tính từ đúng cột `scores.classification`/`total_score` đã có, không viết công thức riêng ở FE.
- Giữ nguyên toàn bộ tính năng cũ của `ReportsSection.tsx` (đã migrate ở Giai đoạn 2B) — đây là plan **thêm vào**, không được xóa/đổi hành vi cũ.
- File Excel xuất ra phải mở được bằng Microsoft Word/Excel thật (không chỉ test bằng code) — có bước kiểm tra mở file thật trong plan.

## Review Focus

- Lớp có 0 học sinh (lớp mới tạo) → biểu đồ và banner cảnh báo không được crash (chia cho 0 khi tính %).
- Học sinh có điểm `null` (chưa chấm) → phải rơi đúng vào nhóm "Chưa có điểm" trong biểu đồ xếp loại, không bị tính nhầm vào nhóm "C".
- Banner cảnh báo khi KHÔNG có học sinh nào thuộc diện cảnh báo → phải ẩn hẳn (đúng yêu cầu "mặc định ẩn, chỉ hiện khi có ít nhất 1 em"), không hiện dòng trống.
- Xuất Excel với tên học sinh/nhận xét chứa ký tự đặc biệt hoặc rất dài → cột phải tự giãn rộng (auto-fit), không bị cắt chữ hoặc vỡ layout.
- Top 5 xuất sắc khi có nhiều học sinh trùng điểm ở vị trí thứ 5 → phải ưu tiên chuyên cần tốt hơn (ít buổi vắng hơn) như đã ghi trong yêu cầu gốc, không chỉ lấy ngẫu nhiên 5 em đầu tiên theo thứ tự mảng.

---

### Task 1: Hàm thống kê trong `scoresService`

**Files:**
- Modify: `src/services/scoresService.ts`
- Test: `src/services/__tests__/scoresService.test.ts`

**Interfaces:**
- Produces: `getClassStats(classId: string, semester: 'hk1'|'ca_nam'): Promise<{ classificationCounts: { T: number; H: number; C: number; none: number }; scoreBuckets: { '9-10': number; '7-8': number; '5-6': number; 'duoi-5': number }; absenceBuckets: Record<string, number> }>`

- [x] **Step 1: Viết test "lớp 0 học sinh không crash" (Review Focus #1)**
  ```ts
  test('getClassStats tra ve so 0 het khi lop chua co hoc sinh', async () => {
    const stats = await getClassStats(emptyClassId, 'hk1');
    expect(stats.classificationCounts).toEqual({ T: 0, H: 0, C: 0, none: 0 });
  });
  ```

- [x] **Step 2: Viết test "diem null roi vao nhom Chua co diem" (Review Focus #2)**
  ```ts
  test('getClassStats tinh hoc sinh chua cham diem vao nhom none', async () => {
    const stats = await getClassStats(classIdCoHocSinhChuaCham, 'hk1');
    expect(stats.classificationCounts.none).toBeGreaterThan(0);
  });
  ```

- [x] **Step 3: Chạy 2 test, xác nhận fail**
  Expected: FAIL vì `getClassStats` chưa tồn tại.

- [x] **Step 4: Implement**
  Query `select classification, total_score from scores join students on ... where students.class_id = classId and semester = semester`; đếm bằng JS (`reduce`) — `classification is null` hoặc không có dòng `scores` nào cho học sinh đó → tính vào `none`. `scoreBuckets` chia theo `total_score`: `>=9` → `'9-10'`, `>=7` → `'7-8'`, `>=5` → `'5-6'`, còn lại (và không null) → `'duoi-5'`; `null` không tính vào bucket nào. `absenceBuckets` đếm từ bảng `attendance` (số buổi `unexcused` mỗi học sinh, nhóm theo mốc 0/1-2/>2 buổi — giữ đúng mốc ">2 buổi" đã nêu trong yêu cầu gốc).

- [x] **Step 5: Chạy lại 2 test**
  Expected: PASS.

- [x] **Step 6: Commit**
  ```bash
  git add src/services/scoresService.ts src/services/__tests__/scoresService.test.ts
  git commit -m "feat: add class statistics for reports charts"
  ```

---

### Task 2: Biểu đồ + bộ lọc + banner cảnh báo trong `ReportsSection.tsx`

**Files:**
- Modify: `src/components/ReportsSection.tsx`
- Create: `src/components/reports/ClassificationPieChart.tsx`
- Create: `src/components/reports/ScoreAttendanceBarChart.tsx`
- Create: `src/components/reports/WarningBanner.tsx`

**Interfaces:**
- Consumes: `scoresService.getClassStats` (Task 1).
- Produces: `<ClassificationPieChart data={classificationCounts} />`, `<ScoreAttendanceBarChart scoreBuckets={...} absenceBuckets={...} />`, `<WarningBanner missingScoreCount={number} needsAttentionCount={number} />` (banner tự ẩn khi cả 2 số = 0 — Review Focus #3).

- [x] **Step 1: Cài thư viện**
  Chạy: `npm install recharts`.

- [x] **Step 2: Viết `ClassificationPieChart.tsx`**
  Dùng `PieChart` của `recharts`, 4 phần (T xanh lá, H xanh dương/tím, C cam, "Chưa có điểm" xám) đúng màu đã ghi trong yêu cầu gốc.

- [x] **Step 3: Viết `ScoreAttendanceBarChart.tsx`**
  Dùng `BarChart`, trục X 5 mốc (9-10, 7-8, 5-6, dưới 5, số buổi vắng), trục Y số lượng học sinh.

- [x] **Step 4: Viết `WarningBanner.tsx`**
  Props `missingScoreCount`/`needsAttentionCount`; `return null` nếu cả 2 bằng 0 (Review Focus #3); nội dung text động đúng mẫu "Phát hiện {n} học sinh chưa có điểm và {m} học sinh cần lưu ý về chuyên cần."

- [x] **Step 5: Nối vào `ReportsSection.tsx`**
  Thêm ô tìm kiếm học sinh (debounce ~300ms theo đúng yêu cầu gốc), 4 nút lọc nhanh (Tất cả / Chưa có điểm / Cần lưu ý / Top 5 xuất sắc — logic Top 5 xử lý tie-break theo chuyên cần, Review Focus #5), gọi `getClassStats` hiển thị 2 biểu đồ + banner phía trên bảng điểm hiện có.

- [x] **Step 6: Kiểm tra thủ công**
  `npm run dev`: thử lọc, tìm kiếm, xem biểu đồ đổi theo lớp/học kỳ đang chọn, thử với 1 lớp có 0 học sinh và 1 lớp có học sinh chưa chấm điểm (Review Focus #1, #2).

- [x] **Step 7: Commit**
  ```bash
  git add package.json package-lock.json src/components/ReportsSection.tsx src/components/reports/
  git commit -m "feat: add charts, quick filters and warning banner to reports"
  ```

---

### Task 3: Cột Chuyên cần + Hành động + Popup hồ sơ nhanh

**Files:**
- Modify: `src/components/ReportsSection.tsx`
- Create: `src/components/reports/StudentQuickProfilePopup.tsx`

**Interfaces:**
- Consumes: `attendanceService` (đếm buổi vắng theo học sinh, Giai đoạn 2B); `scoresService`.
- Produces: `<StudentQuickProfilePopup studentId={string} onViewDetail={() => void} onClose={() => void} />`.

- [x] **Step 1: Thêm cột Chuyên cần vào bảng điểm**
  Hiển thị dạng "X vắng có phép / Y vắng không phép" (đếm từ `attendance` theo học sinh); highlight nền cam/đỏ nhạt nếu `Y > 0`.

- [x] **Step 2: Thêm cột Hành động (xem/sửa/xóa)**
  Nút sửa mở modal nhập nhanh điểm/nhận xét (tái dùng form đã có, không viết modal mới từ đầu nếu `ClassroomManager.tsx` đã có sẵn dạng tương tự); nút xóa hiện `confirm()` trước khi xóa thật (đúng yêu cầu gốc).

- [x] **Step 3: Viết `StudentQuickProfilePopup.tsx`**
  Hiện khi hover/click tên học sinh (delay ~200-300ms nếu hover, theo đúng yêu cầu gốc): avatar, tên, sparkline điểm các tuần (dùng `recharts` `LineChart` thu nhỏ, không trục/lưới), dòng nhận xét mới nhất, trạng thái chuyên cần, nút "Xem chi tiết". Click ra ngoài vùng popup tự đóng.

- [x] **Step 4: Kiểm tra thủ công (Review Focus #4 áp dụng gián tiếp qua Task 4, ở đây chỉ kiểm tra popup hoạt động đúng)**
  Hover/click vài học sinh có và không có nhận xét, xem popup hiện đúng dữ liệu, không bị lag/nháy liên tục.

- [x] **Step 5: Commit**
  ```bash
  git add src/components/ReportsSection.tsx src/components/reports/StudentQuickProfilePopup.tsx
  git commit -m "feat: add attendance column, row actions and quick profile popup"
  ```

---

### Task 4: 2 kiểu xuất Excel chuẩn

**Files:**
- Create: `src/services/excelExportService.ts`
- Test: `src/services/__tests__/excelExportService.test.ts`

**Interfaces:**
- Produces:
  - `exportFinalReportExcel(classInfo: { schoolName: string; className: string; semester: string; schoolYear: string; subject: string; teacherName: string }, students: Array<{ stt: number; studentCode: string; fullName: string; theoryScore: number|null; practiceScore: number|null; totalScore: number|null; classification: string|null; absenceExcused: number; absenceUnexcused: number }>): Promise<Blob>`
  - `exportWeeklyCommentsExcel(students: Array<{ studentCode: string; fullName: string; weeklyComments: Record<number, string> }>): Promise<Blob>` (35 cột tuần)

- [ ] **Step 1: Cài thư viện**
  Chạy: `npm install exceljs`.

- [ ] **Step 2: Viết test "ten dai khong vo layout" (Review Focus #4 — kiểm tra ở mức dữ liệu, không kiểm tra pixel)**
  ```ts
  test('exportFinalReportExcel khong nem loi voi ten rat dai', async () => {
    const blob = await exportFinalReportExcel(classInfo, [{ ...mockStudent, fullName: 'Nguyễn Thị Rất Là Dài Tên Ví Dụ Để Kiểm Tra Auto Fit Cột' }]);
    expect(blob.size).toBeGreaterThan(0);
  });
  ```

- [ ] **Step 3: Chạy test, xác nhận fail**
  Expected: FAIL vì `excelExportService` chưa tồn tại.

- [ ] **Step 4: Implement `exportFinalReportExcel`**
  Dùng `exceljs`: header (tên trường, lớp, học kỳ, năm học, môn, GV), cột STT/Mã HS/Họ tên (sort alpha B)/Lý thuyết/Thực hành/Tổng/Xếp loại/Chuyên cần, footer thống kê số lượng + % mỗi loại T/H/C (dùng lại công thức ở Task 1, không tính lại). Font Times New Roman cỡ 13, `worksheet.columns.forEach(c => c.width = ...)` tính theo độ dài chuỗi dài nhất trong cột (auto-fit thủ công vì exceljs không tự auto-fit), border `thin` toàn bảng, header bold.

- [ ] **Step 5: Implement `exportWeeklyCommentsExcel`**
  Cột cố định (Mã HS, Họ tên) + 35 cột tuần (đúng số tuần trong 1 năm học theo thiết kế hiện tại), mỗi ô là nhận xét tuần đó; định dạng tương tự Task 4 Step 4.

- [ ] **Step 6: Chạy lại test**
  Expected: PASS.

- [ ] **Step 7: Nối 2 nút "Xuất Excel" trong `ReportsSection.tsx` vào 2 hàm trên**
  Thay nút xuất Excel cũ (dùng `xlsx`) bằng gọi `excelExportService`, tạo link tải `Blob` xuống (dùng pattern tương tự `exportFullBackupFile` cũ đã thấy ở `dbStorage.ts`, nhưng tạo `Blob` thật từ `exceljs` thay vì chuỗi JSON).

- [ ] **Step 8: Kiểm tra thủ công bằng cách mở file thật**
  Xuất 1 file, mở bằng Microsoft Word/Excel hoặc LibreOffice thật trên máy — xác nhận có border, bold header, font đúng, cột không bị cắt chữ tên dài (đúng Review Focus #4, kiểm tra bằng mắt vì layout không test tự động được chính xác 100%).

- [ ] **Step 9: Commit**
  ```bash
  git add package.json package-lock.json src/services/excelExportService.ts src/services/__tests__/excelExportService.test.ts src/components/ReportsSection.tsx
  git commit -m "feat: add standardized Excel export for final report and weekly comments"
  ```

---

## Self-Review (đã thực hiện)

1. **Spec coverage:** Mọi mục trong docx phần "Báo cáo" (bộ lọc, 2 biểu đồ, lọc nhanh, banner, cột mới, popup, 2 kiểu Excel) đều có task — Task 1 (thống kê), Task 2 (biểu đồ/lọc/banner), Task 3 (cột/popup), Task 4 (Excel).
2. **Step scan:** mỗi step ra đúng 1 việc; không có "xử lý style cho đẹp" mơ hồ — Task 4 ghi rõ font/cỡ/border cụ thể lấy từ docx gốc.
3. **Type consistency:** tham số `classId`/`semester` nhất quán với Giai đoạn 2B; `classification` kiểu `'T'|'H'|'C'|null` dùng xuyên suốt Task 1, 2, 4.
4. **Review Focus:** lớp rỗng & điểm null → Task 1; banner ẩn khi không có cảnh báo → Task 2; Excel tên dài không vỡ → Task 4; Top 5 tie-break chuyên cần → Task 2 Step 5.
5. **Proportion:** 4 task, có thêm 2 thư viện mới (recharts, exceljs) — hợp lý vì đây là phần việc nhiều nhất trong toàn bộ docx (đã xác định ở các lượt trao đổi trước là "bảng điểm/báo cáo cần làm nhiều nhất").
