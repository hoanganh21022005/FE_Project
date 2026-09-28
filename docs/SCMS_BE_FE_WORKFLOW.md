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
