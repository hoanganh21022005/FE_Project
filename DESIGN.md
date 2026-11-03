---
name: SCMS Webzone Operations System
description: SCMS uses the shared blue/navy palette defined in src/index.css, with cyan accents and separate semantic status colors.
colors:
  brand-dark: "#202B46"
  brand-dark-hover: "#303B58"
  brand-primary: "#405BD5"
  brand-primary-hover: "#3349B5"
  brand-primary-active: "#283A98"
  brand-blue-soft: "#E8EDFC"
  brand-accent: "#24A9D2"
  brand-accent-dark: "#08799E"
  brand-accent-soft: "#98D9E8"
  brand-cyan: "#24A9D2"
  brand-purple: "#7860C4"
  brand-purple-dark: "#59429E"
  brand-lavender-soft: "#DDD5F2"
  brand-teal: "#168F83"
  brand-teal-dark: "#087368"
  brand-mint-soft: "#E0F3EE"
  brand-amber: "#E8B351"
  brand-lime: "#A5CD55"
  brand-sky-soft: "#98D9E8"
  bg-main: "#F5F7FC"
  bg-secondary: "#EEF2FA"
  text-secondary: "#52617C"
  text-muted: "#6B7890"
  surface-white: "#FFFFFF"
  border-neutral: "#DEE4F0"
  border-subtle: "#DEE4F0"
  success: "#15803D"
  success-bg: "#ECFDF5"
  success-border: "#A7F3D0"
  warning: "#B45309"
  warning-bg: "#FFFBEB"
  warning-border: "#FDE68A"
  info: "#2563EB"
  info-bg: "#F0F9FF"
  info-border: "#BAE6FD"
  danger: "#B42318"
  danger-bg: "#FEF2F2"
  danger-border: "#FECACA"
typography:
  headline:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0"
  title:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0"
  body:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0"
  mono:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand-primary}"
    textColor: "{colors.surface-white}"
    hoverBackgroundColor: "{colors.brand-primary-hover}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.brand-dark}"
    borderColor: "{colors.border-subtle}"
    hoverBackgroundColor: "{colors.bg-secondary}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface-white}"
    hoverBackgroundColor: "{colors.brand-dark}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  surface:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.brand-dark}"
    borderColor: "{colors.border-neutral}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: SCMS Webzone Operations System

## 1. Bảng màu hiện hành

Đồng bộ ngày 29/10/2026 theo commit `d2bf216`. Giữ cấu trúc Webzone hiện có; màu thương hiệu đã chuyển từ đỏ/đen sang xanh dương/navy với điểm nhấn cyan. Tài liệu này mô tả palette đã có, không yêu cầu thiết kế lại màn hình.

**Nguồn giá trị runtime:** `src/index.css`, phần `:root`. Tailwind dùng ánh xạ `@theme` trong cùng file. Khi đổi palette, cập nhật cả code và tài liệu; không tạo bộ màu riêng cho từng role.

| Vai trò | CSS token | Giá trị |
|---|---|---|
| Primary | `--brand-primary` | `#405BD5` |
| Primary hover | `--brand-primary-hover` | `#3349B5` |
| Primary pressed | `--brand-primary-active` | `#283A98` |
| Primary nhẹ | `--brand-blue-soft` | `#E8EDFC` |
| Sidebar / nền tối | `--brand-dark`, `--bg-sidebar` | `#202B46` |
| Hover nền tối | `--brand-dark-hover` | `#303B58` |
| Accent / cyan | `--brand-accent`, `--brand-cyan` | `#24A9D2` |
| Accent đậm / nhẹ | `--brand-accent-dark`, `--brand-accent-soft` | `#08799E` / `#98D9E8` |
| Nền trang | `--bg-main`, `--bg-page` | `#F5F7FC` |
| Card / modal | `--bg-card` | `#FFFFFF` |
| Nền phụ | `--bg-secondary` | `#EEF2FA` |
| Viền | `--border-color` | `#DEE4F0` |
| Chữ chính / phụ / muted | `--text-primary`, `--text-secondary`, `--text-muted` | `#202B46` / `#52617C` / `#6B7890` |
| Chữ trên nền tối | `--text-inverse` | `#FFFFFF` |

Màu hỗ trợ đã có: purple `#7860C4`, purple-dark `#59429E`, lavender-soft `#DDD5F2`, teal `#168F83`, teal-dark `#087368`, mint-soft `#E0F3EE`, amber `#E8B351`, lime `#A5CD55`, sky-soft `#98D9E8`. Dùng khi component hiện có cần phân nhóm; không thay màu primary bằng các màu này.

## 2. Trạng thái ngữ nghĩa

| Trạng thái | Token Tailwind | Giá trị | Nền / viền hỗ trợ |
|---|---|---|---|
| Thành công | `status-success` | `#15803D` | emerald-50 / emerald-200 |
| Cảnh báo | `status-warning` | `#B45309` | amber-50 / amber-200 |
| Thông tin | `status-info` | `#2563EB` | sky-50 / sky-200 |
| Lỗi / nguy hiểm | `status-error`, `status-danger` | `#B42318` | rose-50 / rose-200 |

Đỏ chỉ thể hiện lỗi, nguy hiểm hoặc hành động phá hủy. Không thay đỏ ngữ nghĩa thành xanh khi dọn màu thương hiệu. Luôn kèm nhãn/icon, không dùng màu làm dấu hiệu duy nhất. Success/Warning/Info không dùng chung màu primary chỉ để làm giao diện đồng màu.

Cyan trên trắng phù hợp làm điểm nhấn, không mặc định đủ tương phản cho chữ nhỏ. Dùng primary hoặc accent-dark cho chữ tương tác; kiểm màu foreground/background thực tế đạt 4.5:1 cho chữ thường, 3:1 cho chữ lớn. Không coi việc dùng token là bằng chứng mọi cặp màu đạt AA.

## 3. Components & Interactions

- **Primary button:** `bg-brand-primary hover:bg-brand-primary-hover active:bg-brand-primary-active text-white`.
- **Secondary button:** nền card, chữ primary/ink, viền border-color; hover nền secondary.
- **Destructive:** token status-error/danger, giữ ý nghĩa nguy hiểm; không dùng làm màu cho thao tác tạo/lưu/import thông thường.
- **Sidebar:** `bg-bg-sidebar text-text-inverse`; active `bg-brand-primary text-white border-brand-accent`; inactive dùng chữ sáng và hover brand-dark-hover.
- **Tab ngang:** chữ/viền primary; cyan chỉ là điểm nhấn bổ trợ.
- **Input:** nền card, viền border-color; focus `focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none`.
- **Header/card/modal/table:** dùng các token bg-card, bg-secondary, text-primary, text-secondary và border-color thay mã hex thương hiệu cũ.
- **Nút và control:** giữ cấu trúc component hiện có; touch target tối thiểu 44×44px, focus nhìn thấy được, disabled/loading rõ ràng. Thay palette không tự mở rộng thành thay layout hoặc flow.

Các alias cũ như `webzone-red`, `wz-primary`, `mlc-red`, `brand-flame` đã được ánh xạ sang primary xanh để tương thích. Tên có chữ red không còn bảo đảm giá trị đỏ. Code mới ưu tiên `brand-primary` và token trạng thái đúng nghĩa; không thêm alias màu cũ.

## 4. Typography & Data Hygiene

Ứng dụng hiện dùng Be Vietnam Pro cho nội dung và tiêu đề theo cấu hình trong `src/index.css`; dữ liệu số dùng `tabular-nums` khi phù hợp.

- Dùng Be Vietnam Pro theo cấu hình hiện hành trong `src/index.css`.
- Dùng `tabular-nums` cho mã định danh và dữ liệu số khi phù hợp.
- Không tạo ID giả `mem-*` / `stf-*` trong API mode. Dùng ID authoritative từ BE.

## 5. Quy tắc áp dụng và phối hợp

1. Không ghi trực tiếp đỏ thương hiệu cũ `#BA0000`, `#D62323`, `#BA1A1A` cho nút tạo/lưu hoặc active navigation. Dùng token hiện hành. Đỏ lỗi/destructive vẫn giữ theo mục2.
2. Không tạo palette mới theo role, gradient/hiệu ứng trang trí hoặc redesign ngoài scope. Các sắc purple/blue có token ở mục1 là màu hỗ trợ hợp lệ; không còn quy định cấm chúng tuyệt đối như tài liệu cũ.
3. Thành viên khác đang phụ trách toàn bộ trang Member. Việc đồng bộ màu ở API/context/Header hoặc component dùng chung phải kiểm phạm vi thay đổi để tránh xung đột; không sửa luồng Member trong task màu.
4. Cập nhật này không chứng nhận tất cả màn đã loại bỏ màu hardcode hoặc đã đạt accessibility; kiểm theo các màn thật được sửa.
