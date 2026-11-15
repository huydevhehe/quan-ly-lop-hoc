# Hướng Dẫn Dev — Feedback UI/UX từ chủ dự án (QLLH.Pro)

**Ngày tổng hợp**: 16/11/2026
**Kho mã nguồn**: `https://github.com/huydevhehe/quan-ly-lop-hoc`
**Nhánh làm việc**: `dev` → merge `main` khi xong, xài fast-forward only

File này tổng hợp toàn bộ feedback UI/UX của chủ dự án (giáo viên thật, dữ liệu học sinh thật) qua 2 đợt, đã được đối chiếu kỹ với code hiện tại và chốt phương án với chủ dự án cho từng điểm mơ hồ. AI dev sau đọc file này **không cần hỏi lại** các điểm đã chốt — chỉ hỏi nếu phát hiện mâu thuẫn với thực tế code lúc bắt tay làm.

## Quy tắc bắt buộc khi code phần này

1. **Không dùng localStorage/mock data cho bất kỳ dữ liệu ảnh hưởng học tập thật nào** (điểm số, câu hỏi, học sinh, điểm danh...). Luôn nối thẳng Supabase qua các file `src/services/*.ts` đã có sẵn. Đây là lỗi kiến trúc đã lặp lại nhiều lần trong dự án và từng gây ra tình trạng "giao diện tưởng chạy nhưng dữ liệu hoàn toàn giả" — tuyệt đối tránh lặp lại.
2. Trước khi coi 1 việc là xong: chạy sạch `npx tsc --noEmit`, `npx vitest run` (hiện 76/76 pass), `npm run build`.
3. Nếu cần sửa schema Supabase (migration mới / cột mới), viết file trong `supabase/migrations/`, đặt số thứ tự tiếp theo sau file mới nhất hiện có. Việc `npx supabase db push --remote --yes` và `npx supabase functions deploy <tên>` cần chủ dự án tự chạy tay (bị chặn quyền tự động với AI).
4. 2 bug nguy hiểm đã được phát hiện & sửa sẵn trong đợt trước (không cần làm lại, xem commit `fix: Excel import could corrupt question bank across grades...` trên `main`):
   - Import Excel câu hỏi trắc nghiệm có thể lẫn sang khối khác do không bắt buộc chọn khối trước khi nhập — đã vá tạm (bắt buộc chọn khối cụ thể + chỉ nhập vào đúng topic của khối đó).
   - "Lưu link website" ở Học liệu số lưu thành công vào Supabase nhưng không hiển thị ở đâu cả (trông như lỗi) — đã sửa, giờ hiển thị tách biệt với video.
   - Trường "Giải thích lời giải" trong form thêm câu hỏi trắc nghiệm không có cột DB, dữ liệu nhập vào luôn bị mất — đã xóa khỏi UI.

---

## PHẦN A — Năm học & Lớp học

### A1. Overview tất cả năm học đã tạo
- **Hiện trạng**: tạo năm học mới không làm mất năm cũ (dữ liệu an toàn), nhưng không có nơi nào hiển thị TẤT CẢ các năm cùng lúc — mọi nơi (Sidebar, màn "NĂM HỌC HIỆN TẠI") chỉ cho chọn 1 năm qua dropdown.
- **Đã chốt**: mở rộng ngay trong màn "Năm học" hiện tại (`ClassroomManager.tsx`), KHÔNG cần trang/tab riêng.
- **Việc cần làm**: thêm 1 khu vực liệt kê tất cả các năm học đã tạo (gọi `schoolYearsService.listSchoolYears()`), mỗi năm hiện: tên năm, số lớp, tổng số học sinh của năm đó (JOIN/đếm qua `classes`/`students`). Giữ nguyên cấu trúc chọn-1-năm hiện tại, chỉ thêm khu vực tổng quan này.

### A2. Đổi năm học bị tự nhảy vào lớp — **BUG THẬT, cần sửa**
- **Nguyên nhân chính xác**: `ClassroomManager.tsx:538-556`, effect tự đồng bộ `currentClassId` khi đổi năm đang dùng chung kênh với việc người dùng chủ động chọn lớp (`onSelectClassExternal`, nối tới `App.tsx:532`), mà kênh đó luôn ép `setCurrentView('detail')` tại `ClassroomManager.tsx:372-382`. Khi đổi năm, code tự động chọn lớp đầu tiên của năm mới để tránh lỗi "lớp không tồn tại", nhưng vô tình điều hướng thẳng vào màn chi tiết lớp đó thay vì ở lại màn danh sách.
- **Cách sửa**: tách "tự động chọn lớp dự phòng khi lớp cũ không còn tồn tại trong năm mới" ra khỏi luồng "người dùng chủ động chọn lớp". Khi tự động fallback, CHỈ cập nhật `currentClassId` nội bộ, KHÔNG gọi `onSelectClassExternal`/không ép `currentView = 'detail'`. Người dùng đổi năm sẽ ở lại màn danh sách lớp của năm đó.

### A3. Sidebar không thấy năm học mới tạo nếu chưa có lớp nào — **BUG THẬT, cần sửa**
- **Nguyên nhân chính xác**: `Sidebar.tsx:94-124`, `sidebarYears` chỉ được suy ra từ `listMyClasses()` — năm nào có ít nhất 1 lớp mới xuất hiện trong dropdown. Sidebar không bao giờ gọi `schoolYearsService.listSchoolYears()` trực tiếp.
- **Cách sửa**: `Sidebar.tsx` gọi thêm `listSchoolYears()`, hợp nhất (union, loại trùng) với danh sách năm suy ra từ lớp, để năm chưa gán lớp nào vẫn hiện trong dropdown chọn năm.

### A4. Ghi rõ "Khối X" thay vì số trần trong dropdown chọn lớp nhanh
- **Chỉ 1 chỗ cần sửa**: `Sidebar.tsx:326` — hiện render `{c.name} · {c.grade}` ra dạng "1/2 · 1", cần đổi thành dạng "1/2 · Khối 1".
- (`ClassroomManager.tsx` dòng ~1835, dropdown "Chuyển lớp" trong màn chi tiết lớp, **đã đúng** "1/2 (Khối 1)" từ trước — không cần sửa.)

### A5. Dashboard tổng quan Báo cáo + xem chi tiết từng học sinh
- **Hiện trạng**: `ReportsSection.tsx` có sẵn 4 thẻ thống kê (Tổng học sinh / Hoàn thành Tốt (T) / Hoàn thành (H) / Chưa có điểm) nhưng CHỈ tính điểm, không gộp điểm danh hay nhận xét vào dashboard; bảng học sinh là bảng phẳng, bấm vào tên KHÔNG có phản ứng gì.
- **Việc cần làm**: mở rộng dashboard tổng quan khi chọn 1 lớp, gồm đủ: điểm thi tổng/xếp loại, điểm danh (số buổi có mặt/vắng/trễ), tình trạng đã/chưa có nhận xét — trong cùng 1 khu vực overview. Khi bấm vào tên 1 học sinh → mở modal/bảng chi tiết riêng của học sinh đó (điểm từng kỳ, lịch sử điểm danh theo tuần, các nhận xét tuần đã ghi).

### A6. Giao diện lưới lớp học — mỗi khối 1 màu riêng
- **Hiện trạng**: `ClassroomManager.tsx:1708`, lưới thẻ lớp dùng đồng nhất 1 màu xanh (`bg-[#0070f3]`) cho mọi thẻ "Mở lớp" bất kể khối.
- **Việc cần làm**: redesign theo ảnh mẫu người dùng gửi (xem ảnh đính kèm trong hội thoại gốc nếu cần) — mỗi khối (1-5) có 1 tông màu riêng dễ phân biệt bằng mắt; mỗi card hiển thị đủ: tên lớp (vd "1/1 (ĐIỆP)"), khối, sĩ số học sinh, tuần hiện tại/tổng số tuần, nút mở lớp.

---

## PHẦN B — Xuất Excel tổng hợp

### B1. Gộp 3 loại xuất Excel thành 1 nút — điểm + nhận xét + điểm danh
- **Hiện trạng**: "Xuất Excel" (`ReportsSection.tsx:280-376`) chỉ xuất cột điểm (STT, Mã HS, Họ tên, Điểm LT, Điểm TH, Tổng điểm, Xếp loại). "Xuất đánh giá Excel" mở modal `StudentCommentsManager` chỉ xuất câu nhận xét T/H theo khối. **Xuất điểm danh ra Excel hoàn toàn chưa tồn tại ở đâu trong code** — phải viết mới từ đầu (không phải chỉnh sửa cái có sẵn).
- **Đã chốt với chủ dự án**: 1 nút duy nhất → 1 file Excel, **1 sheet mỗi lớp**, **mỗi học sinh 1 dòng duy nhất** gồm đủ cột: điểm lý thuyết, điểm thực hành, tổng điểm, xếp loại, câu nhận xét tương ứng xếp loại T/H, tổng hợp điểm danh (số buổi có mặt/vắng/trễ). Tất cả tính theo phạm vi **Học kỳ 1 / Cả năm** đang chọn — dùng đúng bộ lọc Học kỳ/Cả năm đã có sẵn ở phần Báo cáo.
- **Việc cần làm**:
  - Viết hàm tổng hợp điểm danh theo khoảng tuần tương ứng học kỳ/cả năm (bảng `attendance` lưu theo `week_number`, cần SUM/COUNT theo `status` trong khoảng tuần phù hợp học kỳ 1 hay cả năm — tra cứu logic phân chia tuần/học kỳ đã có ở đâu đó trong ClassroomManager để tái dùng, tránh định nghĩa lại khác đi).
  - Gộp 3 nguồn dữ liệu (scores, câu nhận xét theo xếp loại từ comment_bank, điểm danh tổng hợp) vào 1 hàm export dùng chung thư viện `xlsx` đã có sẵn trong dự án.
  - Đặt nút xuất gộp này ở `ReportsSection.tsx` (nơi hợp lý nhất vì đã có sẵn bộ lọc Học kỳ 1/Cả năm và danh sách lớp).

---

## PHẦN C — Trắc nghiệm (Quiz Bank)

> 3 bug đã sửa sẵn, xem đầu file — không cần làm lại.

### C1. Bộ lọc khối dạng dropdown thay vì hàng nút ngang
- `QuizBank.tsx` (dòng ~454-461) và `DigitalResources.tsx` (dòng ~143-152, áp dụng tương tự): đổi hàng nút cuộn ngang "Tất cả các khối / Khối lớp 1..." thành 1 thẻ `<select>` dropdown.

### C2. Xóa nút "Chiếu trắc nghiệm cho cả lớp" — **đã chốt: xóa hẳn**
- `QuizBank.tsx`: xóa nút này và toàn bộ luồng trình chiếu liên quan (`handleStartPlay`, state `activeQuestion`/`isAnswerRevealed`, bộ đếm 30 giây, hiệu ứng confetti/âm thanh khi trình chiếu). Đây là tính năng đang chạy thật và tách biệt hoàn toàn với phần thi online của học sinh — xóa sạch, kiểm tra kỹ bằng `tsc --noEmit` để không sót biến/hàm/import chết sau khi xóa.

### C3. Chủ đề đã đúng theo từng khối — **không cần sửa**
- Đã xác nhận: cột `quiz_topics.grade` bắt buộc trên mọi chủ đề, `createTopic(grade, name)` luôn ghi đúng 1 khối. Không có chỗ nào cho chọn 1 chủ đề dùng chung nhiều khối. Giữ nguyên.

### C4. Nhập Excel: thêm popup 3 bước chọn khối → chọn/tạo chủ đề → chọn file
- **Hiện trạng sau khi vá bug an toàn**: đã bắt buộc chọn khối cụ thể trước khi nhập (chặn "Tất cả các khối"), chỉ nhập đúng vào chủ đề của khối đang chọn sẵn trên trang.
- **Phần UX đầy đủ còn thiếu**: thay vì dựa vào bộ lọc khối/chủ đề có sẵn trên trang, bấm "Nhập file Excel" nên mở 1 popup riêng: **bước 1** chọn khối → **bước 2** hiện danh sách chủ đề đã có của khối đó (tên rõ ràng) để chọn, hoặc gõ tên tạo chủ đề mới → **bước 3** mới cho chọn file Excel để import. Bản vá hiện tại đúng hướng về mặt an toàn dữ liệu, nhưng popup 3 bước là phần UX hoàn chỉnh người dùng mong muốn, cần làm thêm.

### C5. Form "Thêm câu hỏi mới"
- **(a) Thêm ảnh cho câu hỏi**: cột `quiz_questions.image_url` đã có sẵn trong DB nhưng form hiện KHÔNG có field ảnh, và hàm `createQuestion()` trong `quizService.ts` (dòng ~273-290) cũng CHƯA truyền `image_url` khi insert — phải làm cả 2: (1) thêm UI upload ảnh trong form thêm câu hỏi (tái dùng cách `GameCardForm.tsx` đã làm upload ảnh lên Supabase Storage), (2) sửa `createQuestion()` nhận thêm `image_url` và đưa vào object insert.
- **(b) "Chủ đề bài học"**: hiện là ô nhập chữ tự do (`<input type="text">`, dòng ~1019-1028 cũ) — đổi thành dropdown liệt kê các chủ đề **đã có sẵn của khối đang chọn** (lọc `allTopics` theo `grade`), để tránh gõ sai chính tả tạo trùng chủ đề. Vẫn nên giữ lựa chọn "+ Tạo chủ đề mới" trong dropdown cho trường hợp cần.
- **(c) Ô "Giải thích lời giải"** — đã xóa xong, không cần làm gì thêm.

### C6. Chọn chủ đề phải lọc đúng danh sách câu hỏi hiển thị — **không cần sửa**
- Đã xác nhận hoạt động đúng: bấm chọn chủ đề trong panel kích hoạt (`QuizTopicActivationPanel.tsx:162`) set `selectedTopicId`, danh sách câu hỏi chính đã lọc đúng theo `q.topic === selectedTopicId` (`QuizBank.tsx` dòng ~151). Giữ nguyên.

### C7. Luồng học sinh làm bài thi
- **Đã chốt giữ nguyên** (không phải bug): học sinh vẫn được **tự do chọn Khối** khi vào thi qua mã phòng, KHÔNG khóa cứng theo khối thật của lớp đã join (vd lớp Khối 2 vẫn chọn được đề Khối 5) — đây là quyết định có chủ đích của chủ dự án.
- **Cần làm mới — cơ chế chọn chủ đề thi do giáo viên/admin cấu hình** (đã thống nhất với chủ dự án): hiện tại khi 1 khối có nhiều chủ đề đang `is_active = true` cùng lúc, `StudentPortal.tsx`'s `handlePrepareQuiz` (dòng ~148-164) đang gộp **tất cả** topic active lại thành 1 đề chung (pool hết câu hỏi của mọi topic active) — cần sửa lại theo đúng 2 chế độ sau, do giáo viên/admin cấu hình, KHÔNG hardcode 1 chế độ duy nhất:
  - **Chế độ "mở" (mặc định)**: học sinh được tự do chọn 1 trong các chủ đề đang active của khối (chủ đề nào giáo viên/admin không active thì vốn dĩ học sinh không thấy — dùng đúng flag `is_active` sẵn có, không cần thêm field riêng cho phần "loại trừ").
  - **Chế độ "khóa 1 chủ đề"**: giáo viên/admin ép toàn bộ học sinh của khối đó CHỈ làm đúng 1 chủ đề cụ thể, học sinh không được chọn — các chủ đề active khác bị ẩn khỏi lựa chọn của học sinh dù vẫn đang active (để giáo viên chuẩn bị nhiều đề nhưng chỉ cho thi chính thức 1 đề).
  - **Thiết kế đề xuất** (AI dev sau có thể đổi tên cột, không bắt buộc đúng y chang): thêm 1 cột boolean mới trên `quiz_topics`, ví dụ `is_forced` — ràng buộc tối đa 1 chủ đề có `is_forced = true` cho mỗi khối tại 1 thời điểm (check bằng unique partial index hoặc validate ở tầng service). Khi khối đó có 1 chủ đề `is_forced = true` → bỏ qua bước chọn chủ đề của học sinh, tự động vào thẳng chủ đề đó, các chủ đề active khác bị ẩn. Khi KHÔNG có chủ đề nào `is_forced` cho khối đó → hiện danh sách chủ đề đang active để học sinh tự chọn đúng 1 cái, sửa `handlePrepareQuiz` để KHÔNG gộp pool câu hỏi nhiều topic lại nữa.
  - **UI cấu hình**: thêm 1 công tắc "Khóa chủ đề này, ẩn các chủ đề khác với học sinh" ngay trong panel `QuizTopicActivationPanel.tsx` hiện có — khi bật công tắc này ở 1 chủ đề thì tự tắt ở các chủ đề khác cùng khối (đảm bảo ràng buộc tối đa 1 chủ đề bị khóa mỗi khối).

---

## PHẦN D — Học liệu số

> Bug "Lưu link website" đã sửa — danh sách link giờ hiển thị tách biệt với video, xem commit đã nêu ở đầu file.

### D1. Thêm nút chèn ảnh thumbnail cho link website
- `SaveLinkForm.tsx` hiện KHÔNG có field ảnh/thumbnail nào (chỉ có tiêu đề + khối + URL). Thêm UI upload ảnh (tái dùng cách `GameCardForm.tsx` đã làm upload ảnh lên Supabase Storage), lưu vào cột `thumbnail_url` đã có sẵn trên bảng `resources`.
- Khi hiển thị card link đã lưu (cả ở Học liệu số lẫn Tiện ích, xem F2) — hiện ảnh thumbnail nếu có, fallback về không có ảnh nếu chưa upload.

---

## PHẦN E — Giải trí

### E1. Nhúng web game bên thứ 3 — **đã chốt: KHÔNG làm iframe, giữ nguyên mở tab mới**
- Tab "Trò chơi trực tuyến" trong `GamesSection.tsx` đã đầy đủ: form thêm game (ảnh/thumbnail qua `GameCardForm.tsx`, URL), kích hoạt/xóa, học sinh bấm vào mở game ở tab mới (`window.open(url, '_blank')`, `StudentPortal.tsx` khu vực games). Đã đúng như chủ dự án muốn — **không đổi sang iframe**, vì đa số trang web game chặn nhúng iframe qua header bảo mật của chính trang đó, đổi sẽ gây lỗi không đáng.

---

## PHẦN F — Tiện ích

### F1. Thu gọn các bước trong "Thẻ Nhận xét (Excel) Tự động" thành dạng accordion
- **Hiện trạng**: `StudentCommentsManager.tsx` hiển thị TẤT CẢ các bước (1. Khối lớp xuất nhận xét, 2. Kỳ đánh giá, 3. Thứ tự học sinh, menu nạp Excel H/T theo khối, preview câu nhận xét...) cùng lúc trên 1 trang dài, không thu gọn được.
- **Việc cần làm**: chia nội dung thành các section có thể thu gọn/mở rộng (accordion) — bấm vào tiêu đề mới xổ nội dung ra, mặc định có thể thu gọn bớt để đỡ dài khi mới mở.
- (Lưu ý: các tab chính "Thẻ Nhận xét / Đồng hồ đếm ngược / Chia nhóm / Nhập Excel / Liên kết tiện ích" ở `UtilitiesSection.tsx` **đã đúng dạng tab** — chỉ 1 tool hiện tại 1 lúc — không cần sửa phần này. Chỉ sửa NỘI DUNG BÊN TRONG tab "Thẻ Nhận xét".)

### F2. Thêm ảnh thumbnail cho card "Liên kết tiện ích" — dùng chung fix với D1
- `UtilitiesSection.tsx` (tab "Liên kết tiện ích", dòng ~579-649) đã có sẵn: thêm tiêu đề + URL + khối qua `SaveLinkForm`, hiện card, bấm mở tab mới, xóa được. **Chỉ thiếu ảnh/thumbnail trên card** — sau khi nâng cấp `SaveLinkForm.tsx` có field ảnh ở D1, áp dụng luôn cho tab này (component dùng chung, không cần sửa 2 nơi riêng biệt).

---

## PHẦN G — Quản trị & Phân quyền (việc lớn nhất, cần thiết kế schema mới)

### G1. Admin tạo "mã phòng" mới, thêm giáo viên vào phòng đó với quyền hạn chế — **thiếu hoàn toàn, cần thiết kế lại schema**
- **Hiện trạng**: `room_code` là cột trên bảng `classes` (mỗi **LỚP** có 1 mã phòng riêng, không phải 1 "phòng" chứa nhiều lớp/nhiều giáo viên). Mỗi lớp chỉ có 1 `created_by` (uuid) duy nhất. RLS hiện tại (`supabase/migrations/0006_rls_teacher_admin.sql`) chỉ cho phép truy cập nếu `created_by = auth.uid()` hoặc `is_admin()` — hoàn toàn chưa có khái niệm nhiều giáo viên cùng truy cập 1 lớp/phòng.
- **Việc cần làm**:
  1. Thêm bảng membership mới qua migration mới, ví dụ `class_teachers` (`class_id` FK → `classes.id`, `teacher_id` FK → `profiles.id`, `permission_level` text check in ('owner', 'editor', 'viewer') hoặc tương đương, unique `(class_id, teacher_id)`).
  2. Sửa toàn bộ RLS liên quan (`classes`, `students`, `scores`, `attendance`, `weekly_evaluations`, `quiz_results`...) để kiểm tra quyền qua bảng membership mới (ngoài `created_by` cũ, hoặc thay hẳn bằng membership tùy thiết kế) thay vì chỉ check `created_by`. Admin luôn toàn quyền (bypass qua `is_admin()` đã có).
  3. Viết UI trong `AdminPanel.tsx` cho admin: tạo lớp/phòng mới → thêm giáo viên vào phòng đó kèm mức quyền.
- **CẦN HỎI LẠI chủ dự án trước khi code phần này**: mức phân quyền chi tiết cho giáo viên được thêm vào phòng (được sửa học sinh/điểm/điểm danh hay chỉ xem, có được xóa lớp không, có được thêm giáo viên khác vào không...) — hiện chưa có đặc tả chi tiết, đừng tự đoán cách chia quyền.

### G2. Admin giao lớp cụ thể cho giáo viên cụ thể (1 giáo viên dạy nhiều lớp) — code đã có, chỉ thiếu UI
- `adminService.ts` đã có sẵn hàm `assignTeacherToClass(classId, teacherId)` (có unit test đi kèm) nhưng **không có nút/UI nào gọi tới nó** — code chết hiện tại. Việc cần làm: thêm UI trong `AdminPanel.tsx` (ví dụ dropdown chọn giáo viên ngay trong danh sách lớp, hoặc 1 tab mới "Phân công lớp") gọi hàm này.
- **Lưu ý thiết kế quan trọng**: nên làm G2 **cùng lúc** với G1, vì về bản chất "giáo viên được giao lớp" chính là 1 dạng thành viên của bảng membership ở G1. Thiết kế bảng `class_teachers` ở G1 nên tính luôn cho trường hợp "giao lớp" ở đây (ví dụ `permission_level = 'owner'` khi được giao làm chủ nhiệm chính), tránh làm 2 cơ chế phân quyền riêng biệt chồng chéo nhau.

### G3. Admin đổi mật khẩu giáo viên — **đã có sẵn, không cần làm**
- Đã triển khai và live-test thành công trên Supabase thật trong phiên trước (`resetStaffPassword` trong `AdminPanel.tsx`, qua Edge Function `manage-staff-account`). Không cần động vào.

---

## Gợi ý thứ tự ưu tiên khi triển khai

1. **Sửa trước (rẻ, an toàn, không đổi schema)**: A2, A3, A4, C1, C6 (đã đúng, bỏ qua), D1/F2 (thumbnail dùng chung component), F1 (accordion).
2. **Vừa (cần thêm field/hàm mới nhưng không đổi kiến trúc phân quyền)**: A1, A5, A6, B1 (xuất Excel gộp), C2 (xóa tính năng), C4 (popup 3 bước), C5 (ảnh câu hỏi + dropdown chủ đề), C7 (cơ chế khóa/mở chủ đề thi).
3. **Làm sau cùng, cần thiết kế kỹ + hỏi lại chủ dự án trước khi code**: G1 (schema membership phòng/giáo viên) + G2 (nên làm chung với G1).
