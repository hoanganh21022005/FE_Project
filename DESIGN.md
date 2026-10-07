---
name: SCMS Webzone Operations System
description: A high-contrast, battle-tested operating system for sports-center administration, unified across member, staff, and management portals using the Webzone palette.
colors:
  eerie-black: "#181818"
  dark-charcoal: "#323232"
  platinum: "#E4E4E4"
  maximum-red: "#D62323"
  ue-red: "#BA0000"
  dark-red: "#8E0000"
  surface-white: "#FFFFFF"
  border-neutral: "#E4E4E4"
  border-subtle: "#D4D4D4"
  success: "#047857"
  success-bg: "#ECFDF5"
  success-border: "#A7F3D0"
  warning: "#D97706"
  warning-bg: "#FFFBEB"
  warning-border: "#FDE68A"
  info: "#0284C7"
  info-bg: "#F0F9FF"
  info-border: "#BAE6FD"
  danger: "#8E0000"
  danger-bg: "#FEF2F2"
  danger-border: "#FECACA"
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
    backgroundColor: "{colors.ue-red}"
    textColor: "{colors.surface-white}"
    hoverBackgroundColor: "{colors.dark-red}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.eerie-black}"
    borderColor: "{colors.border-subtle}"
    hoverBackgroundColor: "{colors.platinum}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  button-destructive:
    backgroundColor: "{colors.dark-red}"
    textColor: "{colors.surface-white}"
    hoverBackgroundColor: "{colors.eerie-black}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    minHeight: "44px"
  surface:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.eerie-black}"
    borderColor: "{colors.border-neutral}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: SCMS Webzone Operations System

## 1. Overview

**Creative North Star: "Bàn Điều Hành Webzone Chuẩn Xác & Nhất Quán (Webzone Precision Console)"**

Hệ thống SCMS (toàn bộ các phân hệ Admin, Center Manager, Coach, Receptionist, Member và Public/Auth) sử dụng **chung một ngôn ngữ thiết kế đồng bộ** dựa trên bảng màu **Webzone 6 Primitive Colors**:
- **Không gian nền (Canvas & Divider):** Platinum (`#E4E4E4`) trung tính sắc nét.
- **Mặt phẳng làm việc (Surfaces):** Bề mặt trắng tinh khiết (`#FFFFFF`) kết hợp bề mặt tối Eerie Black (`#181818`) cho Sidebar và Navigation.
- **Mực văn bản (Ink):** Eerie Black (`#181818`) làm ink chính và Dark Charcoal (`#323232`) làm ink phụ, đảm bảo độ tương phản WCAG AA trên mọi bề mặt.
- **Hành động & Nhấn (Primary & Accent):** UE Red (`#BA0000`) cho hành động chính và trạng thái kích hoạt, Maximum Red (`#D62323`) cho focus ring/icon/selection, Dark Red (`#8E0000`) cho trạng thái hover/pressed và cảnh báo nghiêm trọng.

Tài liệu này là **nguồn sự thật duy nhất (Single Source of Truth)** chốt lại toàn bộ quy chuẩn màu sắc, token ngữ nghĩa và quy tắc tương tác cho toàn bộ hệ thống.

---

## 2. Bảng Màu Webzone Chuẩn Hóa

### 2.1. 6 Primitives Cốt Lõi

| Primitive | Hex | Vai trò trong hệ thống |
|---|:---:|---|
| **Eerie Black** | `#181818` | Ink chính, sidebar, header đậm, dark surface |
| **Dark Charcoal** | `#323232` | Ink phụ, hover dark surface, text thứ cấp |
| **Platinum** | `#E4E4E4` | Canvas chính, divider, đường kẻ phân cách, neutral surface |
| **Maximum Red** | `#D62323` | Accent, focus ring, icon/selection highlight |
| **UE Red** | `#BA0000` | Primary action (nút chính), active navigation, điểm nhấn trọng tâm |
| **Dark Red** | `#8E0000` | Hover/pressed của nút chính, destructive emphasis, viền cảnh báo đậm |

### 2.2. Ánh Xạ Ngữ Nghĩa Bắt Buộc (Semantic Token Mapping)

- **Primary Button:** Nền `#BA0000` (UE Red), hover/pressed `#8E0000` (Dark Red), text `#FFFFFF`.
- **Focus Ring / Accent:** `#D62323` (Maximum Red). Tuyệt đối không dùng `#D62323` làm body text trên nền Platinum vì độ tương phản chỉ đạt ~4.01:1 (dưới chuẩn WCAG AA 4.5:1).
- **Văn bản chính (Main text):** `#181818` trên nền trắng/Platinum (đạt chuẩn AAA/AA).
- **Văn bản phụ (Secondary text):** `#323232` trên nền trắng/Platinum (đạt chuẩn AA).
- **Bề mặt hỗ trợ (Neutral Surface):** Màu trắng `#FFFFFF` là neutral hỗ trợ cho thẻ card, modal, bảng dữ liệu.
- **Trạng thái ngữ nghĩa riêng biệt (Semantic States):**
  - **Success:** Emerald `#047857`, nền `bg-emerald-50`, viền `border-emerald-200`.
  - **Warning:** Amber `#D97706`, nền `bg-amber-50`, viền `border-amber-200`.
  - **Info:** Sky `#0284C7`, nền `bg-sky-50`, viền `border-sky-200`.
  - **Danger / Destructive:** Dark Red `#8E0000`, nền `bg-rose-50`, viền `border-rose-200`.
  - **Quy tắc trạng thái:** Màu đỏ thương hiệu không được dùng thay thế cho mọi trạng thái; mọi trạng thái phải luôn đi kèm icon và nhãn văn bản tường minh, không chỉ dựa vào màu sắc.

### 2.3. Quy Tắc Chống Lạm Dụng (Anti-Patterns Prohibited)

- **Tuyệt đối cấm:** Gradient màu, hiệu ứng glassmorphism/blur, đốm sáng orb, gam màu tím/xanh tím, vạch kẻ viền dày > 1px, negative letter spacing, lồng thẻ card đa cấp (nested card).

---

## 3. Typography & Data Hygiene

- **Display & Heading Font:** Roboto (với Segoe UI và system-ui fallback), hiển thị tiếng Việt hoàn hảo.
- **Body Font:** Roboto / Inter, kích thước cơ bản 14px (`0.875rem`), khoảng cách dòng 1.5.
- **Technical & Numeric Font:** JetBrains Mono bắt buộc cho toàn bộ ID hệ thống (số nguyên BE), mã nhân viên (`STF-...`), mã hội viên (`MB-...`), mã lớp học, ngày giờ nhật ký và các chỉ số đo lường với class `tabular-nums`.

---

## 4. Components & Interactions

- **Buttons:** Bo góc chuẩn `rounded-md` (4px - 6px). Chiều cao tối thiểu tiếp cận di động `min-h-[44px]`, padding `px-4 py-2.5`.
- **Navigation Items (Sidebar & Tabs):**
  - Active: Nền `#BA0000` text `#FFFFFF` font-bold trên dark sidebar; hoặc `border-b-2 border-[#BA0000] text-[#BA0000]` trên tab ngang.
  - Inactive: `text-stone-300 hover:text-white hover:bg-stone-800` trên dark sidebar.
  - Touch target: Tối thiểu 44px x 44px.
- **Inputs & Filters:** Nền trắng, viền rõ `border-stone-300`, focus ring chuẩn `focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20 focus:outline-none`.
- **Tables:** Header xám nhẹ `bg-stone-100/70 text-stone-800 font-bold`, phân dòng sắc nét `border-b border-[#E4E4E4]`, hỗ trợ `tabular-nums` chống xô lệch.

---

## 5. Quy Tắc Khóa Hệ Thống (Design System Locks)

1. **Tính nhất quán tuyệt đối:** Không tồn tại bảng màu cam/Fireside cũ làm brand accent; toàn bộ 5 role portals và trang công khai đều tuân theo Webzone Palette.
2. **Quy chuẩn tiếp cận:** Tất cả nút bấm, liên kết và control tương tác phải đạt tối thiểu `44px x 44px` trên touch layout.
3. **Quy chuẩn định danh:** Không tạo chuỗi ID giả `mem-*` / `stf-*` trong API mode. Mọi ID hiển thị phải là số nguyên authoritative từ BE.
