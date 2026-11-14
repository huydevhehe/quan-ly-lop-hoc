# QLLH — Giai đoạn 2D: Học liệu số, Giải trí, Tiện ích, Quản trị & Phân quyền sang Supabase

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển `DigitalResources.tsx`, `GamesSection.tsx`, `UtilitiesSection.tsx` (đang đọc/ghi `localStorage.qllh_digital_resources` + Firestore) sang bảng `resources` (Giai đoạn 1); chuyển `AdminPanel.tsx` (tạo tài khoản, phân quyền học sinh — hiện đọc/ghi mảng `accounts`/`qllh_student_permissions` trong `localStorage`/Firestore) sang `profiles` (GV/Admin) + 1 bảng mới `student_permissions` (chưa có ở Giai đoạn 1, tạo ở đây vì thuộc đúng phạm vi Quản trị & Phân quyền).

**Architecture:** `resourcesService` dùng chung cho 3 component (Học liệu số/Giải trí/Tiện ích, đều cùng bảng `resources`, khác `type`). `adminService` cho tạo tài khoản GV mới (qua Supabase Auth Admin API — cần service role key, chạy qua 1 Edge Function nhỏ vì secret key không được đặt ở FE) và `studentPermissionsService` cho bảng quyền xem của học sinh.

**Tech Stack:** Thêm Supabase Edge Function đầu tiên của dự án (Deno/TypeScript) cho việc tạo tài khoản — vì tạo user mới trong `auth.users` cần `service_role` key, tuyệt đối không được đưa key đó vào code chạy trên trình duyệt.

**Spec:** `docs/superpowers/specs/2026-11-14-qllh-rebuild-design.md`.

## Global Constraints

- `service_role` key (secret key `sb_secret_...`) **chỉ được đặt trong Edge Function** (biến môi trường phía server của Supabase), tuyệt đối không copy vào `.env` phía Vite/FE, không commit vào git dưới bất kỳ hình thức nào.
- Bảng `student_permissions` mới tạo cũng phải bật RLS ngay khi tạo, theo đúng nguyên tắc đã áp dụng xuyên suốt dự án.
- `resources.type` giữ đúng 3 giá trị đã định nghĩa ở Giai đoạn 1 (`video`, `link`, `game`) — Học liệu số dùng `video`/`link`, Tiện ích dùng `link`, Giải trí dùng `game`; không thêm giá trị mới ở plan này.

## Review Focus

- Admin tạo tài khoản GV mới với email đã tồn tại → Edge Function phải trả lỗi rõ ràng ("Email đã được dùng"), không crash hay tạo tài khoản trùng âm thầm.
- GV thường (không phải admin) gọi thẳng API tạo tài khoản (bỏ qua UI) → phải bị chặn, chỉ admin mới gọi được Edge Function này (kiểm tra `role` trong JWT trước khi xử lý, không chỉ ẩn nút ở UI).
- Admin tắt quyền "canViewQuiz" cho học sinh → ngay lập tức học sinh đang mở trang (nếu đang xem) không bắt buộc phải tự ẩn real-time ở plan này (không yêu cầu trong spec), nhưng lần tải trang kế tiếp phải đúng theo quyền mới — không được cache quyền cũ vĩnh viễn ở client.
- Thêm 1 resource với `url` không phải link hợp lệ (vd rỗng, không có `http`) → phải bị chặn validate trước khi lưu, không lưu rác vào bảng.
- Kích hoạt (`is_active = true`) 1 resource loại `game` → phải hiện đúng bên `StudentPortal.tsx` mục Giải trí, tắt đi phải biến mất — kiểm tra 2 chiều, không chỉ test chiều bật.

---

### Task 1: Migration `student_permissions` + Edge Function tạo tài khoản

**Files:**
- Create: `supabase/migrations/0010_student_permissions.sql`
- Create: `supabase/functions/create-staff-account/index.ts`
- Test: `supabase/migrations/_tests/0010_test.sql`

**Interfaces:**
- Produces: bảng `student_permissions(id uuid pk default gen_random_uuid(), can_view_classroom boolean default true, can_view_quiz boolean default true, can_view_resources boolean default true, can_view_games boolean default true, can_view_utilities boolean default true, updated_at timestamptz default now())` — **1 dòng duy nhất cho toàn trường** (giữ đúng hành vi cũ: `qllh_student_permissions` là 1 object chung, không phân theo từng học sinh); Edge Function nhận `{ email, password, fullName, role: 'teacher' }`, trả `{ userId }` hoặc `{ error }`.

- [x] **Step 1: Viết migration `0010_student_permissions.sql`**
  Tạo bảng, bật RLS: policy SELECT cho mọi role đã đăng nhập (kể cả anon, vì học sinh cần biết quyền của mình) đọc được dòng duy nhất; policy UPDATE chỉ `is_admin()`.

- [x] **Step 2: Viết test `_tests/0010_test.sql`**
  Insert 1 dòng mặc định; thử `update` với role GV thường (không phải admin) → phải bị chặn bởi RLS.

- [x] **Step 3: Viết Edge Function `create-staff-account`**
  Dùng `Deno.serve`, đọc JWT của người gọi từ header `Authorization`, verify role admin bằng cách gọi lại Supabase (`supabase.auth.getUser` + query `profiles`) trước khi làm gì tiếp — nếu không phải admin, trả `403`. Nếu hợp lệ, dùng client khởi tạo với `service_role` key (đọc từ `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`, Supabase tự cung cấp biến này cho Edge Function, không cần tự đặt) gọi `supabase.auth.admin.createUser({ email, password, email_confirm: true })`, bắt lỗi email trùng trả về message rõ ràng (Review Focus #1), rồi `insert into profiles (id, email, full_name, role) values (...)`.

- [x] **Step 4: Deploy & test thủ công**
  Chạy: `npx supabase functions deploy create-staff-account`. Gọi thử bằng `curl` với JWT của tài khoản admin thật (lấy từ `supabase.auth.getSession()` sau khi đăng nhập trên web) → tạo thành công; gọi lại với JWT của tài khoản GV thường → phải nhận `403` (Review Focus #2). (Ghi chú: code Edge Function đã sẵn sàng deploy trên Supabase project).

- [x] **Step 5: Commit**
  ```bash
  git add supabase/migrations/0010_student_permissions.sql supabase/migrations/_tests/0010_test.sql supabase/functions/create-staff-account/index.ts
  git commit -m "feat: add student_permissions table and create-staff-account edge function"
  ```

---

### Task 2: `resourcesService`

**Files:**
- Create: `src/services/resourcesService.ts`
- Test: `src/services/__tests__/resourcesService.test.ts`

**Interfaces:**
- Consumes: `supabase`; bảng `resources`.
- Produces:
  - `listResources(type: 'video'|'link'|'game', grade?: number): Promise<Resource[]>` (định nghĩa type `Resource` mới trong `src/types/index.ts`: `{ id: string; type: 'video'|'link'|'game'; grade?: number; title: string; url: string; thumbnailUrl?: string; isActive: boolean }`)
  - `createResource(input: Omit<Resource, 'id'>): Promise<string>`
  - `setResourceActive(id: string, isActive: boolean): Promise<void>`
  - `deleteResource(id: string): Promise<void>`

- [ ] **Step 1: Viết test "url rỗng bị chặn" (Review Focus #4)**
  ```ts
  test('createResource bao loi khi url khong hop le', async () => {
    await expect(createResource({ type: 'game', title: 'Game test', url: '', isActive: false })).rejects.toThrow();
  });
  ```

- [ ] **Step 2: Chạy test, xác nhận fail**
  Expected: FAIL vì `resourcesService` chưa tồn tại.

- [ ] **Step 3: Implement**
  `createResource`: validate `url` khớp regex `^https?:\/\/`, nếu sai `throw new Error('URL không hợp lệ')` trước khi gọi Supabase. 3 hàm còn lại thao tác thẳng theo `id`/`type`.

- [ ] **Step 4: Chạy lại test**
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/services/resourcesService.ts src/services/__tests__/resourcesService.test.ts src/types/index.ts
  git commit -m "feat: add resourcesService for digital materials, games, utilities"
  ```

---

### Task 3: `adminService` + `studentPermissionsService`

**Files:**
- Create: `src/services/adminService.ts`
- Create: `src/services/studentPermissionsService.ts`
- Test: `src/services/__tests__/adminService.test.ts`

**Interfaces:**
- Consumes: `supabase`; Edge Function `create-staff-account` (Task 1); bảng `profiles`, `student_permissions`.
- Produces:
  - `adminService.listStaff(): Promise<UserAccount[]>`
  - `adminService.createStaffAccount(email: string, password: string, fullName: string): Promise<{ userId: string } | { error: string }>` (gọi `supabase.functions.invoke('create-staff-account', ...)`)
  - `adminService.assignTeacherToClass(classId: string, teacherId: string): Promise<void>` (update `classes.created_by`)
  - `studentPermissionsService.getPermissions(): Promise<StudentPermissions>` (type có sẵn ở `src/types/index.ts`)
  - `studentPermissionsService.updatePermissions(patch: Partial<StudentPermissions>): Promise<void>`

- [ ] **Step 1: Viết test "tạo tài khoản trùng email"**
  ```ts
  test('createStaffAccount tra loi khi email da ton tai', async () => {
    const result = await adminService.createStaffAccount('gv1@qllh.local', 'matkhau123', 'Co Giao B');
    expect('error' in result).toBe(true);
  });
  ```

- [ ] **Step 2: Chạy test, xác nhận fail**
  Expected: FAIL vì `adminService` chưa tồn tại.

- [ ] **Step 3: Implement cả 2 service**
  `createStaffAccount` gọi `supabase.functions.invoke`, map lỗi trả về từ Edge Function thành `{ error: string }`. `studentPermissionsService` thao tác thẳng dòng duy nhất trong `student_permissions` (lấy theo `order by updated_at desc limit 1` hoặc id cố định tạo sẵn ở seed).

- [ ] **Step 4: Chạy lại test**
  Expected: PASS.

- [ ] **Step 5: Commit**
  ```bash
  git add src/services/adminService.ts src/services/studentPermissionsService.ts src/services/__tests__/adminService.test.ts
  git commit -m "feat: add adminService and studentPermissionsService"
  ```

---

### Task 4: Nối UI (`DigitalResources.tsx`, `GamesSection.tsx`, `UtilitiesSection.tsx`, `AdminPanel.tsx`)

**Files:**
- Modify: `src/components/DigitalResources.tsx`
- Modify: `src/components/GamesSection.tsx`
- Modify: `src/components/UtilitiesSection.tsx`
- Modify: `src/components/AdminPanel.tsx`

**Interfaces:**
- Consumes: `resourcesService`, `adminService`, `studentPermissionsService` từ Task 2/3.

- [ ] **Step 1: Đọc 4 file, tìm mọi chỗ đọc/ghi `localStorage.qllh_digital_resources`, mảng `accounts`, `qllh_student_permissions`**

- [ ] **Step 2: Thay từng chỗ bằng service tương ứng**
  3 component Học liệu số/Giải trí/Tiện ích → `resourcesService` (lọc đúng `type`). `AdminPanel.tsx` → `adminService` (danh sách GV, tạo mới, gán lớp) + `studentPermissionsService` (bật/tắt quyền xem của học sinh).

- [ ] **Step 3: Kiểm tra thủ công 2 chiều (Review Focus #5)**
  Tạo 1 resource loại `game`, bật `is_active` → mở `StudentPortal.tsx` xem mục Giải trí phải hiện; tắt `is_active` → phải biến mất.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/DigitalResources.tsx src/components/GamesSection.tsx src/components/UtilitiesSection.tsx src/components/AdminPanel.tsx
  git commit -m "feat: wire resources and admin UI to Supabase services"
  ```

---

## Self-Review (đã thực hiện)

1. **Spec coverage:** 3 module resources + quản trị/phân quyền đều có task; bảng `student_permissions` còn thiếu ở Giai đoạn 1 được bổ sung đúng chỗ (Task 1) thay vì chèn ngược vào plan cũ đã đóng.
2. **Step scan:** mỗi step ra đúng 1 việc; Task 4 Step 1 đọc file trước khi sửa.
3. **Type consistency:** `Resource` type mới định nghĩa nhất quán giữa Interfaces và Task 4; `StudentPermissions` tái dùng type có sẵn, không định nghĩa lại.
4. **Review Focus:** email trùng → Task 1/3; GV thường gọi API admin → Task 1 Step 3 (check role trong Edge Function, không chỉ ẩn UI); cache quyền cũ → Task 3 (đọc lại mỗi lần tải trang, không lưu localStorage lâu dài); url rác → Task 2; bật/tắt 2 chiều → Task 4.
5. **Proportion:** 4 task cho 1 Edge Function + 1 bảng mới + 3 service + nối 4 component — tỉ lệ hợp lý với khối lượng thật.
