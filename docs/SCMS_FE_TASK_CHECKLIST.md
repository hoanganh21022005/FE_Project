# SCMS — Checklist task FE để giao Agent theo từng chặng

**Phiên bản:** 1.1 — 2026-10-02
**Kế hoạch gốc:** `SCMS_FE_IMPLEMENTATION_PLAN.md`
**Nguyên tắc:** Tất cả checkbox ban đầu là `[ ]`. Agent thực hiện một chặng được giao, nộp bằng chứng và ghi `Ready for review`; **chỉ chủ dự án đánh dấu `[x]` sau khi review**. Không tự động đánh dấu theo việc code đã merge.

**Snapshot review hiện tại:** branch `PhatTai`, commit `9c1fad4` ngày 2026-10-02. G0 và G1.1–G1.3 đã được review, kiểm thử API live và nghiệm thu trên browser/API mode thật. Không còn blocker credential; gate cho G1.4–G1.6 đã mở.

## A. Cách dùng checklist

1. Chọn đúng **một chặng** dưới đây, giao mã task cho Agent. Agent đọc cả hai file Markdown và source hiện tại trước khi sửa.
2. Agent ghi trạng thái ngay dưới chặng: `Not started`, `In progress`, `Blocked: ...` hoặc `Ready for review`. Checkbox giữ `[ ]` đến khi review.
3. Agent nộp commit/diff hoặc ZIP chỉ chứa source; kèm cách chạy, endpoint đã kiểm chứng, kết quả build/test, ảnh nếu có UI và danh sách việc chưa xong.
4. Chủ dự án gửi kết quả cho Codex review; khi đạt, tự đổi `[ ]` thành `[x]`, ghi commit và ngày review rồi mới giao chặng kế tiếp.
5. Nếu BE lỗi, ghi task `Blocked` kèm method/path/status, thời gian, role và request đã ẩn dữ liệu nhạy cảm. Tiếp tục phần FE độc lập, không tạo success giả.

### Mẫu thông tin review cho mỗi chặng

```text
Chặng: G...
Branch/commit: ...
File thay đổi: ...
API đã test: METHOD /path → status; role: ...
Build/test: lệnh + kết quả
Cách thử tay: bước 1, 2, 3...
Ảnh/video: ...
Lỗi còn lại và phụ thuộc BE: ...
Trạng thái: Ready for review
Reviewed by/date: [chủ dự án điền sau]
```

## G0 — Baseline, contract và môi trường

**Trạng thái chặng:** **Approved** — G0.1–G0.7 đã đủ bằng chứng review; G0.3 đã xác minh API session và cookie persistence trên browser/API mode thật.
**Đầu vào:** ZIP đã bàn giao, `FE_Project/README.md`, `api-docs.json`, `test-results.json`.
**Phạm vi giao Agent:** Kiểm tra và ghi nhận; chỉ sửa cấu hình hoặc tài liệu FE cần thiết để build. Không sửa BE ngoài phạm vi FE.

- [x] **G0.1 — Xác lập source gốc.** Kiểm tra branch, `git status`, Node/pnpm, biến môi trường theo tên (không in giá trị nhạy cảm), `.gitignore`. Ghi commit baseline và các thay đổi đã tồn tại trước khi làm. **Approved 2026-10-01.**
- [x] **G0.2 — Cài và build sạch.** Cài `pnpm install --frozen-lockfile` trong workspace sạch; chạy `pnpm build`, `pnpm dev:local`, `pnpm dev`. Ghi chính xác lỗi nếu có. Không dùng `node_modules` mang theo trong ZIP làm bằng chứng build. **Approved 2026-10-01.**
- [x] **G0.3 — Kiểm tra API mode.** Xác nhận `.env.mock` bật mock, API mode gọi đúng backend qua Vite proxy hoặc base URL, cookie session được gửi. Không commit `.env.local`. **Approved 2026-10-02:** 8/8 account đạt `login 200 → me 200 đúng role → logout 204 → me 401`; browser lưu session qua Vite proxy tại `localhost`, F5 khôi phục đúng user/role. Không ghi credential hoặc cookie vào source/report.
- [x] **G0.4 — Contract Admin.** Bảng GET/POST/PUT/PATCH cho user, role, permission, audit: request body, response, enum, quyền, status lỗi. Test một mutation trên tài khoản test không quan trọng nếu BE cho phép; không tác động Admin cuối cùng. **Approved 2026-10-01 sau sửa review.**
- [x] **G0.5 — Contract Flow 1.** Bảng member, staff, package, member-package/subscription; xác minh các trường bắt buộc, status, ID quan hệ, form tạo hồ sơ có tự tạo user không, tác động hóa đơn khi gán/gia hạn gói. **Approved 2026-10-01 sau sửa review.**
- [x] **G0.6 — Chốt phụ thuộc BE.** Chuyển cho BE các câu hỏi: Admin “toàn quyền” thực thi ở server ra sao; `PATCH /api/users/{id}/role` body nào; endpoint membership canonical; quy tắc payment; tài liệu PostgreSQL/SQL Server. Ghi câu trả lời vào bảng contract khi có. **Approved 2026-10-01; câu hỏi BE tiếp tục Open.**
- [x] **G0.7 — Vệ sinh gói bàn giao.** Xác nhận `.gitignore` loại `node_modules`, `dist`, `.env.local`, cookie/log; bản ZIP hoặc PR mới không mang các file này. Chuyển sự cố credential DB trong tài liệu cho BE để đổi secret và thay bằng placeholder; không đưa credential vào commit FE. **Approved 2026-10-01; việc rotate secret thuộc Project Owner/BE/DevOps.**

**Điểm review G0:** `pnpm build` trong máy của Agent; bảng contract có link OpenAPI/kết quả API thật; danh sách vấn đề BE. Nếu build chưa qua, dừng các chặng code phụ thuộc build.

## G1 — Auth, role, session và route guard

**Trạng thái chặng:** **Approved — G1.1–G1.6 hoàn tất**. Final review xác nhận browser matrix 24/24, HTTP 401/403, Logout thật, F5/deep link và đủ Admin/Manager/Receptionist/Member; production bundle không còn test hook, mock role dùng exact mapping và có negative assertions. G2 đã triển khai nhưng review vòng 1 ngày 2026-10-03 là Changes requested; G3 chưa mở.
**File dự kiến:** `src/context/SCMSContext.jsx`, `src/App.jsx`, `src/api/httpClient.js`, `src/components/views/LoginView.jsx`, route guard mới.
**Phụ thuộc:** G0.2 và contract auth.

- [x] **G1.1 — Role mapping.** Map chính xác `Admin`, `CenterManager`, `Coach`, `Receptionist`, `Member` (case normalization có kiểm soát). Role lạ báo lỗi/unsupported; không fallback `manager` trong API mode. Mock mode có role rõ ràng riêng. **Approved 2026-10-02:** source review và logic test pass.
- [x] **G1.2 — Redirect login.** Dùng user trả về từ `login()` để chọn `/admin/dashboard`, `/manager/dashboard`, `/coach/dashboard`, `/receptionist/dashboard`, `/member/dashboard`. API mode không phụ thuộc `setRole()` cập nhật đồng bộ; login thành công phải rời trang login. **Approved 2026-10-02:** browser/API mode xác minh redirect đúng cho Admin, Center Manager, Receptionist, Coach và Member; 8/8 account API trả đúng role.
- [x] **G1.3 — Khôi phục phiên và deep link.** `/api/auth/me` F5 tại từng route giữ đúng layout/role, không nhấp nháy route sai khi `authLoading`; logout vào lại route cũ yêu cầu login. **Approved 2026-10-02:** F5 giữ đúng dashboard của 5 nhóm role; `/manager/classes` giữ nguyên sau reload; protected URL sau logout về login; đăng nhập role khác từ intended URL sai quyền fallback về đúng dashboard.
- [x] **G1.4 — Guard.** Thêm `RequireAuth`, `RequireRole` và `RequirePermission` khi dùng; route sai role vào trang 403 hoặc chuyển về dashboard hợp lệ. Không dùng sidebar ẩn link làm cơ chế bảo vệ duy nhất. **Approved 2026-10-02:** component regression pass; Chrome headless xác nhận Member/Manager bị chặn ở direct wrong-role URL, view trái quyền không mount, F5 giữ 403 và Back/Forward giữ đúng route.
- [x] **G1.5 — HTTP lỗi.** Chỉ 401 phát sự kiện mất phiên; 403 giữ auth state và hiện lỗi thiếu quyền; lỗi mạng/500 hiện lỗi phù hợp, không giả như hết phiên. **Approved 2026-10-02:** production `httpRequest`, live API và browser network interception đều đạt; Toast 403 giữ phiên, 401 kết thúc phiên và render LoginView đúng intended location. Test hook chỉ tồn tại trong mock mode và đã được loại khỏi production bundle.
- [x] **G1.6 — Kiểm thử quyền.** Với ít nhất Admin, Manager, Receptionist và Member: login, F5, logout, nhập URL role khác, API 403. Test 401 hết phiên theo cách an toàn hoặc mock response có kiểm soát; `pnpm build` qua. **Approved 2026-10-02:** Chrome matrix 24/24 đạt trên đủ bốn role, click Logout thật; exact mock role mapping và negative assertions đạt; logic/component/build/API evidence đều sạch.

**Điểm review G1:** Bảng URL × role với kết quả mong đợi/thực tế; video hoặc ảnh login Admin và Manager, F5 giữ đúng trang; Network tab chứng minh 403 không logout.

## G2 — Khung portal Admin riêng và dữ liệu đọc thật

**Trạng thái chặng:** **Approved — G2.1–G2.7 hoàn tất**. Final review tại `960439c` xác nhận live acceptance 8/8, browser matrix 24/24, logic/guard tests, production và mock build, bundle scan không chứa test hook/mock/credential marker, cùng `git diff --check` đều đạt.
**File dự kiến:** `src/App.jsx` hoặc file route mới, `src/api/adminApi.js`, mapper Admin, `AdminLayout`, `AdminSidebar`, `AdminHeader`, các view Admin.
**Phụ thuộc:** G1 đã review.

- [x] **G2.1 — Lối vào Admin.** Tạo `/admin/login` với giao diện nhận diện Admin, dùng auth backend hiện có; account non-Admin không vào được `/admin/*`. Logout ra đúng lối vào hợp lý.
- [x] **G2.2 — Layout & Nhận diện Quản trị Hệ thống.** Trang Admin được tách riêng ra link riêng biệt (chỉ duy nhất tài khoản Admin được phép đăng nhập), với mục tiêu quản trị hệ thống độc lập so với phân hệ quản lý trung tâm thể thao của Manager. Về mặt giao diện, đồng bộ hoàn toàn và tái sử dụng toàn bộ ngôn ngữ thiết kế, layout shell cùng bảng màu Firebase/Fireside đã có của hệ thống chính (không tạo thiết kế mới, không dùng theme riêng biệt), chỉ bổ sung menu và các màn hình đặc thù quản trị hệ thống. Menu quản trị tối thiểu: Tổng quan hệ thống, Người dùng, Vai trò & Quyền, Nhật ký, Hồ sơ/Đăng xuất.
- [x] **G2.3 — Read adapters.** `adminApi.js` gọi `GET /api/users`, `/api/roles`, `/api/permissions`, `/api/audit-logs`; mapper dùng field thật và ID số BE. Không `fetch` trực tiếp trong view.
- [x] **G2.4 — Trang tổng quan.** Dùng count tính từ dữ liệu đọc được với nhãn nguồn rõ; không gọi `/api/reports/dashboard` lỗi 500; lỗi một panel không chặn panel khác.
- [x] **G2.5 — Trang user và role đọc.** Có danh sách, tìm/lọc hợp lý, chi tiết, permission matrix dạng read-only ở chặng này. Có loading, empty, error và retry riêng từng màn.
- [x] **G2.6 — Audit log.** Hiển thị actor/action/target/time/detail theo DTO thực; thiếu tên actor thì hiển thị ID rõ ràng, không gán tên từ mock.
- [x] **G2.7 — Kiểm thử.** Login Admin, vào thẳng `/admin/users` rồi F5, navigation, logout; Manager gõ `/admin/users` bị chặn. `pnpm build` qua.

**Điểm review G2:** Ảnh 4 màn Admin có dữ liệu BE, bảng endpoint GET/status và kết quả guard.

## G3 — CRUD user và RBAC cho Admin

**Trạng thái chặng:** Not started
**Phụ thuộc:** G2 đã review; BE xác nhận/test các mutation liên quan.
**Lưu ý:** Không tạo màn thêm/xóa role vì OpenAPI chỉ có đọc role và thay permission của role hiện hữu.

- [ ] **G3.1 — Form tạo user.** `POST /api/users`; validation fullName/email/role và password nếu BE yêu cầu; thông báo email trùng/field lỗi. Không hiển thị hoặc log mật khẩu sau submit.
- [ ] **G3.2 — Sửa user.** `PUT /api/users/{id}`; chỉ gửi field hợp đồng cho phép, giữ nguyên field bắt buộc; sau thành công refetch hoặc cập nhật từ response.
- [ ] **G3.3 — Đổi trạng thái.** `PATCH /api/users/{id}/status`; xác nhận trước thao tác khóa/tắt tài khoản, xử lý tự khóa hoặc khóa Admin cuối cùng theo quy tắc BE; nếu BE không chặn, ghi issue để BE sửa.
- [ ] **G3.4 — Đổi role.** `PATCH /api/users/{id}/role` theo body BE đã test; UI cho role phù hợp, cảnh báo ảnh hưởng quyền; thay role của chính mình phải cập nhật phiên/điều hướng theo kết quả BE.
- [ ] **G3.5 — Ma trận RBAC.** `PUT /api/roles/{id}/permissions` gửi `{ "permissionIds": [...] }` sau xác nhận. So sánh quyền trước/sau, có cancel/reset, không mất selection khi API lỗi.
- [ ] **G3.6 — Tính nhất quán và audit.** Refetch user/role/permissions sau mutation; kiểm tra audit log có ghi thao tác nếu backend hỗ trợ. Không tạo audit entry giả ở FE trong API mode.
- [ ] **G3.7 — Test mutation.** Trên user/role test: tạo → sửa → đổi role → đổi status → F5; sửa permission rồi login lại bằng user thuộc role đó để kiểm chứng BE. Thử 400/403/409 và gửi trùng.

**Điểm review G3:** Request/response đã ẩn dữ liệu nhạy cảm, ảnh trước/sau, audit và build. Nếu POST/PATCH/PUT fail do BE, đánh `Blocked` đúng task; không đánh cả chặng là hoàn thành.

## G4 — Member và Staff thật

**Trạng thái chặng:** Not started
**Phụ thuộc:** G1 và G0 contract; G3 không bắt buộc nếu việc tạo member/staff không phụ thuộc tạo user qua Admin.
**File dự kiến:** `src/api/memberApi.js`, `staffApi.js`, mapper, `MemberManagement`, `MemberDetailView`, `NewMemberModal`, `StaffManagement`, `NewStaffModal`, Context/hook tương ứng.

- [ ] **G4.1 — Adapter/mapper Member.** GET list/detail, POST, PUT, PATCH status; map `id`, `code`, `name`, `email`, `phone`, `joinDate`, `membershipStatus`, `currentPackageId`, `primaryCoachId`, `status`. Phân biệt `status` tài khoản và `membershipStatus` gói.
- [ ] **G4.2 — Danh sách Member.** API mode lấy BE thay `INITIAL_MEMBERS`; tìm/lọc/trạng thái dùng dữ liệu thật, ID URL hợp lệ. Tách loading/error/empty, không hiển thị mock nếu request lỗi.
- [ ] **G4.3 — Tạo/sửa Member.** Form khớp `MemberRequest`, `POST /api/members`, `PUT /api/members/{id}`; kiểm tra email trùng, required field, quan hệ user đã tồn tại. Thành công refetch và vào detail.
- [ ] **G4.4 — Member Detail.** Tải `GET /api/members/{id}` kể cả khi mở URL trực tiếp/F5; không phụ thuộc một record đã có trong Context. Trường không được BE trả về phải thể hiện đúng là chưa có dữ liệu, không bịa từ mock.
- [ ] **G4.5 — Trạng thái Member.** `PATCH /api/members/{id}/status` với enum BE xác nhận; nút/action và confirmation phù hợp, lỗi 403 không logout.
- [ ] **G4.6 — Adapter/mapper Staff.** GET/POST/PUT/PATCH status; thống nhất `role`, `specialization`, ID dùng cho coach và state active; API mode không trộn `INITIAL_STAFF`.
- [ ] **G4.7 — Form/danh sách Staff.** Tạo/sửa/khóa Coach và Receptionist theo quyền BE; validate form, refetch sau ghi, lỗi giữ modal. Không cho Manager đổi quyền hệ thống nếu nghiệp vụ đó thuộc Admin.
- [ ] **G4.8 — Coach lookup.** Các form phân công coach lấy từ `GET /api/staff`, map đúng ID số mà API Class chấp nhận. Tạo/sửa class cũ vẫn hoạt động sau khi bỏ mock Staff.
- [ ] **G4.9 — Test end-to-end.** Manager/Receptionist theo quyền: tạo member, sửa, đổi status, F5; tạo staff test và phân công coach; 400/403/email trùng. `pnpm build` qua.

**Điểm review G4:** Dữ liệu tạo mới xuất hiện trên BE sau reload; không còn state mock cho thao tác Member/Staff chính; bảng mapping ID và status rõ.

## G5 — Membership lifecycle thật

**Trạng thái chặng:** Not started
**Phụ thuộc:** G4 đã review; BE xác nhận endpoint canonical và quy tắc invoice/payment.
**File dự kiến:** `src/api/membershipApi.js`, mapper, `MemberDetailView`, modal gán/gia hạn gói và các view cần hiển thị gói.

- [ ] **G5.1 — Chốt API tạo đăng ký.** So sánh `POST /api/members/{id}/packages` với `POST /api/members/{id}/subscriptions`; BE chỉ rõ endpoint chuẩn và tác động của từng endpoint. Không gọi cả hai cho cùng thao tác.
- [ ] **G5.2 — Dữ liệu đọc.** Lấy lịch sử gói từ `GET /api/members/{id}/packages` hoặc `/subscriptions`; map `subscriptionId`, `packageId`, `startDate`, `endDate`, `status`, `price`. Hỗ trợ F5 tại Member Detail.
- [ ] **G5.3 — Form đăng ký.** Chọn package active thật; validation startDate/duration/isRenewal/paymentMethod theo contract; request một lần, khóa submit chờ kết quả; lỗi giữ form.
- [ ] **G5.4 — Gia hạn.** Chỉ hiện khi BE cho phép; sử dụng `isRenewal` và quy tắc tính ngày BE xác nhận; không cộng tháng hoặc tự kích hoạt gói bằng công thức FE.
- [ ] **G5.5 — Thay đổi trạng thái.** Nếu có action, dùng `PATCH /api/member-packages/{id}/status` hoặc `/subscriptions/{id}/status` đúng ID và quyền; xác định với BE khi nào được hủy/tạm ngưng/kích hoạt.
- [ ] **G5.6 — Trạng thái payment.** Không biến `Pending` thành `Active` hay `Paid` bằng mock. Nếu invoice 500, UI thể hiện đúng trạng thái BE trả và mô tả rằng bước thanh toán thật đang bị chặn.
- [ ] **G5.7 — Kiểm thử.** Đăng ký/gia hạn trên member test, reload thấy lịch sử và ngày hết hạn; thử gói inactive, đăng ký trùng, lỗi mạng, 403. Xác nhận không tạo hai subscription.

**Điểm review G5:** Một member test có vòng đời gói đúng API, dữ liệu tồn tại sau reload; ghi rõ điểm dừng payment nếu BE chưa sửa.

## G6 — Rà soát giao diện và demo

**Trạng thái chặng:** Not started
**Phụ thuộc:** G1–G5 được review hoặc những task Blocked đã có phương án demo trung thực.

- [ ] **G6.1 — Giao diện.** Rà desktop và màn hẹp: font, cột/hàng, modal dài, form lỗi, badge, tên vai trò, loading/empty state và VI/EN trên các màn demo.
- [ ] **G6.2 — Chặn thao tác mock.** Trong API mode, các nút trên luồng demo không được gọi `addMember`, `addStaff`, `addMemberPackage` mock. Action ngoài phạm vi được ghi nhãn hoặc ẩn để tránh demo nhầm.
- [ ] **G6.3 — Kịch bản Admin.** `/admin/login` → dashboard → users → tạo/sửa/role/status → role permissions → audit → F5 → logout. Ghi rõ bước nào còn Blocked do BE.
- [ ] **G6.4 — Kịch bản Flow 1.** Manager/Receptionist login → danh sách member → tạo/sửa → đăng ký/gia hạn gói → Member Detail → F5 → xem lịch sử. Ghi ID dữ liệu test, không ghi password/cookie.
- [ ] **G6.5 — Ma trận quyền.** Admin/Manager/Coach/Receptionist/Member truy cập các URL đúng/sai; 401/403; riêng các role không có quyền hành động bị ẩn hoặc nhận thông báo đúng.
- [ ] **G6.6 — Kiểm thử lỗi.** API 500 ở dashboard không làm mất classes/packages; 400/409 giữ form; 403 giữ phiên; mất mạng có retry hoặc thông báo. Build sạch qua.
- [ ] **G6.7 — Bàn giao.** Commit/diff, README chạy local/API mode, endpoint/status đã test, ảnh hai flow, danh sách bug/phụ thuộc BE và đề xuất sprint sau.

**Điểm review G6:** Chủ dự án tự chạy hai flow trên API mode thật và gửi mã/ảnh để Codex review. Chỉ khi demo thật chạy ổn mới đánh dấu xong G6.

## B. Backlog sau demo — chưa giao trong đợt này

Các checkbox sau được giữ `[ ]` cho tới khi chủ dự án quyết định làm flow tương ứng. Không gộp vào G0–G6.

### G7 — Class/Session/Schedule

- [ ] **G7.1** Tách UI `Class` (cấu hình) và `Session` (ngày/giờ/phòng); sửa modal tạo lớp đang làm người dùng tưởng đã xếp lịch.
- [ ] **G7.2** Adapter CRUD/generate/check-conflict session; mapping thời gian/timezone/status và tải lịch từ BE.
- [ ] **G7.3** Kiểm tra xung đột coach/phòng và quyền; refetch sau tạo/sửa; test lịch sau F5.

### G8 — Booking/Enrollment

- [ ] **G8.1** BE sửa 403 của Member ở catalog lớp hoặc cấp endpoint catalog có quyền đọc phù hợp.
- [ ] **G8.2** Sửa đảo đối số `bookClass(classId, memberId)` trong `ReceptionClassBooking.jsx`; chuyển booking/cancel từ mock sang Enrollment API.
- [ ] **G8.3** Kiểm tra capacity, gói hợp lệ, đăng ký trùng, hủy và trạng thái sau F5.
- [ ] **G8.4** Tách view Attendance/Progress cho Member khỏi component Coach, theo dữ liệu/quyền của Member.

### G9 — Invoice/Payment/Report

- [ ] **G9.1** BE sửa GET invoice, dashboard, revenue đang 500 và test endpoint ghi/payment.
- [ ] **G9.2** FE thay mock payment bằng invoice/payment API, trạng thái và lịch sử thật.
- [ ] **G9.3** Report lọc thời gian, trạng thái loading/error/empty, số liệu đối chiếu BE.

### G10 — Attendance/Training và AI tùy chọn

- [ ] **G10.1** BE sửa GET attendances 500; FE điểm danh theo session và quyền Coach/Receptionist.
- [ ] **G10.2** Nối training plan/result/evaluation API và view theo role.
- [ ] **G10.3** Nếu thêm AI: FE chỉ gọi dịch vụ backend; API key đặt ở server.

## C. Danh sách câu hỏi chặn cần theo dõi với BE

| ID | Câu hỏi/việc BE | Ảnh hưởng | Trạng thái |
|---|---|---|---|
| BE-00 | Cấp/reset ít nhất một tài khoản Admin và một tài khoản Manager hoặc Receptionist đăng nhập được trên môi trường test. | G0.3, G1.2–G1.6 và mọi acceptance API tiếp theo | **Resolved 2026-10-02** — 8 account login 200, đúng role |
| BE-01 | Admin có toàn quyền thực thi ở server không? Seed role/permission có thể không tương đương “toàn quyền”. | G2/G3 | Open |
| BE-02 | Body + enum cho PATCH user role/status, staff/member/subscription status? | G3–G5 | Open |
| BE-03 | `POST /api/members` và `/api/staff` có tự tạo User không? Password khởi tạo ra sao? | G4 | Open |
| BE-04 | `/packages` hay `/subscriptions` là API chuẩn khi đăng ký/gia hạn? Có tự tạo invoice không? | G5 | Open |
| BE-05 | Tự khóa hoặc xóa quyền Admin cuối cùng được chặn không? | G3 | Open |
| BE-06 | Sửa 500 ở dashboard/revenue/invoices/attendances và 403 Member catalog. | G6–G10 | Open |
| BE-07 | Backend triển khai chính thức dùng PostgreSQL hay SQL Server 2019? Cập nhật ERD/DDL/tài liệu tương ứng. | Tài liệu/triển khai | Open |
| BE-08 | Đổi credential DB từng xuất hiện trong tài liệu bàn giao và xóa khỏi bản bàn giao mới. | Bảo mật môi trường | Open |

## D. Prompt mẫu để giao Agent một chặng

Sao chép, thay `Gx` bằng chặng cần thực hiện. Gửi kèm source và **cả hai file `.md`**:

```text
Bạn đang triển khai FE của SCMS bằng React/Vite. Hãy đọc SCMS_FE_IMPLEMENTATION_PLAN.md và SCMS_FE_TASK_CHECKLIST.md, sau đó chỉ thực hiện chặng Gx (mã task ...). Kiểm tra source hiện tại và OpenAPI/test-results trước khi sửa; giữ nguyên thay đổi của người khác.

Yêu cầu:
1. Bám API/role/permission thật; không coi endpoint trong OpenAPI là đã test thành công.
2. Không dùng mock cho thao tác chính trong API mode, không tự giả lập success khi BE lỗi.
3. Có loading/empty/error, giữ form khi lỗi, chỉ cập nhật state sau API thành công.
4. Chạy pnpm build và test các kịch bản nghiệm thu của chặng; nếu bị chặn bởi BE, ghi rõ method/path/status và tiếp tục phần độc lập.
5. Nộp danh sách file sửa, diff/commit, API đã test, cách thử tay, kết quả build/test, bug còn lại. Đặt task ở trạng thái Ready for review nhưng không đánh dấu [x] trong checklist. Không tự làm chặng tiếp theo.
```

## E. Phân vai và bàn giao kế tiếp

- **Reviewer/Codex:** làm theo `SCMS_FE_REVIEWER_TASKS.md`; chỉ review độc lập, phản hồi finding và sửa giới hạn khi chủ dự án yêu cầu.
- **Implementation Agent:** làm theo `SCMS_FE_IMPLEMENTATION_AGENT_TASKS.md`; chỉ triển khai task được giao, cập nhật `AGENT_TASK_REPORT.md`, rồi dừng chờ review.
- **Gate hiện tại:** **G2 Approved; G3 Open for planning / Not started**.
- **Task triển khai kế tiếp:** Chuẩn bị bàn giao G3.1–G3.7 theo thứ tự trong checklist. Chưa triển khai mutation G3 cho đến khi Chủ dự án giao task rõ ràng cho Implementation Agent.
- **Quy tắc checkbox:** Checklist được cập nhật theo nghiệm thu chính thức của Chủ dự án. Task bị BE chặn phải ghi nhận trung thực.
