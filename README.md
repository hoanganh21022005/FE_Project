# FE_Project

Repository dành cho **Frontend Team** của dự án **Sports Center Management System (SCMS)**.

Tài liệu này hướng dẫn cách làm việc chung với repository bằng **GitHub Desktop + Visual Studio Code**, nhằm hạn chế conflict và tránh ghi đè code của thành viên khác.

---

## 1. Công cụ sử dụng

Frontend team sử dụng:

- **GitHub**: lưu trữ source code và Pull Request.
- **GitHub Desktop**: Fetch, Pull, Commit, Push, chuyển branch và theo dõi thay đổi.
- **Visual Studio Code**: chỉnh sửa source code.
- **React + JavaScript**: công nghệ frontend của dự án.
- **Figma**: tham khảo và thiết kế UI/UX.

---

## 2. Cấu trúc branch hiện tại

Repository hiện sử dụng `main` làm branch tích hợp chung và mỗi thành viên có một branch riêng:

```text
main
├── HoangAnh
├── PhatTai
└── ThuyVy
```

### Quy ước

- `main`: chứa phiên bản code chung đã được kiểm tra và tích hợp.
- `HoangAnh`: branch làm việc của Hoàng Anh.
- `PhatTai`: branch làm việc của Phát Tài.
- `ThuyVy`: branch làm việc của Thúy Vy.
- Không code trực tiếp trên `main` nếu không có sự thống nhất của nhóm.
- Mỗi thành viên chủ yếu commit và push lên branch của mình.
- Khi hoàn thành phần việc, tạo **Pull Request** từ branch cá nhân vào `main`.

---

## 3. Clone repository lần đầu

Mở **GitHub Desktop**:

```text
File
→ Clone repository...
→ URL
```

Repository URL:

```text
https://github.com/hoanganh21022005/FE_Project.git
```

Chọn thư mục lưu project trên máy, sau đó chọn:

```text
Clone
```

Sau khi clone xong:

```text
Repository
→ Open in Visual Studio Code
```

> Nếu project đã được clone trước đó thì không clone lại.  
> Chọn `File → Add Local Repository...` và trỏ đến thư mục `FE_Project` hiện có.

---

## 4. Chuyển sang branch của mình

Sau khi clone, GitHub Desktop có thể đang ở branch `main`.

Chọn:

```text
Current Branch
```

Sau đó chọn branch của mình, ví dụ:

```text
PhatTai
```

Kiểm tra phía trên GitHub Desktop phải hiển thị:

```text
Current branch: PhatTai
```

Trước khi bắt đầu code, luôn chọn:

```text
Fetch origin
```

Nếu xuất hiện:

```text
Pull origin
```

thì bấm `Pull origin` để lấy phiên bản mới nhất của branch về máy.

---

## 5. Quy trình làm việc hằng ngày

### Bắt đầu công việc

```text
Mở GitHub Desktop
        ↓
Chọn repository FE_Project
        ↓
Chọn branch cá nhân
        ↓
Fetch origin
        ↓
Pull origin (nếu có)
        ↓
Open in Visual Studio Code
        ↓
Bắt đầu code
```

### Sau khi code

Lưu file trong VS Code bằng:

```text
Ctrl + S
```

Quay lại GitHub Desktop và kiểm tra tab:

```text
Changes
```

Xem lại các file đã thay đổi trước khi commit.

Nhập nội dung vào ô:

```text
Summary (required)
```

Ví dụ:

```text
Add member management UI
```

Sau đó chọn:

```text
Commit to PhatTai
```

Cuối cùng:

```text
Push origin
```

Quy trình đầy đủ:

```text
Code
 ↓
Test
 ↓
Review Changes
 ↓
Commit
 ↓
Push origin
```

---

## 6. Quy tắc Commit Message

Không nên dùng các commit message quá chung chung như:

```text
fix
update
code
new
sua loi
```

Nên mô tả rõ thay đổi:

```text
Add member list UI
Add member detail view
Fix sidebar layout
Fix login form validation
Connect member API
Update bilingual labels
Refactor dashboard components
```

Mỗi commit nên tập trung vào một nhóm thay đổi có liên quan.

---

## 7. Đưa code vào main bằng Pull Request

Khi phần việc trên branch cá nhân đã hoàn thành và đã push lên GitHub:

```text
GitHub Desktop
→ Preview Pull Request
```

Hoặc mở repository trên GitHub và vào:

```text
Pull requests
→ New pull request
```

Ví dụ:

```text
base: main
compare: PhatTai
```

Đặt tiêu đề rõ ràng:

```text
Add Member Management UI
```

Mô tả những thay đổi chính, sau đó tạo Pull Request.

Thành viên khác nên review trước khi merge.

Khi Pull Request ổn:

```text
Merge pull request
```

Kết quả:

```text
PhatTai
   ↓
 Pull Request
   ↓
 main
```

---

## 8. Cập nhật code mới từ main vào branch cá nhân

Nếu một thành viên khác đã merge code mới vào `main`, branch cá nhân của bạn chưa tự động có thay đổi đó.

Thực hiện theo thứ tự:

```text
1. Commit và Push hết phần code đang làm trên branch cá nhân.
2. Chuyển sang main.
3. Fetch origin.
4. Pull origin.
5. Chuyển lại branch cá nhân.
6. Merge/Update main vào branch cá nhân.
```

Ví dụ với branch `PhatTai`:

```text
Current Branch → main
Fetch origin
Pull origin

Current Branch → PhatTai

Branch
→ Update from main
```

Nếu phiên bản GitHub Desktop không có `Update from main`, sử dụng:

```text
Branch
→ Merge into current branch...
→ main
```

Hướng merge đúng khi cập nhật code là:

```text
main
 ↓
PhatTai
```

Không phải:

```text
PhatTai
 ↓
main
```

Việc đưa branch cá nhân vào `main` nên thực hiện bằng Pull Request.

---

## 9. Xử lý Merge Conflict

Conflict thường xảy ra khi hai thành viên cùng sửa một đoạn code trong cùng file.

GitHub Desktop sẽ thông báo các file bị conflict.

Mở file đó trong VS Code. VS Code thường hiển thị các lựa chọn như:

```text
Accept Current Change
Accept Incoming Change
Accept Both Changes
```

Không chọn ngẫu nhiên.

Hãy kiểm tra code của cả hai phía, giữ lại logic đúng, sau đó:

```text
Save
→ Mark as resolved / Continue merge
→ Commit
→ Push origin
```

Nếu chưa chắc nên giữ code nào, trao đổi với thành viên đã sửa cùng file trước khi hoàn tất merge.

---

## 10. Những điều không nên làm

### Không push `node_modules`

File `.gitignore` cần có:

```gitignore
node_modules/
dist/
.env
```

### Không push thông tin bí mật

Không commit các dữ liệu như:

```text
password
API key
secret key
database credential
```

### Không Force Push nếu chưa thống nhất

Nếu GitHub Desktop hiện:

```text
Force push origin
```

không nên bấm nếu chưa hiểu nguyên nhân.

Force Push có thể làm thay đổi lịch sử commit và ảnh hưởng code của thành viên khác.

### Không sửa trực tiếp main tùy ý

Luồng khuyến nghị:

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
     main
```

---

## 11. Khi Push bị từ chối

Nếu gặp lỗi Push do remote có commit mới, không Force Push ngay.

Thử:

```text
Fetch origin
```

Sau đó lấy thay đổi mới về, xử lý conflict nếu có, rồi:

```text
Push origin
```

---

## 12. Kiểm tra branch trước khi code

Trước khi sửa bất kỳ file nào, luôn nhìn:

```text
Current branch
```

Ví dụ Phát Tài cần thấy:

```text
Current branch: PhatTai
```

Không nên bắt đầu code nếu vẫn đang ở:

```text
Current branch: main
```

trừ khi cả nhóm đã thống nhất thực hiện thay đổi trực tiếp trên `main`.

---

## 13. Workflow nhanh cần ghi nhớ

```text
BẮT ĐẦU

Fetch
  ↓
Pull
  ↓
Chọn branch cá nhân
  ↓
Open VS Code
  ↓
Code
  ↓
Test
  ↓
Review Changes
  ↓
Commit
  ↓
Push
  ↓
Pull Request
  ↓
Review
  ↓
Merge vào main
```

---

## 14. Quy tắc phối hợp trong nhóm

Trước khi sửa một chức năng lớn hoặc file dùng chung, nên thông báo cho các thành viên còn lại để tránh nhiều người chỉnh cùng một phần.

Các file dễ xảy ra conflict thường là:

```text
package.json
routes
App.jsx / App.js
sidebar
navigation
global styles
API config
```

Nếu phải cùng sửa các file này, nên thống nhất trước ai sẽ thực hiện thay đổi chính.

---

## 15. Lưu ý về package manager

Trước khi cài dependency, kiểm tra project đang sử dụng package manager nào.

Nếu repository có:

```text
pnpm-lock.yaml
```

ưu tiên:

```bash
pnpm install
```

Nếu repository có:

```text
package-lock.json
```

ưu tiên:

```bash
npm install
```

Không tự ý tạo nhiều lock file khác nhau trong cùng project nếu nhóm chưa thống nhất.

---

## Team

Frontend Team - Sports Center Management System (SCMS)

Repository:

```text
https://github.com/hoanganh21022005/FE_Project
```
