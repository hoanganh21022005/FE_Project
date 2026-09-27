# SCMS Frontend — FE_Project

Frontend repository của **Sports Center Management System (SCMS)**.

Repo này là **source of truth của Frontend Team**. Sau khi baseline được merge vào `main`, tất cả thành viên FE phải clone/pull từ repo này và không tiếp tục code trên bản source ZIP/Figma cũ.

---

## 1. Tech stack

- React 19
- JavaScript / JSX
- Vite 8
- Tailwind CSS 4
- pnpm
- GitHub + GitHub Desktop
- Backend API: Spring Boot (do BE team cung cấp qua Swagger/OpenAPI)
- Deployment: Render

---

## 2. Branch hiện tại của team

```text
main
├── HoangAnh
├── PhatTai
└── ThuyVy
```

Quy ước:

- `main`: source FE chung đã được review/tích hợp.
- `HoangAnh`, `PhatTai`, `ThuyVy`: branch làm việc cá nhân hiện tại.
- Không code trực tiếp trên `main` nếu nhóm chưa thống nhất.
- Hoàn thành phần việc: branch cá nhân → Push → Pull Request → `main`.
- Khi `main` có code mới: cập nhật `main` trước rồi merge/update `main` vào branch cá nhân.

---

## 3. Cấu trúc folder chuẩn

```text
FE_Project/
│
├── .env.example             # Mẫu biến môi trường cho API thật
├── .env.mock                # Chế độ UI/mock, được phép commit
├── .gitattributes           # Chuẩn hóa line ending text
├── .gitignore               # File/folder không đưa lên Git
│
├── index.html               # HTML entry của Vite
├── jsconfig.json            # Alias @/* và hỗ trợ VS Code cho JS/JSX
├── package.json             # Dependencies + scripts
├── pnpm-lock.yaml           # Lock dependency; phải commit
├── vite.config.js           # Vite config độc lập Figma
├── README.md                # Tài liệu chung cho FE team
│
└── src/
    ├── api/                 # Chỉ chứa code giao tiếp Backend API
    │   ├── apiErrors.js     # Chuẩn hóa lỗi API
    │   ├── httpClient.js    # fetch wrapper, credentials, API base URL
    │   ├── authApi.js       # Login / me / logout
    │   ├── managerApi.js    # API manager đã tích hợp ở baseline
    │   └── mappers.js       # Map response BE → model FE
    │
    ├── components/
    │   ├── common/          # Component tái sử dụng: Badge, Toast...
    │   ├── layout/          # Header, Sidebar...
    │   ├── modals/          # Modal/form dùng trong các flow
    │   └── views/           # Các màn hình theo role/flow hiện tại
    │
    ├── context/
    │   └── SCMSContext.jsx  # State/context hiện tại + mock fallback
    │
    ├── locales/
    │   └── translations.js  # VI/EN translations
    │
    ├── App.jsx              # Điều phối view theo role/tab
    ├── main.jsx             # React entry point
    └── index.css            # Tailwind + global styles
```

### Folder sẽ tạo thêm khi thật sự cần

Không cần tạo folder rỗng chỉ để "đẹp cấu trúc". Khi flow mới phát sinh, có thể thêm:

```text
src/
├── hooks/                   # Custom hooks dùng lại nhiều nơi
├── utils/                   # Formatter/helper thuần JS
├── mocks/                   # Tách mock data khỏi SCMSContext
└── constants/               # Enum/status/config dùng chung
```

Khi số lượng view tăng mạnh, team có thể refactor `components/views` thành `features/<business-flow>/`, nhưng **không nên đổi cấu trúc lớn giữa lúc một sprint đang tích hợp API**.

---

## 4. Source baseline lấy từ đâu?

Baseline được lấy từ source FE cũ:

```text
SWP391/SCMS_demo_fe_v1.1/
```

Nhưng repo mới **không copy nguyên thư mục này**. Nội dung cần thiết được đặt trực tiếp tại root `FE_Project`.

Đúng:

```text
FE_Project/
├── src/
├── package.json
├── vite.config.js
└── ...
```

Không dùng:

```text
FE_Project/
└── SCMS_demo_fe_v1.1/
    ├── src/
    └── package.json
```

Khi mở VS Code, phải mở folder chứa trực tiếp `package.json`:

```text
D:\School\FA26\SWP391\Project\FE_Project
```

---

## 5. File/folder từ source cũ: giữ, bỏ, thay thế

### GIỮ

```text
src/App.jsx
src/main.jsx
src/index.css
src/api/
src/components/common/
src/components/layout/
src/components/modals/
src/components/views/
src/context/SCMSContext.jsx
src/locales/translations.js
index.html
package.json
pnpm-lock.yaml
```

### BỎ KHỎI BASELINE

```text
node_modules/                 # Cài lại bằng pnpm install
dist/                         # Build output
.git/                         # Không copy Git history của source cũ
.figma/                       # Chỉ phục vụ Figma Make
AGENTS.md                     # Agent/Figma-specific
CLAUDE.md                     # Agent-specific
.mise.toml                    # Toolchain Figma cũ, không dùng chung team hiện tại
README_LOCAL.md               # Nội dung đã được gộp vào README này
vite.local.config.js          # Được thay bằng mode mock trong vite.config.js
vite.config.ts                # Figma-specific, được thay bằng vite.config.js sạch
tsconfig.json                 # Source chính là JS/JSX; dùng jsconfig.json
src/App.tsx                   # Chỉ là wrapper của App.jsx
src/main.tsx                  # Chỉ là wrapper của main.jsx
src/types/scms.js             # File lỗi/không được import
src/components/views/HomeView.jsx  # Không nằm trong import graph hiện tại
src/imports/                  # Asset/text import từ Figma hiện không được source sử dụng
```

### KHÔNG ĐƯỢC COMMIT

```text
node_modules/
dist/
.env
.env.local
.env.*.local
*.log
```

Nếu sau này có ảnh/assets thật sự được UI sử dụng, đặt vào vị trí rõ ràng như:

```text
src/assets/
```

hoặc static assets:

```text
public/
```

Không khôi phục toàn bộ `src/imports/` cũ nếu không có file nào sử dụng chúng.

---

## 6. Setup lần đầu

### Yêu cầu

Khuyến nghị dùng Node.js LTS/phiên bản team đã thống nhất và pnpm.

Kiểm tra:

```powershell
node --version
pnpm --version
```

Cài dependency:

```powershell
pnpm install --frozen-lockfile
```

---

## 7. Chạy frontend không cần Backend (mock mode)

Dùng khi BE chưa hoàn thiện API của business flow đang làm:

```powershell
pnpm dev:local
```

Ứng dụng đọc:

```text
.env.mock
VITE_API_ENABLED=false
```

Luồng:

```text
React UI
   ↓
SCMSContext
   ↓
Mock data
```

Mục đích của mock mode là để FE tiếp tục làm UI/UX, validation và state trong khi chờ API thật.

Mock data phải bám gần với request/response schema đã thống nhất trong Swagger để giảm công sửa khi tích hợp.

---

## 8. Chạy với Backend API thật

Copy file:

```text
.env.example
```

thành:

```text
.env.local
```

Ví dụ khi Spring Boot chạy local ở port 8080:

```env
VITE_API_ENABLED=true
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=http://localhost:8080
```

Sau đó:

```powershell
pnpm dev
```

Vite sẽ proxy request `/api/...` sang Spring Boot local.

> `.env.local` không được commit.

---

## 9. Khi Backend deploy trên Render

FE cần environment variables tương tự:

```env
VITE_API_ENABLED=true
VITE_API_BASE_URL=https://<backend-service>.onrender.com
```

`httpClient.js` sẽ ghép `VITE_API_BASE_URL` với endpoint `/api/...`.

Ví dụ:

```text
React Render
https://<frontend>.onrender.com
        ↓ HTTPS
Spring Boot Render
https://<backend>.onrender.com
        ↓
Database
```

Nếu BE đang dùng session/cookie authentication (`credentials: include`), BE phải cấu hình CORS/cookie phù hợp cho domain FE trên Render.

---

## 10. Quy tắc tạo API phía FE

Không gọi `fetch()` trực tiếp rải rác trong component/view.

Luồng chuẩn:

```text
View / Modal
    ↓
Context / state handler
    ↓
xxxApi.js
    ↓
httpClient.js
    ↓
Backend
```

API hiện có:

```text
src/api/authApi.js
src/api/managerApi.js
```

Khi triển khai flow mới, ưu tiên tách file theo nghiệp vụ:

```text
src/api/memberApi.js
src/api/membershipApi.js
src/api/bookingApi.js
src/api/paymentApi.js
src/api/attendanceApi.js
src/api/trainingApi.js
src/api/reportApi.js
```

Không tiếp tục nhét mọi endpoint mới vào một file `managerApi.js` duy nhất.

Endpoint, request body, response body và status phải lấy theo **Swagger/OpenAPI của BE**.

---

## 11. Cách FE làm theo từng Business Flow

Ví dụ sprint đang làm **Payment flow**:

```text
Member login
→ View packages
→ Select package
→ Create payment
→ Staff views payment
→ Staff approve/reject
→ Membership updated
```

FE thực hiện:

1. Đọc flow và xác định actor/screen liên quan.
2. Kiểm tra màn hình nào đã có trong baseline.
3. Đọc Swagger của BE.
4. Nếu BE chưa xong: làm UI bằng `pnpm dev:local`.
5. Tạo/sửa API adapter trong `src/api/`.
6. Chuyển UI từ mock sang API thật.
7. Xử lý loading, empty state, validation, success/error.
8. Test toàn bộ flow end-to-end.
9. Commit → Push branch cá nhân → Pull Request → `main`.

### Definition of Done của một FE flow

Một flow chỉ được xem là hoàn thành khi:

- UI đúng nghiệp vụ đã thống nhất.
- Không còn thao tác chính phụ thuộc hard-code/mock nếu API tương ứng đã hoàn thành.
- Request/response khớp Swagger.
- Loading/error/empty state cơ bản hoạt động.
- Role đúng mới truy cập/thao tác được.
- End-to-end flow chạy được với backend deploy hoặc backend local.
- Không có lỗi console nghiêm trọng.
- Code đã được Push và review trước khi merge `main`.

---

## 12. Workflow GitHub Desktop hằng ngày

### Trước khi code

```text
Open GitHub Desktop
        ↓
FE_Project
        ↓
Chọn branch cá nhân
        ↓
Fetch origin
        ↓
Pull origin (nếu có)
        ↓
Open in Visual Studio Code
```

Luôn kiểm tra:

```text
Current branch: <Tên branch của bạn>
```

Không bắt đầu sửa source khi đang đứng ở `main` nếu không có chủ đích.

### Sau khi code

```text
Save
 ↓
Test
 ↓
Review Changes
 ↓
Commit
 ↓
Push origin
```

Commit message tốt:

```text
Add member payment form
Connect package API
Fix payment status mapping
Add staff payment approval UI
```

Tránh:

```text
fix
update
code moi
sua
```

---

## 13. Pull Request vào main

Khi phần việc ổn định:

```text
Branch cá nhân
      ↓
    Push
      ↓
 Pull Request
      ↓
    Review
      ↓
     main
```

Ví dụ:

```text
base: main
compare: PhatTai
```

PR phải mô tả ngắn:

- Flow/task đã làm.
- Screen đã sửa.
- API đã tích hợp.
- Cách test.
- Điểm chưa hoàn thiện (nếu có).

---

## 14. Khi main có code mới

Trước tiên đảm bảo code branch cá nhân đã Commit/Push.

```text
Current Branch → main
Fetch origin
Pull origin

Current Branch → <branch cá nhân>
Branch → Update from main
```

Nếu GitHub Desktop không có `Update from main`:

```text
Branch
→ Merge into current branch...
→ main
```

Hướng cập nhật là:

```text
main
 ↓
branch cá nhân
```

Không dùng thao tác này như cách tùy ý merge branch cá nhân vào `main`; việc đó nên qua Pull Request.

---

## 15. Merge conflict

Conflict thường xảy ra ở các file dùng chung như:

```text
package.json
src/App.jsx
src/context/SCMSContext.jsx
src/components/layout/Sidebar.jsx
src/locales/translations.js
src/api/httpClient.js
```

Khi conflict:

1. Không chọn Current/Incoming một cách ngẫu nhiên.
2. Mở file bằng VS Code.
3. So sánh logic hai phía.
4. Trao đổi với người đã sửa cùng file nếu cần.
5. Resolve → Save → Continue merge → Test → Push.

Không Force Push nếu team chưa thống nhất.

---

## 16. Quy tắc thay đổi dependencies

Trước khi cài thêm thư viện, hỏi/trao đổi với team nếu thư viện ảnh hưởng toàn project.

Dùng pnpm:

```powershell
pnpm add <package>
```

hoặc dev dependency:

```powershell
pnpm add -D <package>
```

Sau khi thay đổi dependency, phải commit cả:

```text
package.json
pnpm-lock.yaml
```

Không xóa hoặc tự tạo `package-lock.json` / `yarn.lock` nếu team đang dùng pnpm.

---

## 17. Quick start

### UI/mock mode

```powershell
pnpm install --frozen-lockfile
pnpm dev:local
```

### Real API mode

```powershell
Copy-Item .env.example .env.local
# chỉnh .env.local nếu cần
pnpm dev
```

### Build

```powershell
pnpm build
```

---

## 18. Nguyên tắc quan trọng nhất

```text
GitHub FE_Project = source of truth
```

Không tiếp tục phát triển trên bản ZIP hoặc bản Figma export cũ sau khi baseline đã merge vào `main`.

Mọi thành viên bắt đầu từ cùng một `main`, làm việc trên branch của mình và đồng bộ qua GitHub.
