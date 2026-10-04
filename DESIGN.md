---
name: SCMS Unified System (Firebase & Fireside Palette)
description: A coherent, battle-tested operating system for sports-center administration, unified across member and management portals.
colors:
  canvas-pearl: "#F7F5F0"
  canvas-admin: "#F7F8FA"
  surface-white: "#FFFFFF"
  ink-primary: "#1C1917"
  ink-secondary: "#44403C"
  ink-muted: "#78716C"
  border-subtle: "#E7E5E4"
  border-card: "#E2E8F0"
  brand-flame: "#EA580C"
  brand-flame-hover: "#C2410C"
  brand-amber: "#F59E0B"
  brand-soft-bg: "#FFF7ED"
  brand-soft-border: "#FED7AA"
  brand-dark: "#0F172A"
  success: "#047857"
  danger: "#B91C1C"
  warning: "#D97706"
typography:
  headline:
    fontFamily: "Roboto, Segoe UI, Arial, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0"
  title:
    fontFamily: "Roboto, Segoe UI, Arial, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0"
  body:
    fontFamily: "Roboto, Segoe UI, Arial, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Roboto, Segoe UI, Arial, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0"
  mono:
    fontFamily: "JetBrains Mono, monospace"
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
    backgroundColor: "{colors.brand-flame}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  button-dark:
    backgroundColor: "{colors.brand-dark}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    borderColor: "{colors.border-subtle}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  surface:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-primary}"
    borderColor: "{colors.border-card}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: SCMS Unified System (Firebase & Fireside Palette)

## 1. Overview

**Creative North Star: "Bàn Điều Hành Đồng Bộ & Đáng Tin Cậy (Unified Operations Console)"**

Theo định hướng chính thức từ Chủ dự án, toàn bộ hệ thống SCMS (bao gồm cả portal Admin và các phân hệ Center Manager, Coach, Receptionist, Member) sử dụng **chung một ngôn ngữ thiết kế đồng bộ** dựa trên bảng màu **Firebase & Fireside** ấm áp, chuyên nghiệp:
- **Nền tảng:** Canvas trung tính sáng (`#F7F5F0` cho khu vực hội viên và `#F7F8FA` cho khu vực vận hành chuyên sâu).
- **Mặt phẳng làm việc:** Bề mặt trắng tinh khiết (`#FFFFFF`) với viền mỏng tiêu chuẩn (`#E2E8F0` / `stone-200`).
- **Màu nhấn thương hiệu chủ đạo (Brand Accent):** Gam màu lửa Firebase/Fireside (`#EA580C` - Orange-600 / `#F59E0B` - Amber-500) kết hợp khối tương phản than tối (`#0F172A` / `#1C1917` - Slate-900).
- **Trạng thái kích hoạt (Active State):** Nền cam nhạt `bg-orange-50`, chữ cam đậm `text-orange-700`, vạch viền chỉ báo `border-l-2 border-orange-600` – thống nhất 100% giữa Sidebar Admin và Sidebar hệ thống chính.

Tài liệu này là **nguồn sự thật duy nhất (Single Source of Truth)** chốt lại toàn bộ quy chuẩn màu sắc và kiểu dáng cho các giai đoạn thiết kế hiện tại và về sau.

## 2. Colors: Bảng màu Firebase & Fireside chuẩn hóa

### Primary & Accent
- **Flame / Firebase Orange** (`#EA580C` - Tailwind `orange-600`): Màu nhấn hành động chính, focus ring, viền active, đường link quan trọng.
- **Amber Glow** (`#F59E0B` - Tailwind `amber-500`): Biểu tượng thương hiệu, điểm nhấn trạng thái, huy hiệu sao.
- **Flame Soft** (`#FFF7ED` - Tailwind `orange-50`): Nền mục navigation đang chọn, nền badge cảnh báo nhẹ.
- **Flame Border** (`#FED7AA` - Tailwind `orange-200`): Đường viền cho chip và pill trạng thái nổi bật.

### Neutrals & Surfaces
- **Pearl Canvas** (`#F7F5F0`): Nền ứng dụng chính và trang công khai.
- **Admin Canvas** (`#F7F8FA`): Nền trung tính riêng cho không gian quản trị.
- **Surface White** (`#FFFFFF`): Panel, thẻ dữ liệu (card), modal, bảng và thanh điều hướng.
- **Ink Primary** (`#1C1917` / `#2D2721`): Tiêu đề, số liệu chính và văn bản quan trọng.
- **Ink Muted** (`#78716C`): Metadata, nhãn cột, placeholder.
- **Border Neutral** (`#E2E8F0` / `#E7E5E4`): Viền thẻ, đường kẻ phân cách trong bảng.
- **Dark Contrast** (`#0F172A` / `#1C1917`): Nền huy hiệu logo, nút nhấn tương phản cao.

### Semantic Status
- **Success / Synchronized:** `#047857` (Emerald-700) / nền `bg-emerald-50` / viền `border-emerald-200`.
- **Danger / Locked:** `#B91C1C` (Red-700) / nền `bg-rose-50` / viền `border-rose-200`.
- **Warning / Grace Period:** `#D97706` (Amber-600) / nền `bg-amber-50` / viền `border-amber-200`.

## 3. Typography

- **Display & Body Font:** Roboto (với Segoe UI và system-ui fallback), đảm bảo hiển thị tiếng Việt hoàn hảo.
- **Technical & Numeric Font:** JetBrains Mono dành cho toàn bộ ID người dùng, mã nhân viên/hội viên, mã quyền RBAC, ngày giờ nhật ký và số liệu thống kê `tabular-nums`.

## 4. Components & Interactions

- **Buttons:** Bo góc chuẩn `4px` - `6px`. Chiều cao tối thiểu đạt chuẩn tiếp cận di động `min-h-[44px]`.
- **Navigation Items:**
  - Active: `bg-orange-50 text-orange-700 font-bold border-l-2 border-orange-600 shadow-2xs`
  - Inactive: `text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium`
  - Touch target: tối thiểu 44px x 44px.
- **Inputs & Filters:** Nền trắng, viền rõ `border-stone-300`, focus ring chuẩn `focus:border-orange-600 focus:ring-2 focus:ring-orange-100`.
- **Tables:** Header xám nhẹ `bg-stone-50`, phân dòng sắc nét `divide-stone-200`, hỗ trợ `tabular-nums` chống xô lệch.

## 5. Quy tắc chốt (Design System Locks)

1. **Tính đồng bộ tuyệt đối:** Không tạo theme biệt lập tách rời giữa Admin và hệ thống chính. Mọi portal đều dùng chung bảng màu Firebase & Fireside trên nền sáng canvas.
2. **Quy tắc tiếp cận:** Tất cả nút bấm và control tương tác phải đạt tối thiểu `44px x 44px` trên touch layout.
3. **Quy chuẩn dữ liệu:** Mọi số liệu, mã code và ID bắt buộc dùng font monospace `JetBrains Mono` với `tabular-nums`.
