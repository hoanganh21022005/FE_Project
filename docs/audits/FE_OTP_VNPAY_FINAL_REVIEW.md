# FE OTP & VNPay — Final Integration and Regression Review

**Ngày kiểm tra:** 2026-11-05
**Nhánh:** `HoangAnh`
**Phạm vi:** FE-PAY-01, FE-OTP-01, FE-PAY-02 và regression liên quan.
**Phương pháp:** Đọc source/contract, kiểm tra lịch sử Git, chạy unit/mock tests và build. Không gọi API thật, Render, VNPay hoặc SMTP; không gửi OTP hay tạo giao dịch. Không sửa source.

## 1. Tổng quan OTP

**Source/contract: PASS. Runtime: NOT VERIFIED trong lượt audit này.**

- Phone không bắt buộc. Payload chỉ thêm `phone` khi có giá trị; số điện thoại nhập vào vẫn được format kiểm tra.
- `REGISTRATION_PENDING` được đưa thẳng về bước nhập OTP của tài khoản đang chờ, không gọi đăng ký lần nữa.
- Các mã lỗi OTP được ánh xạ riêng: email đã tồn tại, OTP sai/hết hạn, vượt số lần thử, gửi lại quá sớm/đạt giới hạn và đăng ký đang Pending.
- Verify yêu cầu HTTP 204 (`expectedStatus: 204`). `httpClient` không parse JSON với 204; FE chỉ chuyển sang trạng thái đã xác minh khi request thành công.
- Resend đăng ký gửi `purpose: "REGISTER"`, áp dụng cooldown 60 giây; sau resend thành công, OTP nhập trước đó được xóa. Giới hạn 3 lần/giờ vẫn do Backend enforce.
- FE không dùng `response.code` làm OTP, không lưu hoặc log OTP trong API mode. Mock mode dùng mã fixture `123456`; đây không phải OTP thật.
- Verify OTP không tạo login session. Sau khi xác minh, bước hoàn tất gọi API login; login response là nguồn `userId`, `memberId`, `role`, `authorities` và `isFirstLogin`. `buildCurrentUser` giữ `isFirstLogin` khi Backend trả boolean.
- Handoff ghi nhận ca thật OTP → Active → login Member → Dashboard đã thành công. Audit này không tái chạy ca thật và không kiểm chứng các ca OTP sai/hết hạn/replay/quota với Backend.

## 2. Tổng quan VNPay

**Luồng FE tích hợp: PASS theo source và mock test. QueryDR/Backend thật: NOT VERIFIED.**

- Return lấy chi tiết hóa đơn từ member endpoint, không suy ra Paid từ `status=00`.
- FE gọi verify tối đa một lần tự động trong một mount/Return cho đúng member invoice dạng online, sau đó tải lại danh sách và cập nhật invoice đang theo dõi.
- Giao diện phân biệt Paid, cần đối soát, Pending, Expired và các kết quả verify. Verify response không tự ghi Paid vào invoice hoặc cấp Subscription/Credit.
- Receipt chỉ gọi khi invoice có trạng thái Paid; hóa đơn Return Pending/Expired không hiện nút receipt.
- `VERIFIED_PAID`/`ALREADY_PAID` không thay thế trạng thái invoice Backend. `RETRY_LATER` hiển thị thời gian chờ; `NOT_CONFIRMED`/`QUERY_UNAVAILABLE` không bị coi là thất bại và không đề nghị thanh toán lại.
- Handoff Backend vẫn ghi nhận QueryDR từ Render tới VNPay timeout TCP 443 sau 15 giây, chưa rõ nguyên nhân. Không có xác nhận QueryDR live đã hoạt động.

## 3. Các luồng FE khớp contract

| Luồng | Kết quả source audit |
|---|---|
| Register → Pending → OTP | Payload optional phone; response Pending được resume; OTP không được xem là account Active trước HTTP 204. |
| OTP → Login → Member Dashboard | Verify không tự login; sau verify FE gọi login và lấy danh tính/quyền từ response Backend. |
| VNPay Return → detail → verify → list refresh | Dùng invoice ID số, body `{}`, cookie session, timeout 60 giây; không tin URL để báo Paid. |
| Reconciliation / quyền học | `paymentStatus` và `reconciliationRequired` được hiển thị riêng; không tự xác nhận quyền học khi cần đối soát. |
| Receipt | Chỉ gọi endpoint receipt nếu hóa đơn đã Paid theo dữ liệu hiện có. |
| API errors | Lỗi HTTP/network không bị biến thành Paid/Failed; list refresh có giữ dữ liệu đang có khi lỗi. |

## 4. Lỗi và rủi ro còn tồn tại

| Mức | Vấn đề | Root cause / ảnh hưởng | Hướng xử lý đề xuất (không thực hiện trong audit) |
|---|---|---|---|
| P1 — DevOps/BE | QueryDR live timeout theo handoff | Render không kết nối được VNPay TCP 443 trong 15 giây; chưa xác định DNS, egress, firewall, TLS hay phía VNPay. | BE/DevOps chẩn đoán kết nối ở môi trường được phép; không tắt QueryDR hoặc giả lập Paid. |
| P2 — FE | `retryAfterSeconds` chỉ giữ trong React state (`MemberInvoicesView.jsx`, verification state/auto effect) | Reload hoặc unmount làm mất cooldown và cờ “đã tự verify”; cùng URL Return có thể tự gọi verify lại trước thời điểm được phép. Backend có thể chặn, nhưng FE chưa bảo đảm cooldown xuyên reload. | Lưu cooldown theo invoice/Return với thời hạn phù hợp hoặc lấy trạng thái cooldown từ Backend; vẫn cần giới hạn auto verify. |
| P2 — FE | Verify request không được abort khi rời component | `httpClient` hỗ trợ `AbortSignal`, nhưng `verifyVnpay`/caller hiện chỉ truyền timeout. Stale response bị chặn cập nhật UI; request mạng có thể tiếp tục tới 60 giây. Remount cũng tạo lock mới trong khi request cũ có thể còn chạy. | Truyền `AbortSignal` và hủy request khi unmount/đổi Return; cân nhắc khóa theo invoice ở tầng service nếu có nhiều caller. |
| P2 — FE/BE | Timeout/network error không có cooldown UI | Sau timeout, giao dịch có thể vẫn đang được xử lý ở Backend nhưng FE cho phép người dùng bấm Tải lại để gọi verify lần nữa ngay. | Hiển thị trạng thái chưa xác minh trung tính và áp dụng retry delay phù hợp; Backend cần giữ idempotency/concurrency guard. |
| P2 — DevOps | Vite proxy mặc định trỏ tới Render | `vite.config.js` dùng `https://scms-app-p1gy.onrender.com` khi không có `VITE_API_PROXY_TARGET`; browser test/local API mode có thể gửi request ra môi trường Render. | Cấu hình rõ target dev/staging được phép hoặc chặn request ngoài trong browser harness. Không thay môi trường trong lượt này. |

Không phát hiện thêm lỗi source đã được audit cũ nêu về phone bắt buộc, `REGISTRATION_PENDING`, OTP error mapping, mất `isFirstLogin`, thiếu verify-vnpay, dựa URL status để báo Paid hoặc gọi receipt khi Pending. Báo cáo cũ `FE_OTP_VNPAY_HANDOFF_AUDIT.md` có các kết luận trước khi những commit hiện tại được tạo; tài liệu đó được giữ nguyên và không dùng làm trạng thái hiện hành.

## 5. Rủi ro khi dùng API thật

- QueryDR chưa có runtime xác nhận; nếu Backend trả `QUERY_UNAVAILABLE`, FE giữ trạng thái invoice và hướng dẫn trung tính.
- Gọi verify có thể mất tới 60 giây. Timeout phía trình duyệt không chứng minh Backend đã dừng xử lý.
- Retry cooldown hiện không sống qua reload; người dùng tải lại trang trong cùng Return có thể tạo thêm một lần gọi.
- HTTP 401 có thể kích hoạt cơ chế unauthorized toàn ứng dụng; 403/409/500 được chuyển qua API error handler. Chưa gửi các request này tới Backend thật.
- Không kiểm chứng quyền sở hữu invoice, scope cùng center, SMTP, cookie production, IPN signature, QueryDR idempotency hoặc quyền học trên Backend trong audit này.

## 6. Unit/mock tests

Các test đã chạy thành công:

- `test/fe_otp_01_auth_test.mjs` — PASS, bộ FE-OTP-01 TC01–TC18.
- `test/fe_pay_01_payment_return_test.mjs` — PASS, FE-PAY-01 TC01–TC06.
- `test/fe_pay_02_vnpay_verification_test.mjs` — PASS, mock endpoint, body/credentials/timeout, status helpers, cooldown, duplicate lock và stale guard.
- `test/fe08_invoice_api_test.mjs`, `test/fe03_api_errors_test.mjs` — PASS.
- `test/fe2_membership_payment_test.mjs` — PASS; bao gồm invoice/payment, Normal/Advanced subscription, receptionist cash confirmation, manager payment và mock-mode mutation guards.
- `test/fe11_integration_regression_test.mjs` — PASS.
- Auth/route regression: `g1_logic_test.mjs`, `g1_guard_test.mjs`, `g2_logic_test.mjs` — PASS.
- `member_dashboard_data_test.mjs` — PASS.

Các test này dùng mock/fixture cục bộ; chúng không chứng minh API Backend hoặc luồng UI trên trình duyệt hoạt động ở runtime thật. Bộ `fe2` có log `QuotaExceededError` được tạo có chủ đích để kiểm tra fail-closed; assertion tương ứng PASS.

## 7. UI browser tests

**UI BROWSER TEST NOT RUN.** Không có Playwright, Vitest hay React Testing Library trong dependencies. Workspace có một số script CDP/Chromium cho màn hình khác, nhưng chưa có harness OTP/VNPay bảo đảm intercept/mock mọi request trước tương tác. Vì cấu hình proxy mặc định có thể forward `/api` tới Render, không khởi chạy dev server/browser test trong lượt audit để tránh request ngoài.

## 8. Regression

- Login, auth state, protected routes/role guards: unit/logic regression PASS; chưa chạy browser.
- Member Dashboard: data regression PASS; chưa kiểm tra phiên Backend thật.
- Member invoices/return/receipt: payment helper/API mock tests PASS; không có browser component test.
- Normal/Advanced subscriptions: FE2 mock integration regression PASS.
- Center Manager payments và Receptionist cash confirmation: có assertion trong FE2 regression, PASS ở mock mode.
- Logout, cookie/session thực, invoice detail/receipt Backend, IPN và quyền học runtime: NOT VERIFIED trong môi trường thật.

## 9. Build và Git

- `npm.cmd run build` — PASS.
- `npm.cmd run build:local` — PASS.
- `git diff --check` — PASS.
- Git status trước audit: sạch; các commit FE-PAY-01, FE-OTP-01 và FE-PAY-02 đã có trên `HoangAnh`.
- Không sửa source, `.gitignore` hoặc tài liệu đã xóa. Audit report này là file mới; không commit/push/deploy.

## 10. Hạn chế chưa kiểm thử

- Không có UI browser E2E cho Register/OTP/VNPay trong audit này.
- Không kiểm tra OTP sai, hết hạn, replay, 5 lần sai, quota resend 3/giờ hoặc đăng nhập thật sau verify.
- Không kiểm tra `retryAfterSeconds` qua reload bằng browser; rủi ro state reset được xác định từ source.
- Không gọi HTTP thật, không dùng staging/Render, không tạo giao dịch hoặc gửi thư.
- Không kiểm chứng cấu hình môi trường, IPN, QueryDR, database, BE authorization hoặc provisioning quyền học.

## 11. File liên quan nếu cần sửa phát hiện

Không sửa file trong lượt audit. Nếu xử lý findings:

- Cooldown/lock/cancel request: `src/components/views/MemberInvoicesView.jsx`, `src/api/invoiceApi.js`, có thể `src/utils/paymentVerification.js`.
- Proxy safe target cho kiểm thử: `vite.config.js` hoặc cấu hình môi trường dev/staging do DevOps quản lý.
- QueryDR timeout/kết nối và idempotency: Backend/DevOps; không thuộc source FE.

## 12. Phân công FE / BE / DevOps

- **FE:** giữ cooldown khi remount/reload; hủy request khi rời view; thêm browser harness có intercept toàn bộ API nếu sau này được phép; tiếp tục không suy luận Paid từ Return URL.
- **BE:** cung cấp/duy trì enum, response và authorization theo contract; xác nhận idempotency khi request retry hoặc timeout.
- **DevOps + BE:** điều tra đường Render → VNPay TCP 443 và cung cấp target dev/staging tách biệt với production.
- Không có bằng chứng audit này đủ để kết luận Backend xử lý sai OTP/IPN happy path; QueryDR có triệu chứng timeout nhưng root cause chưa xác định.

## 13. Kết luận sẵn sàng

**Có điều kiện để kiểm thử tích hợp trên dev/staging được phép; chưa sẵn sàng kết luận runtime hoặc Production Ready.** Unit/mock tests và cả hai build đều PASS. Trước khi test tích hợp, cần bảo đảm `VITE_API_PROXY_TARGET` trỏ đúng môi trường dev/staging, chặn request tới Render/production, và phối hợp BE/DevOps về QueryDR. Cooldown qua reload và hủy request khi rời view là hai finding FE còn lại cần được xử lý hoặc chấp nhận có chủ đích trước nghiệm thu.
