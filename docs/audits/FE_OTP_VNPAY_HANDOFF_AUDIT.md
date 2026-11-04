# FE OTP & VNPay Handoff Audit

**Ngày audit:** 2026-11-05  
**Nhánh:** `HoangAnh`  
**Phạm vi:** Frontend đăng ký/xác minh Email OTP, đăng nhập sau xác minh, thanh toán VNPay, return hóa đơn và QueryDR.  
**Phương pháp:** Static audit source, OpenAPI/contract review và test mock cục bộ. Không gọi Render/API thật, không đăng ký tài khoản, không gửi OTP, không tạo giao dịch, không sửa source, không commit/push/deploy.

## A. Executive Summary

| Hạng mục | Kết luận |
|---|---|
| Email OTP | **PASS luồng đăng ký thành công theo handoff; PARTIAL toàn bộ chức năng.** Handoff ghi nhận OTP email thật, verify 204, account Active, login trả đúng Member và vào dashboard. Còn lỗi FE: bắt buộc phone, không resume `REGISTRATION_PENDING`, chưa map riêng OTP error code, và mất `isFirstLogin` khỏi `currentUser`. |
| VNPay và QueryDR | **IPN happy path PASS theo handoff; FE QueryDR MISSING; QueryDR live NOT VERIFIED.** Hóa đơn được ghi Paid sau Return, nhưng Render→VNPay QueryDR timeout. FE chưa gọi verify; banner có thể báo thành công chỉ từ URL. |
| Trách nhiệm BE | Chưa thấy bằng chứng lỗi BE trong happy path OTP/IPN được handoff xác nhận. Có triệu chứng timeout ở kết nối QueryDR do BE khởi tạo; root cause mạng chưa xác định. OpenAPI còn lệch/mỏng so với handoff. |
| Runtime | Audit không tự gọi HTTP. Các PASS runtime dưới đây là **theo handoff/bằng chứng Owner được ghi lại**, không phải lần tái kiểm chứng độc lập của audit này. Các ca lỗi/giới hạn, ownership và QueryDR live vẫn NOT VERIFIED. |

## B. Tài liệu, bằng chứng và phân loại trách nhiệm

- Đã đọc hai handoff người dùng cung cấp: `D:/Study/FALL2026/SWP391/SCMS-BAN-GIAO-FE-OTP-2026-11-04.md` và `D:/Study/FALL2026/SWP391/SCMS-BAN-GIAO-FE-VNPAY-2026-11-04.md`. Đây là contract mới nhất cho audit này; các yêu cầu mô tả trong đó được dùng làm tiêu chí, không phải yêu cầu để audit tự chạy giao dịch hay thay đổi hệ thống.
- Handoff OTP ghi nhận ca Owner cung cấp: email OTP được Brevo báo Sent/Delivered/Open; verify trả 204; user 42 chuyển Active; login trả `userId=42`, `memberId=42`, `role=Member`, `isFirstLogin=false`; FE mở dashboard Member 42. Handoff VNPay ghi nhận sau cấu hình IPN, sandbox Return làm invoice thành Paid và `reconciliationRequired=false` không cần reload.
- Các artifact mà handoff dẫn tới (`artifacts/qa/latest.json`, checklist, debug note, deployment guide) không có tại đường dẫn tương ứng trong cây đang kiểm tra. Vì vậy các kết quả trên được ghi **PASS theo handoff/Owner**, chưa được audit mở ảnh hoặc tái chạy độc lập.
- Handoff VNPay cũng ghi nhận QueryDR từ Render timeout khi kết nối TCP 443 tới VNPay trong 15 giây, chưa xác định bên nào chặn. Đây là **triệu chứng ở tích hợp BE→VNPay cần BE/DevOps điều tra**, chưa đủ bằng chứng để quy thành lỗi code BE hoặc lỗi FE.
- `API.txt` có route verify nhưng OpenAPI chưa thể hiện hết status/error và security guest được handoff mô tả. Đây là **lỗi/thiếu đồng bộ tài liệu BE**, không phải bằng chứng API runtime đang từ chối sai. Các tài liệu OTP/VNPay handoff được ưu tiên khi có khác biệt.

| Phân loại | Kết luận sau khi đối chiếu handoff và source |
|---|---|
| **Lỗi FE đã xác nhận qua source** | Phone bắt buộc trái contract; không resume account `REGISTRATION_PENDING`; không map riêng OTP error codes; verify-vnpay chưa được gọi; Return tin `status=00`; receipt không bị chặn theo Paid; retry có thể hiện khi invoice Pending/chưa xác minh. |
| **Lỗi/việc BE hoặc DevOps cần xử lý** | QueryDR outbound Render→VNPay timeout đã được handoff ghi nhận, nhưng root cause chưa xác định. BE/DevOps cần chẩn đoán mạng. OpenAPI cũng cần đồng bộ security/response details với handoff. |
| **Không phải lỗi BE đã chứng minh** | Handoff ghi OTP happy path và VNPay IPN happy path thành công. Chưa có bằng chứng trong tài liệu này rằng BE lưu Paid sai, gửi OTP lỗi ở ca thành công, hoặc API verify sai quyền. |
| **Chưa xác minh được** | OTP sai/hết hạn/replay/rate limit; QueryDR live statuses; active-member/invoice ownership enforcement; idempotency BE; API runtime sau lần bàn giao. |

## C. OTP Integration Matrix

| Luồng/API | FE caller và hành vi quan sát được | Đánh giá |
|---|---|---|
| `POST /api/auth/register` | `src/api/authApi.js:22-23`; `src/components/views/LoginView.jsx:878-926`. Gửi `fullName`, email chuẩn hóa, password, phone; HTTP success chuyển sang màn hình OTP, chưa báo account Active. | **PARTIAL — một lỗi FE rõ.** Handoff ghi happy path thật PASS. FE vẫn validate phone bắt buộc (`LoginView.jsx:818-838`, input required quanh dòng 2229), trái contract tùy chọn. Với contract `code:null`, FE không tự điền OTP; nhánh truthy code có thể hiện/điền giá trị như OTP, xem mục D. |
| `POST /api/auth/resend-otp` | `authApi.js:28-29`; `LoginView.jsx:1062-1095`. Body email + `purpose: "REGISTER"`; countdown 60 giây và guard đang gửi/cooldown. | **PARTIAL.** Body/cooldown FE đúng. Handoff quy định quota 3/giờ do BE giới hạn; ca quota chưa test. Sau resend, nếu response không kèm code sáu số FE giữ OTP cũ. FE ưu tiên hiển thị `res.message` (hợp với thông báo chung); chỉ fallback text mới khẳng định email đã nhận, nên đây là rủi ro khi message bị thiếu, chưa phải lỗi quan sát ở happy path. |
| `POST /api/auth/verify-registration` | `authApi.js:25-26`; `LoginView.jsx:993-1030`. Gửi email + OTP; chỉ chuyển sang màn hình đã xác minh khi request thành công. | **PASS happy path theo handoff và mock 204.** Handoff ghi response thật 204. `httpClient.js:51-53` không parse JSON và trả `null`. **Lỗi FE còn lại:** không map riêng OTP error code; ca sai/hết hạn/replay chưa chạy. |
| `POST /api/auth/login` sau verify | `LoginView.jsx:1108-1125`; `SCMSContext.jsx:1670+`; `memberSafetyHelpers.js:30-44`. FE gọi login bằng email/password, dùng response BE; không tự gán role/memberId từ form. `httpClient.js:23-36` gửi `credentials: "include"`. | **PASS ca `isFirstLogin=false` theo handoff.** Response Member42 vào đúng dashboard. **Khoảng trống FE:** `buildCurrentUser` giữ `userId`, `memberId`, `role`, `authorities` nhưng bỏ `isFirstLogin`; luồng `isFirstLogin=true` chưa được kiểm chứng. Cookie/session thật được handoff xác nhận cho ca này, các ca khác chưa kiểm tra. |

### D. OTP Error Handling và các lỗi FE

- `LoginView.jsx:880-932` chỉ xử lý đặc biệt `MAIL_NOT_CONFIGURED`; các mã `EMAIL_ALREADY_REGISTERED`, `REGISTRATION_PENDING`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED`, `OTP_RESEND_TOO_SOON`, `OTP_RESEND_LIMIT` không có nhánh xử lý theo `error.code`.
- Với `REGISTRATION_PENDING`, FE hiện ở nhánh lỗi đăng ký chung và giữ form; không chuyển sang xác minh account Pending hiện có. Đây là **lỗi FE**, không phải lỗi BE nếu BE trả đúng mã theo handoff.
- `apiErrors.js` giữ `error.code`, nhưng UI không có mapping theo mã; nếu BE trả code mà không có user-facing message, FE hiện fallback theo HTTP status thay vì hướng dẫn riêng từng lỗi. Đây là **thiếu xử lý FE**. Các ca lỗi chưa có bằng chứng runtime.
- Handoff chốt `code:null` không phải OTP/lỗi và không trả OTP trong response. FE xử lý `null` an toàn, nhưng các nhánh dùng `res.code` nếu truthy sẽ ghi nội dung vào label “Mã OTP” và có thể tự điền khi là sáu số (`LoginView.jsx:895-905,1074-1084`). Đây là **rủi ro FE có điều kiện**, không có bằng chứng rằng BE hiện trả OTP hoặc đang làm lộ mã.
- Handoff ghi resend 200 là thông báo chung, không xác nhận thư đã đến Inbox. FE dùng `res.message`; fallback khi thiếu message nói mã đã gửi đến email. Đây là **rủi ro copy FE khi response thiếu message**, không phải lỗi delivery BE ở ca PASS. Handoff xác nhận một thư OTP được Delivered; resend/rate limit chưa test.
- `code:null` không bị coi là lỗi; không tìm thấy OTP trong localStorage hoặc log console. Back-to-register cho phép sửa email; verify/resend dùng email state hiện tại. Chưa có UI test cho thay email khi đã có account Pending.
- `isRegLoading`/`isOtpVerifying` disable nút, nhưng register/verify handler không tự chặn request đang chạy. Resend có guard `isOtpResending`; register/verify vẫn có rủi ro submit lặp nhanh.
- Không có automated UI test hiện hữu cho đăng ký, quay lại sửa email, OTP hết hạn, resend quota hoặc đăng nhập sau xác minh. Back-to-register cho phép sửa email, trong khi verify/resend dùng giá trị email hiện tại trong state; chưa có test xác nhận hành vi với account Pending.

## E. VNPay Integration Matrix

| Luồng/API | FE caller và hành vi quan sát được | Đánh giá |
|---|---|---|
| Tạo payment URL | `src/api/invoiceApi.js:128-140` gọi `POST /api/invoices/{id}/pay-online`; `MemberInvoicesView.jsx:220-255` kiểm tra HTTPS rồi redirect. Catalog/Advanced cũng dùng payment URL BE trả về. | **PARTIAL/PASS về khởi tạo.** Có validation URL và không tự tạo payment success. Không xác minh URL/callback BE hoặc giao dịch live. |
| Return từ VNPay | `App.jsx:1209+` đưa `/payment-result` về `/member/invoices`; `MemberInvoicesView.jsx:104-139` tải lại invoice list bằng `/api/members/me/invoices`. | **PARTIAL — thiếu bước FE theo handoff.** Handoff ghi nhận IPN đã làm invoice Paid/reconciliation false ngay khi Return ở sandbox. Nhưng FE không GET `/api/members/me/invoices/{id}` theo invoiceId ngay khi Return, không POST verify một lần, và không GET list sau verify. Query nhận `status`, `vnp_ResponseCode`, `vnp_TransactionStatus`, `invoiceId`, `invoiceCode`/`vnp_TxnRef` (`MemberInvoicesView.jsx:82-92`). |
| Hiển thị kết quả Return | `MemberInvoicesView.jsx:919-928` coi `status=00` (hoặc tương đương) là thành công, độc lập với invoice BE; banner thành công ở dòng 940+ nói BE đã ghi nhận giao dịch. | **INCORRECT — P1.** URL có thể không khớp trạng thái invoice; FE không được coi query parameter là bằng chứng Paid. Ví dụ `status=00` nhưng invoice vẫn Pending sẽ vẫn tạo banner thành công. |
| Verify QueryDR | Handoff xác nhận BE đã có `POST /api/members/me/invoices/{id}/verify-vnpay`, bảng attempts/migration và scope Active Member sở hữu invoice cùng center. Tìm source FE không thấy `verify-vnpay` hoặc status QueryDR. | **LỖI FE đã xác nhận; BE runtime một phần chưa xác minh.** FE chưa gửi request nên thiếu body `{}`, timeout 60 giây, mutex, xử lý `retryAfterSeconds`, status UI và refresh sau verify. Handoff ghi QueryDR Render→VNPay timeout trong 15s; đây là **BE/infra cần điều tra**, nhưng chưa xác định root cause. Không có QueryDR live PASS. |
| Status và reconciliation | `invoiceMappers.js:27-43,87` map payment status thường và giữ `reconciliationRequired`. `MemberInvoicesView.jsx:539,793` hiển thị cảnh báo reconciliation. `memberMembershipData.js:11-16,23-36` chặn entitlement nếu invoice yêu cầu đối soát; `MemberCourseCatalog.jsx:604-630` cũng báo chưa xác nhận quyền. | **PARTIAL/PASS tĩnh cho ranh giới entitlement.** Có kiểm tra reconciliation ở các luồng đã rà soát; không có parser cho các giá trị `verificationStatus` mới. Test này không chứng minh trạng thái BE/runtime. |
| Receipt | Nút “Biên lai / Chi tiết” hiện cho mọi invoice (`MemberInvoicesView.jsx:553+`); handler gọi `GET /api/invoices/{id}/receipt` trước (`MemberInvoicesView.jsx:264-278`), không kiểm tra Paid. | **LỖI FE đã xác nhận.** Gọi receipt cho Pending/Expired vi phạm handoff; 409 bị catch và fallback sang member invoice detail. BE vẫn phải enforce owner/Paid ở endpoint, nhưng không có bằng chứng endpoint BE hiện cho phép sai. |
| Retry thanh toán | Banner hiển thị retry nếu invoice khớp còn Pending, không phải Cash (`MemberInvoicesView.jsx:1001-1018`) và khuyên thử thanh toán lại (`MemberInvoicesView.jsx:951-952`). | **LỖI FE đã xác nhận.** Handoff cấm mời trả thêm với `NOT_CONFIRMED`/`QUERY_UNAVAILABLE`; code hiện chưa phân biệt các trạng thái này và vẫn hiện retry khi invoice Pending. Không thấy auto retry vô hạn. |

## F. Authorization / HTTP status

- `httpClient.js` gửi cookie với `credentials: "include"`; 204 được xử lý riêng; 401 dispatch unauthorized event, 403 dispatch forbidden, 409 thành `ValidationError` (`apiErrors.js:74-92`). Handoff có ca login thật thành công nhưng không có negative tests cho 401/403/409.
- Handoff quy định verify chỉ cho Active Member sở hữu invoice cùng center; FE chưa gọi endpoint, nên không có FE nhầm Manager/Receptionist gọi API Member-only. Backend ownership enforcement chưa được kiểm thử độc lập trong audit.
- `API.txt` đặt `JSESSIONID` ở security cấp toàn API dù handoff cho phép Guest register/verify, và không ghi đầy đủ response errors/status của verify. Đây là **mâu thuẫn tài liệu BE/OpenAPI**; ca OTP thật thành công cho thấy không thể kết luận API runtime đang bắt Guest đăng nhập. Không có 401/403/409 runtime evidence ngoài dữ liệu handoff.

## G. Missing Features

1. Function/caller UI cho QueryDR `verify-vnpay`.
2. Timeout 60 giây, khóa đồng thời/double-click theo `invoiceId`, `retryAfterSeconds` và retry có giới hạn.
3. Bản đồ UI cho `VERIFIED_PAID`, `ALREADY_PAID`, `RETRY_LATER`, `NOT_CONFIRMED`, `QUERY_UNAVAILABLE`, `ATTEMPT_MISSING`, `DISABLED`, `VERIFIED_ONLY`, `NOT_APPLICABLE`.
4. Quy tắc sau return: đọc invoice detail từ BE, nếu cần gọi verify đúng điều kiện, sau đó refresh status; không suy ra Paid từ URL.
5. Xử lý riêng `REGISTRATION_PENDING` và map các error code OTP.
6. UI/test cho `isFirstLogin`, cùng test UI OTP resend/cooldown và duplicate submit.

## H. Lỗi BE / việc BE-DevOps cần xử lý

| Mức | Phân loại | Bằng chứng và việc cần làm |
|---|---|---|
| BE/Infra — có triệu chứng, root cause chưa rõ | QueryDR outbound timeout | Handoff ghi Render không kết nối TCP 443 tới VNPay trong 15 giây và chưa biết bên nào chặn. BE/DevOps cần kiểm tra egress, firewall, DNS/TLS và log QueryDR; không quy lỗi này cho FE. Không tắt QueryDR/xóa bảng attempts theo audit này. |
| BE docs — đã xác nhận | OpenAPI lệch handoff | OpenAPI security toàn cục khiến guest OTP bị mô tả là cần `JSESSIONID`; verify response chỉ thể hiện 200/schema tổng quát, thiếu error/status/role scope. Đồng bộ spec với hai handoff, không coi đây là bằng chứng API runtime sai. |
| BE runtime | Chưa xác nhận bug ở OTP/IPN happy path | Handoff ghi ca OTP tạo Active + login đúng và VNPay IPN ghi Paid/reconciliation false. Không có cơ sở audit để yêu cầu sửa logic BE cho hai ca thành công đó. |
| BE runtime cần nghiệm thu | QueryDR status/authorization/idempotency | Handoff mô tả contract/scope, nhưng không có test results live cho từng verification status, invoice khác owner, 401/403/409 hoặc retry concurrency. Cần nghiệm thu khi môi trường QueryDR hoạt động; hiện chưa gọi API. |

**FE không cần chờ BE để sửa các lỗi hiển thị/điều hướng đã thấy trong source.** FE cần BE/DevOps xử lý đường QueryDR và giữ ổn định contract/status; FE cần thực hiện phần wiring và UI.

## I. Test Case Results

`PASS` dưới đây chỉ áp dụng test mock/local đã chạy; không phải bằng chứng Backend live.

| TC | Kết quả audit |
|---|---|
| TC01 | **PASS theo handoff Owner** — email OTP thật tới Gmail, verify thành công và account Active; artifact gốc không có tại đường dẫn tham chiếu để audit tự kiểm tra. |
| TC02 | **PASS theo handoff + mock** — verify thật trả 204; mock xác nhận request JSON đúng, credentials include và response là `null`. |
| TC03–TC05 | **NOT VERIFIED** — chưa có test OTP sai/hết hạn/dùng lại. FE chỉ hiện message/fallback chung. |
| TC06 | **PARTIAL** — client khóa resend 60 giây; không test server clock/quota. |
| TC07–TC08 | **NOT VERIFIED** — 3 lần/giờ và 5 lần sai phải được BE enforce; chưa có mock case. |
| TC09 | **INCORRECT (static)** — không resume OTP khi `REGISTRATION_PENDING`. |
| TC10 | **PASS theo handoff Owner cho `isFirstLogin=false`** — login response Member42 và vào dashboard Member42. `isFirstLogin=true` chưa kiểm chứng; FE model bỏ field này. |
| TC11 | **PARTIAL** — nút disable nhưng handler register/verify thiếu in-flight guard; chưa test double-submit. |
| TC12 | **PARTIAL** — có catch network error; chưa test account Pending sau kết quả request mơ hồ. |
| TC13 | **PASS theo handoff Owner** — sau cấu hình IPN, sandbox Return ghi Paid và `reconciliationRequired=false`; audit không chạy lại. |
| TC14 | **INCORRECT (FE static) / positive path PASS theo handoff** — FE sẽ báo thành công chỉ từ `status=00` nếu invoice Pending; ca handoff thật có invoice Paid nên không kiểm tra tình huống xung đột. |
| TC15–TC21 | **FE MISSING; BE live NOT VERIFIED** — BE endpoint/response status được handoff mô tả, nhưng FE chưa gọi; QueryDR live chưa có kết quả. |
| TC22 | **PARTIAL (static)** — reconciliation flag được hiển thị và chặn entitlement trong helper; chưa test end-to-end. |
| TC23–TC25 | **FE MISSING / BE NOT VERIFIED** — FE chưa có timeout 60s/verify mutex; BE ownership/idempotency chưa có negative/runtime test trong bằng chứng được cung cấp. |
| TC26 | **INCORRECT (static)** — receipt call không được chặn theo Paid. |
| TC27 | **INCORRECT (static)** — không auto retry vô hạn, nhưng hướng dẫn/nút thanh toán lại có thể xuất hiện khi invoice Pending chưa được QueryDR xác minh. |
| TC28 | **PARTIAL (static)** — luồng entitlement đã rà soát không tự cộng credit khi reconciliationRequired=true; chưa audit mọi API BE cấp quyền. |

### Validation chạy được

- `node test/fe03_api_errors_test.mjs` — PASS (mock fetch; status/error mapping chung).
- `node test/fe08_invoice_api_test.mjs` — PASS (mock fetch; invoice mapper/query/credentials; không có verify-vnpay coverage).
- `node test/fe11_integration_regression_test.mjs` — PASS (mock integration regression; không phải QueryDR live).
- Mock riêng `verifyRegistration` với HTTP 204 — PASS: body `{email, otp}`, JSON content-type, credentials include, kết quả `null`.
- `npm.cmd run build:local` — PASS (`.env.mock`: API disabled; không gọi API).
- `git diff --check` — PASS.
- Không chạy test browser/live vì `.env.local` proxy tới Render; không có môi trường dev BE độc lập được xác minh.

## J. Top 10 Issues theo owner và ưu tiên

| ID | Ưu tiên | Phân loại | Lỗi / bằng chứng |
|---|---|---|---|
| OTP-01 | P1 | **FE** | `REGISTRATION_PENDING` không tiếp tục OTP account đang chờ (`LoginView.jsx:878-932`). |
| PAY-01 | P1 | **FE** | Return có thể báo thành công chỉ từ `status=00`, trái handoff (`MemberInvoicesView.jsx:919-958`). |
| PAY-02 | P1 | **FE** | BE verify endpoint có theo handoff nhưng FE chưa gọi; thiếu chuỗi GET detail → verify → GET list. |
| PAY-03 | P1 | **FE** | Retry payment có thể hiện khi invoice Pending chưa được QueryDR xác minh (`MemberInvoicesView.jsx:951-952,1001-1018`). |
| PAY-04 | P1 | **FE** | Receipt được gọi cho invoice chưa Paid (`MemberInvoicesView.jsx:264-278,553+`). |
| OTP-02 | P2 | **FE** | Phone bắt buộc trong form trái contract tùy chọn (`LoginView.jsx:818-838,2229+`). |
| OTP-03 | P2 | **FE** | Không map các OTP error codes riêng; lỗi hiện raw message/fallback. |
| OTP-04 | P2 | **FE có điều kiện** | Khi `res.code` truthy, FE label/auto-fill như OTP; handoff quy định không trả OTP và `code:null` an toàn hiện tại (`LoginView.jsx:895-905,1074-1084`). |
| PAY-05 | P1 | **BE/DevOps investigation** | Render→VNPay QueryDR timeout 15s theo handoff; có triệu chứng, root cause chưa xác định. |
| DOC-01 | P2 | **BE documentation** | OpenAPI security/response chưa đồng bộ guest OTP và QueryDR chi tiết trong handoff; không phải bằng chứng runtime auth bug. |

## K. Recommended Implementation Order

1. **FE trước, không cần chờ mạng BE:** bỏ success dựa trên URL; ưu tiên GET invoice detail và giữ trạng thái chưa xác minh; không mời trả thêm khi QueryDR đang unavailable; chỉ gọi receipt sau Paid.
2. **FE:** nối endpoint BE đã bàn giao theo đúng chuỗi GET detail → POST verify một lần → GET list; thêm 60s timeout, mutex theo invoice, `retryAfterSeconds` và status mapping.
3. **FE:** xử lý `REGISTRATION_PENDING`, cho phone tùy chọn, map lỗi OTP, xóa OTP cũ sau resend và loại nhánh render/auto-fill `res.code` như OTP; giữ `isFirstLogin` nếu flow sử dụng.
4. **BE/DevOps song song:** điều tra Render→VNPay TCP443 timeout; chưa thay đổi env, migration hoặc relay chỉ từ suy đoán.
5. **BE docs:** đồng bộ OpenAPI security guest, error/status, role/ownership và enum verify với handoff.
6. Chạy test mock/UI cho các ca chưa có; chỉ nghiệm thu QueryDR live khi BE/Owner cấp môi trường/fixture phù hợp.

## L. Files to Change (đề xuất, chưa sửa)

- `src/components/views/LoginView.jsx` — phone optional, lỗi Pending/OTP, resend state/copy, xử lý `code:null`/truthy code, submit guards và preserve `isFirstLogin` nếu cần.
- `src/api/apiErrors.js` — mapping code OTP/QueryDR nếu BE chốt error contract.
- `src/utils/memberSafetyHelpers.js` — expose `isFirstLogin` nếu FE flow cần trường này.
- `src/api/invoiceApi.js` — thêm `verifyVnpay(invoiceId)` gửi `{}`; không tạo API staff wrapper.
- `src/api/httpClient.js` — chỉ nếu cần hỗ trợ timeout/abort nhất quán; cần tránh timeout ngắn hơn 60s.
- `src/components/views/MemberInvoicesView.jsx` — GET detail/verify/refresh/status state, authoritative return, receipt gate, retry policy.
- `src/components/views/MemberCourseCatalog.jsx` và các entry point VNPay khác — đồng bộ status refresh sau return/verify, không coi local order hoặc URL là Paid.
- Test files mới/cập nhật trong `test/` — OTP component/API mocks và QueryDR status/ownership/timeout cases.

**Kết luận audit:** Theo handoff Owner, OTP happy path và VNPay IPN happy path đã PASS. Các lỗi code có thể sửa tiếp nằm chủ yếu ở FE: OTP Pending/phone/error mapping; VNPay thiếu verify wiring và xử lý Return sai trong một số trạng thái. BE/DevOps có triệu chứng QueryDR timeout cần điều tra nhưng chưa rõ root cause; OpenAPI cần đồng bộ với handoff. Audit không tái gọi runtime; OTP error cases, QueryDR live và BE authorization/ownership vẫn **NOT VERIFIED**.
