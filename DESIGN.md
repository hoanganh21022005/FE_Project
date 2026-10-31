---
name: SCMS Operations System
description: A clear, unified design system for sports-center administration across member, staff, and management portals using the SCMS palette.
colors:
  deep-navy: "#202B46"
  royal-blue: "#405BD5"
  cyan: "#24A9D2"
  purple: "#7860C4"
  teal: "#168F83"
  amber: "#E8B351"
  lime: "#A5CD55"
  sky: "#98D9E8"
  lavender: "#DDD5F2"
  mint: "#E0F3EE"
  background: "#F5F7FC"
  white: "#FFFFFF"
  text-primary: "#202B46"
  text-secondary: "#323B52"
  border-neutral: "#DDDFF0"
  border-subtle: "#E7EAF3"
  success: "#168F83"
  success-bg: "#E0F3EE"
  success-border: "#A6D9CC"
  warning: "#E8B351"
  warning-bg: "#FFF4D6"
  warning-border: "#E8B351"
  info: "#24A9D2"
  info-bg: "#E5F7FB"
  info-border: "#98D9E8"
  danger: "#8E0000"
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
    backgroundColor: "{colors.royal-blue}"
    textColor: "{colors.white}"
    hoverBackgroundColor: "{colors.deep-navy}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.deep-navy}"
    borderColor: "{colors.border-subtle}"
    hoverBackgroundColor: "{colors.background}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    hoverBackgroundColor: "{colors.deep-navy}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  surface:
    backgroundColor: "{colors.white}"
    textColor: "{colors.deep-navy}"
    borderColor: "{colors.border-neutral}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: SCMS Operations System

## 1. Overview

**Creative North Star: "Bảng Điều Hành SCMS Rõ Ràng & Nhất Quán"**

Hệ thống SCMS (các phân hệ Admin, Center Manager, Coach, Receptionist, Member và Public/Auth) sử dụng chung một ngôn ngữ thiết kế dựa trên bảng màu trong ảnh tham chiếu:
- **Nền:** Background (`#F5F7FC`) tạo canvas sáng, dịu mắt; White (`#FFFFFF`) dùng cho bề mặt nội dung.
- **Văn bản:** Deep Navy (`#202B46`) làm màu chữ chính; dùng màu chữ phụ có độ tương phản phù hợp trên từng bề mặt.
- **Hành động & nhấn:** Royal Blue (`#405BD5`) làm hành động chính; Cyan (`#24A9D2`), Teal (`#168F83`) và Purple (`#7860C4`) tạo phân cấp nhấn.
- **Màu bổ trợ:** Amber (`#E8B351`), Lime (`#A5CD55`), Sky (`#98D9E8`), Lavender (`#DDD5F2`) và Mint (`#E0F3EE`) dùng cho trạng thái, nhóm nội dung và nền nhấn nhẹ.

Tài liệu này là **nguồn sự thật duy nhất (Single Source of Truth)** chốt lại toàn bộ quy chuẩn màu sắc, token ngữ nghĩa và quy tắc tương tác cho toàn bộ hệ thống.

---

## 2. Bảng Màu SCMS Chuẩn Hóa

### 2.1. Bảng màu cốt lõi

| Màu | Hex | Vai trò trong hệ thống |
|---|:---:|---|
| **Deep Navy** | `#202B46` | Chữ chính, điều hướng đậm, tiêu đề và thành phần cần độ tương phản cao |
| **Royal Blue** | `#405BD5` | Nút chính, liên kết và trạng thái điều hướng đang chọn |
| **Cyan** | `#24A9D2` | Điểm nhấn phụ, thông tin và biểu đồ |
| **Purple** | `#7860C4` | Điểm nhấn cho nhóm nội dung và phân loại |
| **Teal** | `#168F83` | Thành công, trạng thái tích cực và điểm nhấn phụ |
| **Amber** | `#E8B351` | Cảnh báo nhẹ, nhãn và điểm nhấn ấm |
| **Lime** | `#A5CD55` | Trạng thái tích cực và nhấn nhẹ |
| **Sky** | `#98D9E8` | Nền thông tin và bề mặt nhấn nhẹ |
| **Lavender** | `#DDD5F2` | Bề mặt phụ và nhóm nội dung |
| **Mint** | `#E0F3EE` | Bề mặt trạng thái tích cực |
| **Background** | `#F5F7FC` | Canvas chính cho trang và khu vực nội dung |
| **White** | `#FFFFFF` | Thẻ, modal, bảng và bề mặt nội dung |

### 2.2. Ánh Xạ Ngữ Nghĩa Bắt Buộc (Semantic Token Mapping)

- **Primary Button:** Nền `#405BD5` (Royal Blue), hover/pressed `#202B46` (Deep Navy), chữ `#FFFFFF`.
- **Focus Ring / Accent:** Dùng Royal Blue (`#405BD5`) với viền rõ và trạng thái focus nhìn thấy được. Không dùng màu nhấn sáng làm body text nếu không đạt tương phản WCAG AA 4.5:1.
- **Văn bản chính:** Deep Navy (`#202B46`) trên nền White (`#FFFFFF`) hoặc Background (`#F5F7FC`).
- **Văn bản phụ:** Chọn sắc độ đủ đậm để đạt WCAG AA trên nền tương ứng; không dùng các màu nền nhạt làm màu chữ nhỏ.
- **Bề mặt hỗ trợ:** White (`#FFFFFF`) cho card, modal và bảng; Background (`#F5F7FC`) cho canvas; Sky, Lavender và Mint dành cho vùng nhấn nhẹ.
- **Trạng thái ngữ nghĩa riêng biệt (Semantic States):**
  - **Success:** Teal `#168F83` hoặc Lime `#A5CD55`, nền Mint `#E0F3EE`.
  - **Warning:** Amber `#E8B351`, dùng chữ Deep Navy `#202B46` trên nền Amber.
  - **Info:** Cyan `#24A9D2`, nền Sky `#98D9E8`.
  - **Danger / Destructive:** Đỏ `#8E0000`, nền `bg-rose-50`, viền `border-rose-200` là màu trạng thái bổ sung ngoài palette.
  - **Quy tắc trạng thái:** Không dùng một màu thương hiệu thay thế cho mọi trạng thái; mọi trạng thái phải có nhãn văn bản rõ ràng, không chỉ dựa vào màu sắc.

### 2.3. Quy Tắc Chống Lạm Dụng (Anti-Patterns Prohibited)

- **Tránh:** Gradient màu, glassmorphism/blur, đốm sáng orb, vạch viền dày hơn 1px, negative letter spacing và lồng card nhiều cấp. Các màu Purple và Lavender trong palette được phép dùng theo vai trò đã định nghĩa.

---

## 3. Typography & Data Hygiene

- **Font toàn hệ thống:** Be Vietnam Pro cho nội dung, tiêu đề, biểu mẫu, mã định danh và số liệu; kích thước cơ bản 14px (`0.875rem`), khoảng cách dòng 1.5.
- **Số liệu kỹ thuật:** Dùng Be Vietnam Pro cùng `tabular-nums` để giữ các chữ số thẳng hàng.

---

## 4. Components & Interactions

- **Buttons:** Bo góc chuẩn `rounded-md` (4px - 6px). Chiều cao tối thiểu tiếp cận di động `min-h-[44px]`, padding `px-4 py-2.5`.
- **Navigation Items (Sidebar & Tabs):**
  - Active: Nền `#405BD5`, chữ `#FFFFFF`, font-bold trên Deep Navy; hoặc `border-b-2 border-[#405BD5] text-[#405BD5]` trên tab ngang.
  - Inactive: Chữ trắng dịu trên Deep Navy; chuyển sang White khi hover và dùng nền tối hơn để tăng phân biệt.
  - Touch target: Tối thiểu 44px x 44px.
- **Inputs & Filters:** Nền White, viền trung tính rõ; focus dùng `focus:border-[#405BD5] focus:ring-2 focus:ring-[#405BD5]/20 focus:outline-none`.
- **Tables:** Header dùng Background `#F5F7FC` với chữ Deep Navy; phân dòng bằng viền trung tính mảnh, hỗ trợ `tabular-nums` chống xô lệch.

---

## 5. Quy Tắc Khóa Hệ Thống (Design System Locks)

1. **Tính nhất quán:** Toàn bộ 5 role portals và trang công khai dùng SCMS Palette được định nghĩa trong tài liệu này; chỉ dùng màu ngoài palette cho các trạng thái ngữ nghĩa cần thiết như lỗi nghiêm trọng.
2. **Quy chuẩn tiếp cận:** Tất cả nút bấm, liên kết và control tương tác phải đạt tối thiểu `44px x 44px` trên touch layout.
3. **Quy chuẩn định danh:** Không tạo chuỗi ID giả `mem-*` / `stf-*` trong API mode. Mọi ID hiển thị phải là số nguyên authoritative từ BE.
