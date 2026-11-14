# QLLH — Giai đoạn 2E: Dọn dẹp code cũ (Firestore/localStorage)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sau khi Giai đoạn 2A–2D đã chuyển hết mọi tính năng sang Supabase, xóa toàn bộ code cũ (`src/firebase.ts`, `src/utils/dbStorage.ts`, `src/utils/userScope.ts`, gói `firebase` trong `package.json`) để codebase không còn 2 nguồn dữ liệu song song — đúng tinh thần "clean code, chuẩn doanh nghiệp" đã yêu cầu.

**Architecture:** Đây là plan dọn dẹp thuần túy, không thêm tính năng. Chỉ chạy **sau khi** 2A, 2B, 2C, 2D đã merge xong và đã kiểm tra thủ công toàn bộ app chạy tốt trên Supabase.

**Tech Stack:** Không đổi.

**Spec:** `docs/superpowers/specs/2026-11-14-qllh-rebuild-design.md`.

## Global Constraints

- **Điều kiện tiên quyết bắt buộc:** chỉ bắt đầu plan này khi `grep -r "dbStorage\|firebase.ts\|userScope" src/components` không còn kết quả nào ngoài các import đã được thay ở 2A–2D — nếu còn, dừng lại, báo người dùng biết còn chỗ nào chưa migrate, **không tự ý xóa** khi còn phụ thuộc.
- Không xóa file `.env.example` dòng `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` — chỉ xóa phần liên quan Firebase.

## Review Focus

- Sau khi xóa `firebase` khỏi `package.json`, app build (`npm run build`) không được còn import nào trỏ tới `firebase/app`, `firebase/firestore`, `firebase/auth`.
- Xóa `src/utils/userScope.ts` (`filterClassesForUser`) — phải chắc chắn không còn component nào còn gọi hàm đó để "lọc thêm cho chắc" (an toàn giả — dựa vào RLS thật, không dựa vào lọc client nữa).
- File `.gitignore`/`.env.example` không được vô tình xóa mất dòng cấu hình Supabase khi dọn các dòng liên quan Gemini/Firebase cũ.

---

### Task 1: Kiểm tra không còn phụ thuộc trước khi xóa

**Files:**
- (không tạo/sửa file — task kiểm tra thuần)

- [ ] **Step 1: Chạy tìm kiếm phụ thuộc**
  Chạy: `grep -rn "from '../firebase'\|from '../utils/dbStorage'\|from '../utils/userScope'\|from '../../firebase'" src/components src/App.tsx`.
  Expected: không còn dòng nào (nếu còn, dừng plan tại đây, liệt kê file còn thiếu, báo lại cho người giao việc — không tự sửa thêm ngoài phạm vi plan này).

- [ ] **Step 2: Chạy toàn bộ test hiện có**
  Chạy: `npx vitest run && npm run lint`.
  Expected: PASS hết, 0 lỗi — xác nhận trạng thái "sạch" trước khi xóa, để nếu có lỗi sau khi xóa thì biết chắc là do bước xóa gây ra.

---

### Task 2: Xóa file cũ + gói phụ thuộc

**Files:**
- Delete: `src/firebase.ts`
- Delete: `src/utils/dbStorage.ts`
- Delete: `src/utils/userScope.ts`
- Modify: `package.json`

- [ ] **Step 1: Xóa 3 file**
  Chạy: `git rm src/firebase.ts src/utils/dbStorage.ts src/utils/userScope.ts`.

- [ ] **Step 2: Gỡ gói `firebase` khỏi `package.json`**
  Chạy: `npm uninstall firebase`.

- [ ] **Step 3: Build thử**
  Chạy: `npm run build`.
  Expected: build lỗi nếu còn file nào import 3 file đã xóa — đọc lỗi, nếu có file sót chưa được nối ở 2A–2D thì dừng lại báo cáo (đúng Global Constraint, không tự chế code mới ngoài phạm vi dọn dẹp).

- [ ] **Step 4: Build thành công, chạy lại test**
  Chạy: `npx vitest run && npm run lint`.
  Expected: PASS hết.

- [ ] **Step 5: Commit**
  ```bash
  git add -A
  git commit -m "chore: remove legacy Firestore/localStorage data layer"
  ```

---

### Task 3: Dọn `.env.example` và tài liệu hướng dẫn cũ

**Files:**
- Modify: `.env.example`
- Modify: `1_Huong_Dan_Mo_Ung_Dung.txt` (nếu còn nhắc tới Firebase config thủ công)

- [ ] **Step 1: Xóa 2 dòng `GEMINI_API_KEY`/`APP_URL` nếu không còn được dùng ở đâu trong code (kiểm tra bằng `grep -rn "GEMINI_API_KEY\|process.env.APP_URL" src`)**
  Nếu vẫn còn dùng (vd tính năng AI Studio nào đó chưa rõ), **giữ nguyên, không xóa** — chỉ xóa khi chắc chắn không còn tham chiếu.

- [ ] **Step 2: Đọc `1_Huong_Dan_Mo_Ung_Dung.txt`, sửa lại phần hướng dẫn cấu hình Firebase (nếu có) thành hướng dẫn Supabase**
  (File này chưa đọc khi viết plan — đọc trước khi sửa.)

- [ ] **Step 3: Commit**
  ```bash
  git add .env.example 1_Huong_Dan_Mo_Ung_Dung.txt
  git commit -m "docs: update setup guide for Supabase, remove unused Firebase config"
  ```

---

## Self-Review (đã thực hiện)

1. **Spec coverage:** Mục tiêu duy nhất của plan ("xóa code cũ") có task tương ứng (Task 2); có bước kiểm tra an toàn trước/sau (Task 1, Task 2 Step 3-4).
2. **Step scan:** Task 1 là kiểm tra, không phải "sửa" — đúng bản chất plan dọn dẹp, không lẫn code mới.
3. **Type consistency:** không áp dụng (plan này không thêm interface mới).
4. **Review Focus:** còn import firebase sau khi gỡ gói → Task 2 Step 3 (build sẽ lộ ra); còn dùng `userScope` lọc thêm → Task 1 Step 1 quét trước khi xóa; mất dòng Supabase trong `.env.example` → Task 3 Step 1 chỉ xóa 2 dòng Gemini/APP_URL, không đụng dòng Supabase.
5. **Proportion:** 3 task ngắn, đúng với bản chất việc dọn dẹp — không thêm chi tiết thừa.
