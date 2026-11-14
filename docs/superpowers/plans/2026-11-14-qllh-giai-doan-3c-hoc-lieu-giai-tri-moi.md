# QLLH — Giai đoạn 3C: Học liệu số/Tiện ích — Lưu link, Giải trí — Thêm card game

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đây là phần nhỏ nhất còn lại trong `báo cáo.doc` — bảng `resources` và `resourcesService` đã có sẵn từ Giai đoạn 2D, chỉ cần thêm đúng 2 UI: (1) form "lưu link tới trang web khác" dùng chung cho Học liệu số và Tiện ích, (2) form "thêm card game" (tên, link, ảnh nền 16:9) cho Giải trí, cùng hiển thị tương ứng bên `StudentPortal.tsx`.

**Architecture:** Không cần service mới — tái dùng nguyên `resourcesService` (Giai đoạn 2D), chỉ khác `type` (`'link'` cho Học liệu số/Tiện ích, `'game'` cho Giải trí) và thêm field ảnh nền cho game (dùng lại `quizImageService`-style upload, hoặc tái dùng y nguyên bucket Storage đã tạo ở Giai đoạn 3B Task 1 nếu đã làm trước, nếu chưa thì tạo bucket riêng `resource-images` ở task đầu plan này).

**Tech Stack:** Không đổi.

**Spec:** `docs/superpowers/specs/2026-11-14-qllh-rebuild-design.md`; yêu cầu gốc: mục "Học liệu số", "Giải trí", "Tiện ích" trong `báo cáo.doc`.

## Global Constraints

- Không tạo bảng mới — bắt buộc tái dùng `resources` đã có từ Giai đoạn 2D, giữ đúng 3 giá trị `type`.
- Ảnh nền game bắt buộc tỉ lệ 16:9 — validate kích thước ảnh (width/height) ở FE trước khi upload, không chặn cứng ở server (vì tỉ lệ ảnh là gợi ý UX, không phải yêu cầu bảo mật như giới hạn dung lượng ở Giai đoạn 3B).

## Review Focus

- Link lưu vào không phải URL hợp lệ → đã có validate từ `resourcesService.createResource` (Giai đoạn 2D) — chỉ cần đảm bảo 2 form mới ở plan này đều đi qua đúng hàm đó, không tự viết validate riêng lặp lại.
- Card game khi chưa kích hoạt (`is_active = false`) → tuyệt đối không được hiện ở `StudentPortal.tsx` dù đã tồn tại trong bảng.
- Xóa 1 card game đang kích hoạt, đúng lúc học sinh đang mở trang Giải trí → không bắt buộc real-time (đã nêu ở Giai đoạn 2D, không lặp lại yêu cầu), nhưng lần bấm vào chơi tiếp theo phải báo lỗi rõ ràng thay vì mở link hỏng im lặng.

---

### Task 1: Form lưu link (Học liệu số & Tiện ích)

**Files:**
- Create: `src/components/resources/SaveLinkForm.tsx`
- Modify: `src/components/DigitalResources.tsx`
- Modify: `src/components/UtilitiesSection.tsx`

**Interfaces:**
- Consumes: `resourcesService.createResource` (Giai đoạn 2D).
- Produces: `<SaveLinkForm type="video"|"link" grade={number} onSaved={() => void} />`.

- [ ] **Step 1: Viết `SaveLinkForm.tsx`**
  Form 2 ô: Tiêu đề, URL. Submit gọi `resourcesService.createResource({ type, title, url, isActive: false })`. Lỗi validate URL hiện ngay dưới ô nhập (không alert popup).

- [ ] **Step 2: Nối vào `DigitalResources.tsx` và `UtilitiesSection.tsx`**
  Mỗi nơi dùng đúng `type` tương ứng; sau khi lưu, hiện ngay thành card trong danh sách hiện có (gọi lại `listResources`, không cần reload trang).

- [ ] **Step 3: Kiểm tra thủ công**
  `npm run dev`: lưu 1 link ở Học liệu số, 1 link ở Tiện ích, xác nhận hiện đúng chỗ, không lẫn sang nhau (đúng `type` lọc riêng).

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/resources/SaveLinkForm.tsx src/components/DigitalResources.tsx src/components/UtilitiesSection.tsx
  git commit -m "feat: add save-link form for digital resources and utilities"
  ```

---

### Task 2: Form thêm card game (Giải trí)

**Files:**
- Create: `supabase/migrations/0012_resource_images_storage_policy.sql` (bỏ qua nếu bucket ảnh đã có sẵn từ Giai đoạn 3B — kiểm tra trước bằng `select * from storage.buckets` qua SQL Editor)
- Create: `src/components/resources/GameCardForm.tsx`
- Modify: `src/components/GamesSection.tsx`

**Interfaces:**
- Consumes: `resourcesService.createResource`, `resourcesService.setResourceActive`, `resourcesService.deleteResource` (Giai đoạn 2D).
- Produces: `<GameCardForm onSaved={() => void} />`.

- [ ] **Step 1: Tạo bucket ảnh nền (nếu chưa có)**
  Nếu Giai đoạn 3B Task 1 đã tạo bucket `quiz-images` dùng public read tương tự, có thể tái dùng luôn bucket đó cho ảnh nền game (đổi tên logic thư mục con, ví dụ lưu vào `quiz-images/resource-backgrounds/`) thay vì tạo bucket mới — kiểm tra trước, chỉ tạo bucket `resource-images` mới nếu thực sự chưa có bucket nào phù hợp.

- [ ] **Step 2: Viết `GameCardForm.tsx`**
  Form: Tên game, Link trò chơi, Upload ảnh nền. Trước khi upload, đọc kích thước ảnh bằng `Image()` + `onload`, nếu tỉ lệ lệch quá xa 16:9 (vd ngoài khoảng 1.6–1.9) thì cảnh báo (không chặn cứng, theo đúng Global Constraints) nhưng vẫn cho lưu nếu người dùng xác nhận tiếp tục. Submit gọi `createResource({ type: 'game', title, url, thumbnailUrl, isActive: false })`.

- [ ] **Step 3: Nối vào `GamesSection.tsx`**
  Mỗi card hiện đủ nút sửa/xóa/kích hoạt (đúng yêu cầu gốc "có nút xóa sửa, nút kích hoạt"). Nút kích hoạt gọi `setResourceActive(id, true)`, chỉ 1 thao tác bật/tắt, không cần form riêng.

- [ ] **Step 4: Kiểm tra Review Focus #2 (game chưa kích hoạt không hiện bên học sinh)**
  Tạo 1 game mới (`isActive: false` mặc định) → mở `StudentPortal.tsx` mục Giải trí → không được thấy. Bấm kích hoạt → mở lại → phải thấy ngay.

- [ ] **Step 5: Commit**
  ```bash
  git add supabase/migrations/0012_resource_images_storage_policy.sql src/components/resources/GameCardForm.tsx src/components/GamesSection.tsx
  git commit -m "feat: add game card form with background image for entertainment section"
  ```

---

### Task 3: Hiển thị phía học sinh (`StudentPortal.tsx`)

**Files:**
- Modify: `src/components/StudentPortal.tsx`

**Interfaces:**
- Consumes: `resourcesService.listResources('game', ...)`, `resourcesService.listResources('link'|'video', ...)`.

- [ ] **Step 1: Đọc file, tìm mục hiển thị Giải trí/Học liệu số hiện có cho học sinh**

- [ ] **Step 2: Thêm hiển thị link mới (Học liệu số/Tiện ích) và card game mới**
  Chỉ hiện resource có `is_active = true` (RLS Giai đoạn 1 Task 7 đã lọc sẵn ở tầng database — phía FE chỉ cần gọi đúng `listResources`, không cần lọc lại thủ công).

- [ ] **Step 3: Kiểm tra link hỏng không crash (Review Focus #3)**
  Xóa 1 resource đang active ngay sau khi đã tải trang học sinh (giả lập bằng cách xóa ở tab GV rồi bấm chơi ở tab học sinh đã tải sẵn) → bấm vào phải hiện thông báo lỗi tải trang / link không khả dụng, không phải màn hình trắng.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/StudentPortal.tsx
  git commit -m "feat: show new links and game cards on student portal"
  ```

---

## Self-Review (đã thực hiện)

1. **Spec coverage:** Lưu link (Học liệu số + Tiện ích) và card game (Giải trí) — đúng 2 yêu cầu còn lại trong docx, không còn mục nào của docx chưa có plan (toàn bộ docx đã được phủ hết qua Giai đoạn 3A/3B/3C).
2. **Step scan:** mỗi step ra đúng 1 việc; Task 3 Step 1 là đọc file trước khi sửa.
3. **Type consistency:** dùng đúng `type: 'video'|'link'|'game'` đã định nghĩa từ Giai đoạn 2D, không tạo kiểu mới.
4. **Review Focus:** URL hợp lệ → tái dùng validate có sẵn, không lặp code; game chưa active không hiện → Task 2 Step 4; link hỏng không crash → Task 3 Step 3.
5. **Proportion:** plan ngắn nhất trong toàn bộ chuỗi — đúng vì đây là phần việc nhỏ nhất theo đánh giá đã thống nhất từ các lượt trao đổi trước.
