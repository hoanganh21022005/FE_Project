# SCMS – Quy trình làm việc chung BE–FE với GitHub, Swagger và Render

Tài liệu này dùng để thống nhất cách làm việc giữa **Backend Team** và **Frontend Team** trong dự án **Sports Center Management System (SCMS)**.

## 1. Cấu trúc repository

Dự án sử dụng 2 repository riêng:

```text
Backend Repository
→ Spring Boot
→ Database
→ REST API
→ Swagger

Frontend Repository
→ React / Vite
→ UI
→ Mock Data
→ API Integration
```

BE và FE không copy source của nhau. Hai team giao tiếp thông qua:

```text
Swagger / OpenAPI Contract
+
Backend API URL
```

## 2. Kiến trúc tổng thể

```text
                    BACKEND TEAM
                         │
                         ▼
                 GitHub BE Repository
                         │
                       main
                         │
                         ▼
                 Render Backend
                         │
                 REST API + Swagger
                         │
                         ▼
                      Database


                    FRONTEND TEAM
                         │
                         ▼
                 GitHub FE Repository
                         │
                       main
                         │
                         ▼
                 Render Frontend
                         │
                         │ HTTPS API
                         └──────────────► Render Backend
```

## 3. Làm việc theo Business Flow

Không triển khai theo kiểu tuần này chỉ làm Controller, tuần sau chỉ làm UI. Mỗi giai đoạn nên hoàn thiện một luồng nghiệp vụ tương đối đầy đủ.

Ví dụ Payment:

```text
Member Login
      ↓
View Membership Packages
      ↓
Select Package
      ↓
Create Payment
      ↓
Staff View Payments
      ↓
Staff Approve / Reject
      ↓
Membership Activated / Updated
```

## 4. Quy trình chuẩn cho mỗi flow

1. Cả team phân tích business flow: actor, main flow, alternative flow, validation, dữ liệu, API và màn hình FE.
2. BE thiết kế API Contract trước hoặc song song với code.
3. FE đọc contract/Swagger và làm UI bằng mock data khi API chưa sẵn sàng.
4. BE code business logic cho flow của tuần đó.
5. BE commit, push, tạo Pull Request và merge vào `main`.
6. Render Backend tự build/deploy từ `main`.
7. BE kiểm tra API + Swagger trên Render rồi mới báo FE tích hợp.
8. FE thêm API adapter và chuyển từ mock sang API thật.
9. BE + FE test end-to-end toàn bộ flow.
10. FE commit, push, PR và merge vào `main`.
11. Render Frontend tự deploy.
12. Test lại trên môi trường Render. PASS thì flow mới được coi là DONE.

## 5. API Contract BE cần thống nhất

Mỗi API cần mô tả:

- Endpoint
- HTTP Method
- Request Body
- Response Body
- HTTP Status
- Validation
- Authentication
- Error format

Ví dụ:

```text
GET    /api/packages
POST   /api/payments
GET    /api/payments/my
GET    /api/staff/payments
PATCH  /api/staff/payments/{id}/approve
PATCH  /api/staff/payments/{id}/reject
```

Ví dụ request:

```json
{
  "packageId": 2,
  "paymentMethod": "BANK_TRANSFER"
}
```

Ví dụ response:

```json
{
  "id": 27,
  "amount": 500000,
  "status": "PENDING"
}
```

Swagger/OpenAPI là tài liệu chính để FE dựa vào.

## 6. FE làm gì khi BE chưa xong API?

FE không cần chờ.

```text
React UI
   ↓
Mock Data
```

FE vẫn có thể làm:

- Page
- Form
- Modal
- Table
- Validation UI
- Loading state
- Empty state
- Error state
- Navigation
- Business flow UI

Mock data nên bám theo schema Swagger để sau này đổi sang API thật ít phải sửa component.

## 7. Cấu trúc API phía FE

Khuyến nghị:

```text
src/
└── api/
    ├── httpClient.js
    ├── apiErrors.js
    ├── authApi.js
    ├── memberApi.js
    ├── membershipApi.js
    ├── bookingApi.js
    ├── paymentApi.js
    ├── attendanceApi.js
    ├── trainingApi.js
    └── reportApi.js
```

Luồng chuẩn:

```text
Component
   ↓
xxxApi.js
   ↓
httpClient.js
   ↓
Render Backend
```

Không nên gọi `fetch()` trực tiếp rải rác trong component.

## 8. Quy trình GitHub cho từng thành viên

Không code trực tiếp trên `main`.

Workflow:

```text
Fetch
 ↓
Pull
 ↓
Chọn branch cá nhân / feature branch
 ↓
Code
 ↓
Test
 ↓
Commit
 ↓
Push origin
 ↓
Pull Request
 ↓
Review
 ↓
Merge main
```

Render chỉ nên theo dõi `main`.

Ví dụ FE:

```text
main
├── HoangAnh
├── PhatTai
└── ThuyVy
```

Push lên `PhatTai` chưa làm Render thay đổi. Chỉ khi PR được merge vào `main` thì Render FE mới auto deploy.

## 9. Cập nhật code mới từ main

Khi `main` có code mới:

```text
Current Branch → main
Fetch origin
Pull origin
```

Sau đó chuyển lại branch cá nhân:

```text
Current Branch → PhatTai
```

và:

```text
Branch
→ Update from main
```

hoặc:

```text
Branch
→ Merge into current branch...
→ main
```

Hướng cập nhật đúng:

```text
main
 ↓
PhatTai
```

Đưa branch cá nhân vào `main` nên thực hiện qua Pull Request.

## 10. FE Environment

Mock mode:

```env
VITE_API_ENABLED=false
```

Chạy:

```bash
pnpm dev:local
```

Local gọi BE:

```env
VITE_API_ENABLED=true
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=http://localhost:8080
```

Render:

```env
VITE_API_ENABLED=true
VITE_API_BASE_URL=https://scms-be.onrender.com
```

Không hard-code backend URL trong từng component.

## 11. BE Environment

Các thông tin nhạy cảm đặt trong Render Environment Variables:

```text
DB_HOST
DB_PORT
DB_NAME
DB_USERNAME
DB_PASSWORD
FRONTEND_URL
```

Không commit `.env`, password, secret, API key hoặc database credential lên GitHub.

## 12. Authentication và CORS

Nếu FE và BE nằm ở hai domain Render khác nhau, BE phải cấu hình đúng:

```text
Allowed Origin
Allow Credentials
CORS
Cookie Secure
SameSite
Authentication
```

Nếu dùng session/cookie, FE có thể cần:

```javascript
credentials: 'include'
```

Nếu sai cấu hình có thể xảy ra:

```text
Swagger login OK
Postman login OK
React login lỗi hoặc /api/auth/me trả 401
```

Đây là phần BE và FE cần test chung.

## 13. Render Frontend

FE nên dùng:

```text
Service Type: Static Site
Branch: main
```

Build command ví dụ:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm build
```

Publish directory:

```text
dist
```

Environment:

```text
VITE_API_ENABLED=true
VITE_API_BASE_URL=https://scms-be.onrender.com
```

Nếu dùng React Router, thêm rewrite:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```

## 14. Render Backend

BE nên dùng:

```text
Service Type: Web Service
Branch: main
```

Backend nên có health check:

```text
/actuator/health
```

hoặc:

```text
/health
```

Nếu health check fail thì chưa nên báo FE tích hợp.

## 15. Trạng thái API chung

Khuyến nghị dùng trên Jira/Trello:

```text
API DESIGN
    ↓
API DOCUMENTED
    ↓
BE CODING
    ↓
BE LOCAL TESTED
    ↓
DEPLOYED
    ↓
FE INTEGRATING
    ↓
E2E TESTING
    ↓
DONE
```

Ví dụ:

```text
POST /api/payments
Status: DEPLOYED
```

→ FE có thể tích hợp.

```text
PATCH /api/payments/{id}/approve
Status: BE CODING
```

→ FE tiếp tục dùng mock.

## 16. BE cần bàn giao gì cho FE khi API hoàn thành?

- Backend Render URL
- Swagger URL
- Endpoint
- Method
- Request
- Response
- Status Code
- Authentication
- Validation
- Error Response
- API Status

Không nên chỉ báo: `API xong rồi`.

## 17. Test End-to-End

Không chỉ test từng endpoint riêng.

Ví dụ flow Payment:

```text
Member Login
      ↓
View Package
      ↓
Create Payment
      ↓
Staff Login
      ↓
View Payment
      ↓
Approve Payment
      ↓
Member Membership Updated
```

BE + FE cùng test toàn bộ chuỗi.

## 18. Definition of Done

Một flow chỉ được coi là DONE khi:

```text
Business Flow đã thống nhất
        ↓
BE Logic hoàn thành
        ↓
Swagger đúng
        ↓
BE Render hoạt động
        ↓
FE tích hợp API thật
        ↓
FE Render hoạt động
        ↓
BE + FE End-to-End Test
        ↓
PASS
        ↓
DONE
```

## 19. Trách nhiệm của BE và FE

| Công việc | BE | FE |
|---|:---:|:---:|
| Business Flow | ✓ | ✓ |
| Database Design | ✓ | tham khảo |
| Entity / Repository | ✓ | |
| Business Logic | ✓ | |
| REST API | ✓ | |
| Swagger / OpenAPI | ✓ | đọc / test |
| Authentication Backend | ✓ | tích hợp |
| CORS | ✓ | test |
| React UI | | ✓ |
| Mock Data | | ✓ |
| API Adapter | | ✓ |
| Loading / Error State | | ✓ |
| Render Backend | ✓ | test |
| Render Frontend | | ✓ |
| E2E Test | ✓ | ✓ |

## 20. Quy trình ngắn gọn cần ghi nhớ

```text
1. Phân tích Business Flow.
2. Thiết kế API Contract.
3. BE và FE làm song song.
4. FE dùng Mock nếu API chưa sẵn sàng.
5. BE code và test logic.
6. BE PR → main.
7. Render Backend auto deploy.
8. BE kiểm tra Swagger/API.
9. FE tích hợp API thật.
10. BE + FE test End-to-End.
11. FE PR → main.
12. Render Frontend auto deploy.
13. Test lại trên Render.
14. PASS → DONE.
```

## 21. Quy tắc chung của team

```text
GitHub
= quản lý source code

Branch
= nơi từng thành viên làm việc

Pull Request
= nơi review trước khi merge

main
= phiên bản chung đã tích hợp

Swagger
= contract giữa BE và FE

Render Backend
= API server dùng chung

Render Frontend
= website dùng chung để test/demo

Mock Data
= giúp FE không phải chờ BE

End-to-End Test
= điều kiện để flow được coi là hoàn thành
```

## 22. Mô hình tổng kết

```text
                BUSINESS FLOW
                     │
            Analyze Requirements
                     │
                     ▼
              API Contract
               /          \
              /            \
             ▼              ▼
            BE              FE
       Code Logic       Mock + UI
             │              │
             ▼              │
          Swagger           │
             │              │
             ▼              │
        PR → main           │
             │              │
             ▼              │
        Render BE ──────────┘
             │
             ▼
        FE Integration
             │
             ▼
          E2E Test
             │
             ▼
        FE PR → main
             │
             ▼
        Render Frontend
             │
             ▼
            DONE
```

---

**Sports Center Management System – SCMS**

```text
Business Flow
→ API Contract
→ BE + FE Parallel Development
→ Render Integration
→ End-to-End Test
→ Done
```


---

# 23. Triển khai Frontend lên Render để BE và cả team cùng xem

Đây là cách khuyến nghị để Backend Team, Frontend Team và các thành viên khác có thể xem cùng một phiên bản giao diện mà không cần copy source hoặc gửi file ZIP cho nhau.

Mục tiêu:

```text
GitHub FE
   ↓
main
   ↓
Render Static Site
   ↓
Frontend Public URL
   ↓
Gọi API
   ↓
Render Backend
```

Backend hiện tại:

```text
https://scms-app-p1gy.onrender.com
```

Swagger:

```text
https://scms-app-p1gy.onrender.com/swagger-ui/index.html
```

OpenAPI JSON:

```text
https://scms-app-p1gy.onrender.com/v3/api-docs
```

## 23.1. Kiến trúc triển khai

```text
                 FRONTEND TEAM
                      │
                      ▼
              GitHub FE Repository
                      │
                    main
                      │
                      ▼
              Render Static Site
                      │
                      ▼
           https://<scms-fe>.onrender.com
                      │
                      │ HTTPS API Request
                      ▼
             Render Backend Service
                      │
                      ▼
      https://scms-app-p1gy.onrender.com
                      │
                      ▼
                   Database
```

## 23.2. Điều kiện trước khi deploy FE

Đảm bảo branch `main` có source chuẩn:

```text
FE_Project/
├── src/
├── package.json
├── pnpm-lock.yaml
├── vite.config.js
├── index.html
├── .gitignore
├── .env.example
└── README.md
```

Không commit:

```text
node_modules/
dist/
.env
.env.local
```

Kiểm tra local:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Nếu `pnpm build` thành công và tạo được `dist/` thì source đã sẵn sàng để deploy.

## 23.3. Tạo Static Site trên Render

1. Truy cập `https://render.com/` và đăng nhập bằng tài khoản có quyền truy cập GitHub repo FE.
2. Trong Render Dashboard chọn:

```text
New
→ Static Site
```

3. Kết nối GitHub nếu Render chưa được cấp quyền.
4. Chọn repository `FE_Project`.
5. Chọn branch:

```text
main
```

Không deploy môi trường chung từ các branch cá nhân như `HoangAnh`, `PhatTai`, `ThuyVy`.

Luồng đúng:

```text
Branch cá nhân
   ↓
Commit
   ↓
Push
   ↓
Pull Request
   ↓
Review
   ↓
Merge main
   ↓
Render FE Auto Deploy
```

## 23.4. Cấu hình build React/Vite

Nếu `package.json` nằm ngay root repository:

```text
Root Directory:
(blank)
```

Build Command:

```bash
corepack enable && pnpm install --frozen-lockfile && pnpm build
```

Publish Directory:

```text
dist
```

Tóm tắt:

```text
Service Type: Static Site
Repository: FE_Project
Branch: main
Build Command: corepack enable && pnpm install --frozen-lockfile && pnpm build
Publish Directory: dist
```

## 23.5. Cấu hình Backend URL cho Frontend

Không hard-code Backend URL trong từng component. Dùng Environment Variable:

```text
VITE_API_BASE_URL
```

Trong Render FE, vào `Environment` và thêm:

```env
VITE_API_ENABLED=true
VITE_API_BASE_URL=https://scms-app-p1gy.onrender.com
```

Luồng gọi API:

```text
Component
   ↓
xxxApi.js
   ↓
httpClient.js
   ↓
VITE_API_BASE_URL
   ↓
Render Backend
```

## 23.6. Không đưa secret vào biến VITE_*

Các biến `VITE_*` được build vào frontend và có thể bị đọc từ trình duyệt.

Chỉ dùng cho cấu hình public như:

```text
VITE_API_BASE_URL
VITE_API_ENABLED
```

Không dùng cho:

```text
VITE_DB_PASSWORD
VITE_SECRET_KEY
VITE_PRIVATE_TOKEN
VITE_DATABASE_URL
```

Secret phải nằm ở Backend / Render Backend Environment Variables.

## 23.7. React Router và lỗi 404 khi refresh

Nếu FE có các route như:

```text
/login
/member
/member/packages
/member/payments
/manager/dashboard
```

thì cần cấu hình Rewrite trên Render Static Site:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```

Nếu không, refresh trực tiếp một route có thể trả về `404 Not Found`.

## 23.8. Authentication, Session Cookie và CORS

SCMS hiện dùng session/cookie cho authentication. FE đang gọi API với:

```javascript
credentials: 'include'
```

Khi deploy:

```text
Frontend: https://<scms-fe>.onrender.com
Backend:  https://scms-app-p1gy.onrender.com
```

đây là hai origin khác nhau. Backend phải cho phép Frontend URL trong CORS và bật credentials.

Ví dụ về mặt logic:

```text
Allowed Origin: https://<scms-fe>.onrender.com
Allow Credentials: true
```

Nếu dùng cookie cross-origin, Backend cũng cần kiểm tra `Secure`, `SameSite`, HTTPS và session cookie.

Nếu cấu hình sai có thể xảy ra:

```text
Swagger Login: 200 OK
Postman Login: 200 OK
Frontend Login: 200 OK
nhưng GET /api/auth/me → 401 Unauthorized
```

Khi đó BE và FE cần kiểm tra chung CORS + cookie.

## 23.9. Deploy lần đầu

Sau khi điền cấu hình, chọn `Create Static Site`. Render sẽ thực hiện:

```text
Clone FE main
   ↓
Install dependencies
   ↓
pnpm build
   ↓
Create dist/
   ↓
Publish
```

Nếu thành công, Render sẽ cung cấp URL dạng:

```text
https://<service-name>.onrender.com
```

## 23.10. Kiểm tra sau khi deploy

FE cần kiểm tra tối thiểu:

1. Website mở được.
2. Login hoạt động.
3. DevTools → Network cho thấy request gọi tới `https://scms-app-p1gy.onrender.com/api/...`.
4. Sau login, `GET /api/auth/me` không trả về `401`.
5. Business flow chính chạy được end-to-end.
6. Refresh trực tiếp route như `/member/payments` không bị 404.

## 23.11. Cách Backend Team xem giao diện FE

Sau khi FE deploy thành công, gửi cho BE:

```text
Frontend Demo: https://<scms-fe>.onrender.com
Backend: https://scms-app-p1gy.onrender.com
Swagger: https://scms-app-p1gy.onrender.com/swagger-ui/index.html
```

Kèm flow cần test, ví dụ:

```text
Member Login
→ View Package
→ Payment
→ Staff Approval
```

BE không cần clone FE hoặc nhận file ZIP chỉ để xem UI. Họ chỉ cần mở Frontend Render URL.

## 23.12. Auto Deploy khi FE merge code mới

Sau khi Render theo dõi `main`:

```text
Developer branch
      ↓
Code
      ↓
Commit
      ↓
Push
      ↓
Pull Request
      ↓
Review
      ↓
Merge main
      ↓
Render phát hiện main thay đổi
      ↓
Build FE mới
      ↓
Deploy
      ↓
URL FE được cập nhật
```

BE không cần đổi URL sau mỗi lần deploy.

## 23.13. Nếu Render build thất bại

Kiểm tra:

```text
Render Dashboard
→ FE Static Site
→ Events / Logs
```

Các lỗi thường gặp:

```text
pnpm chưa khả dụng
package dependency lỗi
build script lỗi
import sai đường dẫn
environment variable thiếu
case-sensitive filename
```

Trước khi merge PR nên chạy:

```bash
pnpm install --frozen-lockfile
pnpm build
```

## 23.14. Workflow FE–BE sau khi có Render FE

```text
             BE TEAM
                │
          Code API Logic
                │
           PR → main
                │
                ▼
          Render Backend
                │
          Swagger/API Ready
                │
                ▼
             FE TEAM
                │
       Integrate Real API
                │
           PR → main
                │
                ▼
          Render Frontend
                │
                ▼
             E2E Test
                │
           ┌────┴────┐
           │         │
          PASS      FAIL
           │         │
           ▼         ▼
          DONE   Fix BE / FE
```

## 23.15. Quy tắc deploy FE cần nhớ

```text
1. Render FE chỉ theo dõi main.
2. Không deploy branch cá nhân làm môi trường chung.
3. FE dùng Render Backend URL qua VITE_API_BASE_URL.
4. Không hard-code API URL trong component.
5. Không đưa secret vào VITE_*.
6. Session/cookie phải test cùng CORS.
7. React Router cần Rewrite /* → /index.html.
8. Mỗi PR nên chạy pnpm build trước khi merge.
9. Merge main xong Render tự deploy.
10. BE xem UI qua URL Render FE.
```

## 23.16. Mục tiêu cuối cùng

Cả team có một môi trường integration/demo chung:

```text
Frontend Render
+
Backend Render
+
Database
```

Nhờ vậy có thể kiểm thử business flow từ đầu đến cuối mà không phụ thuộc vào máy local của từng thành viên.
