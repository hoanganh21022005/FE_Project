# Center Manager Business Logic Audit — SCMS · VIBE SPORT

**Ngày audit:** 2026-11-03
**Phạm vi:** Frontend Center Manager, API adapters/contracts có sẵn trong workspace, route/permission checks, mapper, validation, error state và tests liên quan.
**Loại công việc:** read-only audit. Không sửa source, không gọi API, không thử mutation, không commit/push/deploy.

## A. Executive summary

Workspace có giao diện và API caller cho phần lớn khu vực vận hành Manager: dashboard, nhân viên, hội viên, môn/phòng, lớp, ngày nghỉ, xử lý lịch, gói, hóa đơn, báo cáo và nhật ký. Source cho thấy một số luồng chỉ được tích hợp ở FE; không có backend source, OpenAPI contract hoặc runtime evidence cục bộ để xác nhận server đã triển khai, payload có khớp, role có được phép, hay validation/side effect có đúng.

Do không tìm thấy SRS/requirements đã phê duyệt, không thể đếm tổng số requirement nghiệp vụ hoặc kết luận một chức năng thiếu/thừa so với yêu cầu đã chốt. Mười hai nhóm trong prompt được dùng làm danh sách audit, không được coi là specification đã phê duyệt.

| Kết quả có thể kết luận từ bằng chứng hiện có | Số lượng / trạng thái |
|---|---:|
| Nhóm nghiệp vụ được rà soát theo checklist | 12 |
| Requirement tổng đã xác định từ tài liệu phê duyệt | **Không xác định — không tìm thấy requirement inventory/SRS** |
| FE logic/error-state findings evidenced in source | 6 primary findings in Section E; no runtime confirmation |
| Hành vi có UI nhưng bị FE chặn/không có API caller trong flow Manager | 3 mục được ghi riêng trong mục G |
| Vi phạm quyền đã được chứng minh | **0** — BE authorization không có bằng chứng; có rủi ro cần product decision |
| Flow đã được xác minh end-to-end với Backend | **0** |
| Blocker/giới hạn do FE chủ động ghi nhận | Draft Normal trên API mode; xóa Class trên API mode; gán/đăng ký gói tại chi tiết Member trên API mode |

**Ưu tiên xử lý:** xác nhận ma trận quyền và người được phép tạo/chỉnh sửa tài khoản Manager; chốt phạm vi quyền của Manager với membership/Advanced; sửa các filter ngày hard-code và các màn hình đang biến lỗi tải thành trạng thái rỗng; xác nhận contract backend cho lớp, phòng và incident trước khi đánh giá hoàn tất.

### Trạng thái bằng chứng

- **FE integrated:** source có caller tới API adapter; chưa chứng minh contract/server.
- **UI only / blocked:** có UI nhưng source không gọi mutation trong API mode hoặc source tự trả lỗi “unsupported”.
- **NOT SPECIFIED:** không tìm thấy quyết định nghiệp vụ được phê duyệt.
- **NOT VERIFIED:** chưa có bằng chứng runtime/API thật.
- **Needs Product Decision:** có hành vi quan trọng nhưng tài liệu quyền/nghiệp vụ không chốt.
- **BLOCKED BY BACKEND (theo FE):** frontend tự mô tả hoặc chủ động chặn do giới hạn Backend; chưa được xác nhận bằng Backend source/OpenAPI/runtime.

## B. Tài liệu đã tìm và chưa tìm thấy

### Tìm thấy

- `docs/SCMS_BE_FE_WORKFLOW.md`: mô tả Backend và Frontend ở hai repository, OpenAPI/Swagger là contract giao tiếp; tài liệu quy trình yêu cầu test end-to-end trước khi coi flow là DONE. Đây là hướng dẫn quy trình, không phải SRS/RBAC Manager.
- `README.md`, `PRODUCT.md`, `DESIGN.md`: có thông tin tổng quan/thiết kế, không tìm thấy business requirements hoặc permission matrix đã duyệt cho Manager.
- `plans/g2-admin-portal/plan.md`, `plans/g2-review-remediation/plan.md`, `plans/reports/brainstorm-2026-10-03-g2-admin-portal.md`: phạm vi Admin portal/G2; không dùng làm quyết định nghiệp vụ cho Center Manager.
- FE tests có liên quan: `test/fe04_mappers_test.mjs`, `test/fe06_package_management_test.mjs`, `test/fe07_reports_test.mjs`, `test/fe08_invoice_api_test.mjs`, `test/fe09_holidays_incidents_test.mjs`, `test/fe10_normal_class_test.mjs`, `test/fe11_integration_regression_test.mjs`, `test/fe12_package_subject_pricing_test.mjs`. Đây là source của test; test dùng response stub/mocked request không chứng minh Backend runtime.

### NOT FOUND trong workspace

Không tìm thấy `AGENTS.md`; SRS; `Member.pdf`; `Problem.docx`; `00-MASTER-CHECKLIST.md`; `01-API-CONTRACT-FE-BE.md`; `04-DEBUG-NOTE.md` và `04-DEBUG-NOTE (1).md`; `api.txt`/OpenAPI JSON; API inventory; Use Case Diagram/Specifications; Business Rules; RBAC/Permission Matrix; tài liệu phân chia role; quyết định nhóm về Normal/Advanced; báo cáo FE/BE audit cũ được liệt kê trong yêu cầu.

Tài liệu workflow có nhắc URL Swagger/OpenAPI của Backend, nhưng yêu cầu audit cấm test trực tiếp Render. Audit này không truy cập URL đó. Backend source/repository cũng không nằm trong workspace FE. Vì vậy trạng thái **DOCUMENTED**, **IMPLEMENTED ở BE**, **BE validation/error contract**, và **RUNTIME VERIFIED** đều **NOT VERIFIED**.

### Conflicts

Không có hai nguồn requirements đã duyệt để lập conflict nghiệp vụ. Có các điểm cần team xác nhận thay vì tự chọn: thời hạn/ân hạn 72 giờ hiển thị trong Settings nhưng không có nguồn policy; Manager có thể chọn role Manager trong form nhân sự; danh sách package bị ẩn theo ID tĩnh; Manager có nên được gán/renew membership và hỗ trợ luồng Advanced hay không. Đây là **unresolved decisions**, chưa phải conflict giữa hai quyết định chính thức.

## C. Business requirements matrix — 12 nhóm

| Nhóm | Hiện trạng FE | Contract/quyền | Kết luận audit |
|---|---|---|---|
| A. Dashboard | 8 KPI lấy từ `/api/reports/dashboard`; thêm lịch hôm nay, revenue chart, class distribution từ API/context. | KPI definition và phép tổng hợp BE không có contract trong workspace. | **FE integrated, NOT VERIFIED.** Không kết luận `totalPackages = 0` và `activeSubscriptions = 11` là lỗi: hai KPI có thể có định nghĩa khác nhau; cần owner xác nhận semantics. |
| B. Staff | Danh sách/tìm kiếm/lọc, tạo/sửa, trạng thái Active/Locked/Inactive; Coach specialization được gửi trong staff request. | `/api/staff` caller có; permission server không có bằng chứng. Form tạo/sửa cho chọn role `manager`. | **FE integrated; role governance Needs Product Decision.** Không thấy UI Manager tạo Admin hoặc chỉnh RBAC. |
| C. Member | Danh sách/tìm kiếm/lọc theo membership state, tạo member, xem chi tiết và history subscriptions. | `/api/members`, `/api/members/{id}`, `/api/members/{id}/subscriptions`; gán/renew trong manager detail bị chặn ở API mode. | **Partial.** Membership error bị hiển thị như không có history; action gán gói là UI nhưng không hoạt động trong API mode. |
| D. Subjects | CRUD môn, status, Normal/Advanced price; UI hiển thị `outdoor` từ response. | `buildSubjectRequest` không gửi `outdoor`; API caller gửi các field khác. | Nếu Manager phải cấu hình Indoor/Outdoor theo yêu cầu đã duyệt thì **FE payload/UI thiếu field**; hiện requirement **NOT SPECIFIED**. Delete side effects không xác minh được. |
| E. Rooms | CRUD phòng, capacity, facility type, status Available/Maintenance/Closed. | Request builder validate capacity dương và enum; đổi trạng thái gửi PATCH. UI dịch lỗi Backend về session tương lai. | **FE integrated.** Không có evidence xác nhận compatibility, session reassignment/cancel, lịch sử, hoặc bảo vệ object-level ở BE. |
| F. Normal classes | Tạo class; flow API tạo atomically dự kiến 12 sessions, rồi GET đối soát; sửa/đổi trạng thái, hủy, bulk actions; filter/search/export CSV. | FE gọi `POST /api/classes/normal-with-sessions`, GET sessions để xác minh; Draft bị chặn bởi FE trên API mode; DELETE class không được gọi. | **Partial / NOT VERIFIED.** Có lỗi filter ngày cố định; bulk status có thể cập nhật một phần; Draft và delete là blocker do FE ghi nhận. |
| G. Advanced | Manager quản lý package type/credit và xem subscription history. Coach/member có các flow Advanced riêng. | Manager detail không gọi `subscribePackage`; API mode trả “temporarily unavailable”. Không có caller Manager tìm thấy cho consent, credit adjustment/refund, extension do sự cố. | Các thao tác Manager trong checklist **NOT SPECIFIED**; assign/renew hiện **UI ONLY/BLOCKED IN FE**. Không suy ra policy chỉ từ flow Coach/Member. |
| H. Schedule/incidents | Lọc session; dời session, đổi phòng theo slot, thay Coach; ngày nghỉ có create/toggle và kiểm tra trùng ngày. | Caller `/api/sessions`, reschedule/substitute, `/api/holidays`; `MANAGE_CLASSES` được check trên mutation holiday/incident. | **Partial FE integrated.** UI xử lý session, không phải incident case queue; consent, notifications, make-up credits, near-time exception/audit side effects chưa có contract/runtime evidence. |
| I. Packages | Normal/Advanced, create/edit/status, hiển thị tuition theo subject. Không có xóa package trong manager API adapter. | `/api/packages` GET/POST/PUT/PATCH status; UI mutation gated theo `MANAGE_PACKAGES` hoặc `*`. | **FE integrated, NOT VERIFIED.** ID 1,2,3,4,5,9 và package `price === 0` bị ẩn; rationale/approved list không có trong workspace. |
| J. Invoice/payment | Manager có trang list/filter/detail hóa đơn; source của Manager screen chỉ GET invoice/list/detail. Reception payments có cash confirmation gate bằng `MANAGE_INVOICES`. | GET `/api/invoices`; Receptionist POST `/api/invoices/{id}/confirm-cash`. BE permission chưa xác minh. | Manager screen hiện read-only; đây là cách phân vai FE đang thể hiện, chưa đủ bằng chứng kết luận policy. Không thấy Manager sửa amount/status/confirm cash từ màn hình này. |
| K. Reports | Revenue report filter ngày/grouping; member report; dashboard trend. | `/api/reports/revenue`, `/api/reports/members`; export button trên ReportsView không có handler. | **Partial.** Export là **UI ONLY**. Class report chưa tìm thấy; chưa coi là thiếu yêu cầu vì không có SRS. |
| L. Audit logs & Settings | Manager route audit logs dùng dữ liệu Context; Settings đổi language, hiển thị 72h và rule attendance tĩnh. | `/api/audit-logs` GET được gọi; trang không nhận error state. Settings route dùng chung và không gọi settings API. | Audit logs **có route/caller**, không kết luận thiếu chỉ vì 403; lỗi tải có thể bị nhầm với danh sách rỗng. Cấu hình vận hành là **static UI**, policy/role **NOT SPECIFIED**. |

## D. Findings cần xử lý

### E. Incorrect business logic / lỗi hiển thị có bằng chứng trong source

| ID | Priority | Expected | Actual và evidence | FE/BE; độ tin cậy |
|---|---|---|---|---|
| CM-01 | P2 | Bộ lọc Today/This week/Next week/This month/Next month phản ánh ngày hiện tại. | `src/components/views/ClassManagement.jsx:158-185`: Today so sánh literal `2026-10-12` hoặc `2026-10-10`; tuần cố định 12–18 và 19–25/10/2026; tháng cố định 10/2026 và 11/2026. Theo ngày audit 03/11/2026, lựa chọn Today/This week không đại diện cho ngày/tuần hiện tại. Ngày không parse được còn được trả `true` tại line 163 nên lọt vào mọi date filter. | FE; **đã xác nhận bằng source**, chưa runtime. |
| CM-02 | P2 | Lỗi tải membership history được phân biệt với “không có subscription”. | `src/components/views/MemberDetailView.jsx:128-142` catch lỗi chỉ log ra console rồi `setSubscriptions([])`; `:551-554` hiển thị empty state “No subscription records found.” | FE; **đã xác nhận bằng source**. |
| CM-03 | P2 | Lỗi tải package list được phân biệt với danh sách thực sự rỗng. | `src/components/views/PackageManagement.jsx:140-160` lưu lỗi subjects nhưng không có package error state; khi `getPackages` rejected thì `apiPackages` vẫn `[]`, `packageLoading` kết thúc và trang có thể hiện empty state như không có gói. `src/api/packagePricing.js:39-53` trả kết quả rejected cho caller nhưng UI không lưu lỗi package. | FE; **đã xác nhận bằng source**, cần xác nhận trạng thái empty cụ thể trong UI runtime. |
| CM-04 | P2 | Nút Export report phải xuất report hoặc không được trình bày như thao tác khả dụng. | `src/components/views/ReportsView.jsx:147-149`: nút Export không có `onClick`, form submit handler hoặc export callback. | FE; **UI only**, source xác nhận không có action. |
| CM-05 | P2 | Bulk status update cần cho biết rõ các bản ghi đã cập nhật nếu một phần thất bại. | `src/components/views/ClassManagement.jsx:1604-1631` và `:1634-1658`: cập nhật tuần tự từng Class; nếu request giữa chừng lỗi, các request trước đã thành công nhưng UI chỉ báo lỗi chung, không báo số bản ghi đã đổi/rollback. | FE integration risk; **code path xác nhận**, tác động BE phụ thuộc response thật. |
| CM-14 | P2 | Audit log page must distinguish an empty list from a load failure/403. | SCMSContext records getAuditLogs failures in managerDataError (SCMSContext.jsx:1538-1543), but AuditLogView reads only auditLogs (AuditLogView.jsx:58-65); the page can look empty on an error. | FE behavior confirmed from source. This does not prove the endpoint or audit logging is missing. |

### F. Duplicate functionalities

Không tìm được cặp hai chức năng Manager chắc chắn trùng mục đích theo một requirement được duyệt. Một số nơi cùng thao tác package/subscription ở portal Member, Coach và Manager; chúng phục vụ actor khác nhau nên chưa đánh dấu Duplicate. Cần use case được duyệt trước khi phân loại.

### G. UI-only / Backend blockers theo source FE

| ID | Tính năng | Evidence | Hệ quả / trạng thái |
|---|---|---|---|
| CM-06 | Gán/renew package từ chi tiết Manager Member | `src/components/views/MemberDetailView.jsx:493-506` hiện nút; `:827-856` chỉ tải danh sách package; `:862-881` khi `apiEnabled` luôn đặt lỗi “Package subscription mutation is temporarily unavailable.” `membershipApi.subscribePackage` tồn tại ở `src/api/membershipApi.js:78`, nhưng không được gọi bởi Manager flow này. | Không tạo subscription trong API mode. **UI ONLY/BLOCKED IN FE**, không báo thành công giả. Requirement Manager làm thao tác này **NOT SPECIFIED**. |
| CM-07 | Xóa Class trong API mode | `src/context/SCMSContext.jsx:2914-2922` trả `unsupported: true`, thông báo FE “Backend does not support class deletion yet”, không gửi DELETE. `src/components/views/ClassManagement.jsx:1754-1775` đóng confirm dialog khi nhận failure. | Tác vụ không thực hiện trong API mode; API contract/BE support **NOT VERIFIED**. Xóa trong mock chỉ thay đổi localStorage. |
| CM-08 | Lưu Normal Class ở Draft trong API mode | `src/api/normalClassCreation.js:3-7` ghi API không hỗ trợ Draft; `src/components/modals/NewClassModal.jsx:1819-1828` disable submit Draft khi API mode. | FE hiện block Draft; đây là statement/guard của FE, chưa có BE source/OpenAPI độc lập để xác nhận giới hạn hiện hành. |

### H. Excess / wrong-role / Needs Product Decision

| ID | Vấn đề | Bằng chứng | Phân loại |
|---|---|---|---|
| CM-09 | Manager có thể chọn tạo nhân viên role Manager; Edit Staff cũng cho đổi role theo form. | `src/components/modals/NewStaffModal.jsx:251-268` gồm `coach`, `receptionist`, `manager`; `src/api/staffMappers.js` map `manager` thành `CenterManager`; route staff chỉ guard role Manager tại `src/App.jsx:863-873`. | Có khả năng cấp quyền Manager bởi Manager. Không có RBAC/owner decision/BE auth để chứng minh hành vi này được phép hay bị chặn. **Needs Product Decision; chưa kết luận vulnerability.** Không thấy lựa chọn Admin trong form này. |
| CM-10 | Subject `outdoor` được đọc nhưng không thể đặt qua form/request Manager. | `src/api/mappers.js:30-38` map `subject.outdoor`; `src/api/resourceRequests.js:25-43` request builder không gửi field `outdoor`; `src/components/views/ResourceManagement.jsx:7-12` form môn không có thuộc tính này. | Nếu Indoor/Outdoor là requirement đã duyệt thì **FE gap**; hiện **NOT SPECIFIED** do SRS thiếu. |
| CM-11 | Package bị ẩn theo ID hard-code và giá 0. | `src/api/packagePricing.js:13-20`: ẩn IDs `1,2,3,4,5,9` và mọi item `price === 0`. | Có thể là ẩn legacy data theo quyết định trước, nhưng không tìm thấy allowlist/owner decision trong tài liệu. **Needs Product Decision**, không gọi là thừa/sai khi chưa biết dữ liệu/IDs hiện tại. |
| CM-12 | Settings mô tả tham số vận hành nhưng không đọc/lưu cấu hình. | `src/components/views/SettingsView.jsx`: chỉ `setLanguage`; 72h và yêu cầu lý do điểm danh là literal UI. Route `/settings` common trong `src/App.jsx:1352-1355` và Admin route riêng. | Nếu đây là policy thật, cần nguồn chính thức; hiện **static UI**, không chứng minh cấu hình. Có thể gây hiểu nhầm là tham số đang có hiệu lực. **NOT SPECIFIED**. |
| CM-13 | Subject pricing có thể coi `null`/`undefined` là “khác 0”. | `src/api/packagePricing.js:23-27`: `subjectPriceForType(...) !== 0` giữ lại `null`/`undefined`. | Với response thiếu giá, section có thể đưa môn không có giá vào danh sách được mô tả “tuition above 0”. **FE logic defect có điều kiện theo response**; chưa xác minh dữ liệu thực tế. |

## I. Route, role, permission audit

### Matrix theo FE

| Role | FE route/action thấy được | Check tại FE | Backend/object-level authorization |
|---|---|---|---|
| ADMIN | `/admin/users`, `/admin/roles`, `/admin/audit-logs`; `adminApi` gồm user/role/permission mutations. | `/admin/*` bị giới hạn `ROLE_ADMIN` ở `src/App.jsx:831-841`; portal Admin ở `:690-791`. | Chỉ biết FE route guard; BE chưa có source/contract/runtime. |
| CENTER MANAGER | Các route `/manager/dashboard`, staff, members/detail, packages, classes, holidays, session-incidents, resources, payments, reports, audit-logs. Sidebar thấy ở `src/components/layout/Sidebar.jsx:43-75`; route guard tương ứng `src/App.jsx:844-1007`. | Tất cả Manager routes guard `ROLE_MANAGER`. Granular checks chỉ thấy rõ: `MANAGE_CLASSES` ở holidays/incident (`ManagerHolidaysView.jsx:24,82-85`; `ManagerSessionIncidentsView.jsx:36,163-176,266`); `MANAGE_PACKAGES` ở package actions (`PackageManagement.jsx:138,195-206`). Những route/action staff/member/resources/class/report/audit không có granular FE guard được tìm thấy. | **NOT VERIFIED.** FE guard không thay thế BE permission checks. Chưa biết Manager role/authorities nào phải có. |
| RECEPTIONIST | Reception payments/check-in and Reception routes. | `ReceptionPaymentsView.jsx:91-97` yêu cầu `MANAGE_INVOICES` trước thao tác cash; confirm gọi `POST /api/invoices/{id}/confirm-cash` ở `:354`. | BE 401/403/object authorization chưa xác minh. |
| COACH | Coach schedule, attendance, assigned members/training. | Các route FE theo Coach; quyền hoạt động theo role ở App. | Không suy ra quyền Manager từ Coach flows. BE chưa xác minh. |
| MEMBER | Member self-service, own invoices/subscription/booking. | Routes theo Member; own endpoint dùng current session ở API helpers. | Backend object ownership chưa xác minh trong audit này. |

**Truy cập trực tiếp URL:** FE `RequireRole` áp dụng các Manager path kể trên, nhưng không có browser/runtime test trong audit. **API 401/403, session cookie, object-level authorization:** chưa thử vì cấm gọi môi trường live và không có BE source. `httpClient` gửi `credentials: 'include'`, dispatch event 401/403 khi không bị tắt (`src/api/httpClient.js:20-79`); nhiều Manager caller đặt `notifyForbidden:false`, nên view phải tự giữ error state.

**Sai phân quyền đã xác nhận:** không có kết luận nào đủ bằng chứng. **Rủi ro ưu tiên:** role Manager có thể chọn role Manager khi tạo/sửa staff; các thao tác member/class/resource/staff không có granular FE authority gate trong khi holidays/incidents/packages có gate riêng. Cần matrix chính thức và xác nhận BE enforcement, không thử mutation.

## J. FE/API coverage matrix

Các endpoint dưới đây được đọc từ FE source, **không phải xác nhận OpenAPI**. Backend handler/validation/error response/permission đều **NOT VERIFIED** nếu không ghi chú khác.

| Nghiệp vụ | FE method + endpoint | Payload / response được FE dùng | Permission/validation trong FE | Tích hợp |
|---|---|---|---|---|
| Dashboard | `GET /api/reports/dashboard` | `mapDashboard`: `totalUsers`, `totalMembers`, `totalClasses`, `totalPackages`, `totalRevenue`, `totalInvoices`, `activeSubscriptions`, `todaySessions` (`src/api/mappers.js:336-345`). | API mode hiển thị `—` khi null, không fallback KPI mock (`ManagerDashboard.jsx:35-65`). | FE integrated; semantics/aggregation **NOT VERIFIED**. |
| Session list | `GET /api/sessions` với filters `classId, coachId, roomId, startDate, endDate, status`; lịch hôm nay lọc/sắp xếp các session (`managerApi.js:75-82`; `ManagerDashboardInsights.jsx:109-120,140-143`). | FE map id/class/subject/coach/room/date/time/status/enrolled/maxCapacity/isPrivate (`mappers.js:51-72`). | Page-level Manager guard; no BE confirmation. | FE integrated. |
| Staff | `GET /api/staff`; `POST /api/staff`; `PUT /api/staff/{id}`; `PATCH /api/staff/{id}/status` (`staffApi.js:5-30`). | Request whitelist name/email/role/phone/specialization (`staffMappers.js:77-127`); response mapped id/role/spec/status. | Required name/email/role; manager form role set includes `CenterManager`; server permission unknown. | FE integrated. |
| Member | `GET /api/members`, `GET /api/members/{id}`, `POST /api/members`, `PUT /api/members/{id}`, `PATCH /api/members/{id}/status` (`memberApi.js:5-39`). | Whitelisted name/email/contact/profile/health fields/status/password; excludes packageId per mapper comment (`memberMappers.js:52-102`). | FE requires name/email; server object permission unknown. | FE integrated; profile/privacy scope not specified. |
| Subscriptions | `GET /api/members/{id}/subscriptions` (`membershipApi.js:66-76`). Manager mutation helper exists separately (`POST /api/members/{id}/packages`) but Manager detail does not call it. | Subscription id/package/status/date mapped by membership mapper. | Manager action API mode intentionally blocks. | History FE integrated; Manager assign UI only. |
| Subjects | `GET/POST /api/subjects`, `PUT /api/subjects/{id}`, `DELETE /api/subjects/{id}` (`managerApi.js:33-39`). | Request name, description, status, slug, normalPrice, advancedPrice; no `outdoor` (`resourceRequests.js:25-43`). | Name required; prices non-negative or null; active zero/missing price shows confirm warning. | FE integrated; schema/cascade not verified. |
| Rooms | `GET/POST /api/rooms`, `PUT /api/rooms/{id}`, `PATCH /api/rooms/{id}/status` (`managerApi.js:41-48`). | Name/location/capacity/status/facilityType (`resourceRequests.js:45-67`). | Capacity positive integer; enum Available/Maintenance/Closed and Indoor/Outdoor. | FE integrated; future-session guard appears to rely on Backend error message, contract not available. |
| Normal Class | `POST /api/classes/normal-with-sessions`; `GET /api/sessions?classId=…` then fallback `/api/sessions/catalog/{id}` (`managerApi.js:126-228`). | requestId, sportsClass, roomId, daysOfWeek, startTime/endTime; Class includes Normal and totalSessions=12 (`normalClassCreation.js:40-132`). Response class id required; then require 12 non-cancelled sessions (`:135-203`). | FE checks room/subject/time/capacity/conflicts; BE validation unverified. Idempotency conflict recognizes 409/code. | FE integrated with read-after-write verification; BE atomicity/runtime not verified. |
| Class edit/status/coach | `PUT /api/classes/{id}`; `PATCH /api/classes/{id}/coach` (`managerApi.js:239-246`). | Class request mapped from FE data; coachId numeric. | FE preflight conflict check against loaded `classes`; backend concurrency/complete conflict check unknown. | FE integrated. |
| Holiday/incident | `GET/POST /api/holidays`; `PATCH /api/holidays/{id}/toggle`; `POST /api/sessions/{id}/reschedule`; `POST /api/sessions/{id}/substitute-coach` (`managerApi.js:54-112`). | Holiday date/name/tag/active; reschedule newDate/newStartTime/newEndTime/newRoomId/reason; substitute newCoachId/reason. | `MANAGE_CLASSES` FE check; duplicate holiday date and required fields validated; session slot/room/capacity checks locally. | FE integrated; consent/notification/audit side effects not verified. |
| Packages | `GET/POST /api/packages`; `PUT /api/packages/{id}`; `PATCH /api/packages/{id}/status` (`managerApi.js:248-251`). | Name, type, price, durationDays, totalCredit, benefits/status per package form/mapper. | UI writes require `MANAGE_PACKAGES` or `*`; price/credit business rules only FE form. | FE integrated. No delete caller found. |
| Invoices | `GET /api/invoices` with status/method/keyword/date filters; `GET /api/invoices/{id}`. Reception cash confirmation `POST /api/invoices/{id}/confirm-cash` (`invoiceApi.js:10-42,68-74`). | Invoice mapper reads ids, member/package, amount, method/status/date; filter maps UI `successful` to `Paid`, `online` to `VNPay` (`PaymentManagement.jsx:82-117`). | Manager screen read-only. Cash action requires FE authority `MANAGE_INVOICES`; BE permission unknown. | Manager read integration; cash confirmation in Reception flow only. |
| Reports | `GET /api/reports/revenue?startDate&endDate&groupBy`; `GET /api/reports/members` (`managerApi.js:254-263`). | Revenue totals/timeline/by package/by method; member counts/distribution/growth (`mappers.js:347-386`). | Start date <= end date client check; view labels revenue as paid-only. | FE integrated; export action UI only. |
| Audit logs | `GET /api/audit-logs` (`managerApi.js:264-267`, Context `SCMSContext.jsx:1538-1543`). | List is mapped, local text filter; no backend pagination/filter in the Manager view found. | Manager role route only; `VIEW_AUDIT_LOG` policy not established. | Caller/route exist; runtime permission unknown. |

### Contract / response/error assessment

- Payloads/response fields above describe only FE builders and mappers. Không có API contract đang hiệu lực để đối chiếu `required`, enum, nullability, pagination, status code, consent, conflict response hay transaction semantics.
- `httpClient` gửi JSON/cookie, chuyển response không thành công thành `ApiError`, dispatch unauthorized/forbidden events theo tùy chọn (`src/api/httpClient.js:20-79`). Các view có catch/error UI khác nhau; không có bằng chứng BE thực sự trả đúng 400/401/403/409 cho các case cụ thể.
- Normal Class xử lý idempotency conflict và hậu kiểm 12 sessions. Nếu POST đã tạo Class nhưng GET xác minh lỗi/đếm thiếu, FE trả failure; source không thể chứng minh server rollback hoặc lần retry có hành vi exactly-once. Cần contract và test BE cho trường hợp này.

## K. Top 10 issues/risks cần ưu tiên

Thứ tự dưới đây xếp theo tác động tiềm năng và độ chắc chắn; các mục “Needs Decision” chưa phải lỗi đã xác nhận.

| # | ID | Priority | Tác động | Loại bằng chứng |
|---:|---|---|---|---|
| 1 | CM-09 | P1 candidate | Manager tạo/sửa tài khoản có role `CenterManager`; nếu không được policy cho phép có thể mở rộng đặc quyền. | Needs Product Decision; chưa xác nhận BE. |
| 2 | CM-06 | P1 nếu thuộc scope | Nút gán/renew ở member detail không hoàn thành trong API mode; membership history cũng có thể báo rỗng khi API lỗi. | UI blocked + CM-02 FE confirmed. |
| 3 | CM-01 | P2 | Filter khoảng thời gian hiển thị sai kết quả cho ngày hiện tại ngoài tháng 10/2026. | FE logic confirmed. |
| 4 | CM-03 | P2 | Lỗi `GET /api/packages` có thể bị hiểu nhầm là trung tâm chưa có gói. | FE error-state gap confirmed in source. |
| 5 | CM-05 | P2 | Bulk update có thể hoàn tất một phần, thông báo chung không nêu partial success. | FE flow confirmed; backend outcomes unknown. |
| 6 | CM-04 | P2 nếu export là requirement | Export ở Reports không có handler. | UI-only confirmed. |
| 7 | CM-07 | P2 nếu xóa Class cần dùng | Action xóa hiển thị nhưng API mode không có request; FE tự trả unsupported. | Blocked by FE statement; BE contract absent. |
| 8 | CM-10 | P2 conditional | Không tạo/chỉnh `outdoor` cho Subject từ Manager UI/request dù mapper dùng dữ liệu đó. | Source confirmed; requirement not found. |
| 9 | CM-11/CM-13 | P2 conditional | Package ẩn theo ID cố định; subject price null có thể lọt vào danh sách “giá > 0”. | Filtering code confirmed; package policy/data unknown. |
| 10 | CM-14 | P2 | Audit log access failures can look like an empty log table; users cannot distinguish 403/no data. | FE error-state confirmed; endpoint availability is not established by this finding. |

## L. Implementation roadmap đề xuất (chưa thực hiện)

| Thứ tự | Owner | Dependency | Priority | Acceptance criteria / tests cần bổ sung |
|---|---|---|---|---|
| 1. Chốt RBAC | Product/Owner + BE + FE | Permission matrix cho Manager, Admin, Receptionist; quyền `MANAGE_*`, audit read, tạo Manager | P1 | Có matrix được duyệt; BE tests cho role/authority/object ownership; FE direct-route/action visibility phù hợp. Không dùng FE guard làm security boundary. |
| 2. Chốt scope membership/Advanced Manager | Product + BE + FE | Use case Manager vs Coach/Member/Receptionist; consent, audit, credit/expiry rules | P1 | Mỗi action có actor, endpoint, transition/status, validation, audit/notification, errors; UI chỉ hiện khi flow có contract. |
| 3. Cung cấp OpenAPI/BE evidence | BE | Contract đang hiệu lực, handlers, 400/401/403/409 schema, pagination, transactions | P1 | Đối chiếu API matrix; contract tests cho các caller FE; ghi endpoint không hỗ trợ thành backlog/blocked. |
| 4. Sửa date filters + bulk partial result | FE (BE nếu cần bulk endpoint) | Quy tắc timezone/week start và desired bulk atomicity | P2 | Test Today/week/month với fixed clock và invalid dates; bulk failure test cho phần thành công/thất bại/refresh. |
| 5. Phân biệt lỗi và empty state | FE | Không cần BE nếu contract đã có | P2 | Package/member history/audit logs thể hiện lỗi tải riêng, không hiển thị “không có dữ liệu” sau 403/network/5xx. |
| 6. Chốt Subject/Room/Class lifecycle | Product + BE + FE | Outdoor field, class Draft/delete, room-in-use, class cancel/reassign/history policies | P2 | Request schema được duyệt; BE rules và tests không xóa lịch sử/cascade ngoài policy; FE chỉ báo success từ response thật. |
| 7. Chốt package visibility/pricing | Product/Owner + FE | Danh sách legacy package ID chính thức, `price=0/null` semantics | P2 | Dùng trạng thái/flag nghiệp vụ thay IDs tĩnh nếu được duyệt; tests cho zero/null/missing and Normal/Advanced. |
| 8. Reports export | FE | Định dạng/columns/filters export được yêu cầu | P2/P3 | Nút hoạt động với đúng dataset/filter hoặc ẩn; test nội dung/export data. |
| 9. Settings | Product + FE/BE | Nguồn policy thực thi và actor có quyền chỉnh | P2/P3 | Static policy được gắn nguồn/cập nhật từ API; hoặc đổi copy thành thông tin tham khảo rõ ràng. |
| 10. Runtime E2E | FE + BE + QA | Test environment được phép, user role test, API contract | Sau khi contract/chính sách chốt | Tạo flow read-only trước; mutations chỉ trong môi trường test được ủy quyền; kiểm tra 401/403/409, transaction, read-back, audit log/notification. |

## M. Unresolved questions cho team

1. Manager có được tạo hoặc đổi nhân viên sang role Center Manager không? Ai được phép tạo Admin, đổi role và reset mật khẩu?
2. Manager có cần gán/renew subscription, tạo Advanced order, chấp nhận consent, sửa credit/expiry hoặc ghi lý do/audit không? Các thao tác nào thuộc Coach/Receptionist/Member?
3. `MANAGE_CLASSES`, `MANAGE_PACKAGES`, `MANAGE_INVOICES`, `VIEW_AUDIT_LOG` là các authority đang có hiệu lực nào? BE gắn chúng với Manager role ra sao?
4. Định nghĩa cụ thể của 8 dashboard KPI là gì, đặc biệt `totalInvoices` có chỉ đếm Paid không và `totalPackages` có bao gồm inactive/legacy không? `totalPackages=0`, `activeSubscriptions=11` có thể hợp lệ theo định nghĩa nào?
5. Indoor/Outdoor được chỉnh ở Subject hay Room? Field/enum hiện hành trong API contract là gì?
6. Normal Class bắt buộc 12 sessions trong mọi trạng thái hay chỉ Open? API Draft/delete/soft-delete có tồn tại không? Nếu verification GET fail sau POST thì xử lý/idempotency được đảm bảo thế nào?
7. Room đang có session tương lai khi chuyển Maintenance/Closed thì rule chính thức là từ chối, reassignment hay hủy? Ai thông báo cho Member và ghi audit?
8. Incident flow cần object riêng, consent, cancellation, make-up credit, expiry extension, audit và notification nào? Quy tắc 12h/24h đang hiệu lực là gì?
9. Các Package ID 1,2,3,4,5,9 là legacy đã ngừng bán được duyệt ẩn vĩnh viễn hay chỉ là dữ liệu test? `price=0/null` nghĩa là miễn phí, chưa cấu hình hay không hợp lệ?
10. Settings 72 giờ và bắt buộc nhập lý do attendance là policy thật hay mock/static copy? Ai được sửa?
11. Manager invoice screen được phép xem những trường nào (email/phone, payment details, audit)? Có quyền export hay chỉ xem?
12. Logs/reports có pagination, retention/filter/export requirement nào? Endpoint Manager audit log có bị 403 do permission hay do backend chưa bật? Cần contract hoặc evidence authorized, không suy luận từ 403.

## N. Validation và thay đổi workspace

- Audit không gửi request đến Backend/Render và không chạy thao tác ghi.
- Không chạy tests hoặc browser/live matrix. Các file test nêu trên được đọc như evidence test design, không được xem là runtime acceptance.
- `npm.cmd run build`: PASS; `npm.cmd run build:local`: PASS; `git diff --check`: PASS. Hai build ghi output vào thư mục `dist` (ignored/generated); không chạy tests hoặc browser/live matrix.
- Trạng thái Git được đọc trước khi tạo report: đã có thay đổi chưa commit trong `src/components/layout/Sidebar.jsx`, `src/components/modals/EditStaffModal.jsx`, `src/components/views/ClassManagement.jsx`, `src/components/views/ManagerDashboard.jsx`, và `src/components/views/ManagerDashboardInsights.jsx` chưa theo dõi. Audit không chỉnh các source này. File được tạo trong lượt này duy nhất là `docs/audits/CENTER_MANAGER_BUSINESS_AUDIT.md`.
