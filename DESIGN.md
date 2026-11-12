---
name: SCMS Webzone Operations System
description: SCMS dùng Palette A (Navy + sport blue + sea teal). Giá trị mục tiêu nằm trong tài liệu này; src/index.css chạy palette cũ cho đến khi có task chuyển token.
colors:
  brand-dark: "#202B46"
  brand-dark-hover: "#303B58"
  brand-primary: "#2864A8"
  brand-primary-hover: "#22558F"
  brand-primary-active: "#1F4E83"
  brand-blue-soft: "#EAF0F6"
  brand-accent: "#117C87"
  brand-accent-dark: "#0E636C"
  brand-accent-soft: "#CFE5E7"
  brand-cyan: "#117C87"
  brand-purple: "#7860C4"
  brand-purple-dark: "#59429E"
  brand-lavender-soft: "#DDD5F2"
  brand-teal: "#168F83"
  brand-teal-dark: "#087368"
  brand-mint-soft: "#E0F3EE"
  brand-amber: "#E8B351"
  brand-lime: "#A5CD55"
  brand-sky-soft: "#98D9E8"
  bg-main: "#F5F7FA"
  bg-secondary: "#EEF3F6"
  text-secondary: "#52617C"
  text-muted: "#626E84"
  surface-white: "#FFFFFF"
  border-neutral: "#D7E0E8"
  border-subtle: "#D7E0E8"
  border-strong: "#7C8CA1"
  success: "#15803D"
  success-bg: "#ECFDF5"
  success-border: "#A7F3D0"
  warning: "#B45309"
  warning-bg: "#FFFBEB"
  warning-border: "#FDE68A"
  info: "#2563EB"
  info-bg: "#F0F9FF"
  info-border: "#BAE6FD"
  danger: "#9B2C1F"
  danger-hover: "#7F2419"
  danger-bg: "#F7EEED"
  danger-border: "#E1C0BC"
typography:
  headline:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
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
    lineHeight: 1.43
    letterSpacing: "0"
  label:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
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
    rounded: "{rounded.md}"
    padding: "8px 16px"
    minHeight: "44px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.brand-dark}"
    borderColor: "{colors.border-subtle}"
    hoverBackgroundColor: "{colors.bg-secondary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    minHeight: "44px"
  button-destructive:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface-white}"
    hoverBackgroundColor: "{colors.danger-hover}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    minHeight: "44px"
  surface:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.brand-dark}"
    borderColor: "{colors.border-neutral}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: SCMS Webzone Operations System

## 1. Trạng thái và phạm vi áp dụng

- **Quyết định:** Owner chọn Palette A (Navy + sport blue + sea teal) ngày 08/11/2026 và yêu cầu ghi vào tài liệu này ngày 11/11/2026 để làm khung quy chuẩn cho các đợt sửa UI/UX tiếp theo. Ngày 11/11/2026 Owner chọn thêm đỏ gạch `#9B2C1F` cho danger, thay umber `#744522` của đề xuất, sau khi xem thử (mục 7). Tài liệu này là **chuẩn thiết kế mục tiêu**.
- **Runtime đã áp dụng:** Các token của Palette A đã được chuyển vào `:root` và `@theme` trong `src/index.css` (task W2, 11/11/2026), bao gồm primary `#2864A8`, accent `#117C87`, danger đỏ gạch `#9B2C1F`, text-muted `#626E84` và viền `border-strong` `#7C8CA1`. Toàn bộ giao diện hiện tại sử dụng hệ token này.
- **Review:** theo đề xuất ngày 08/11, bộ quy chuẩn cần hai thành viên review. Chưa có xác nhận đủ hai lượt review; Owner chốt trước. Nếu review sau đó đổi giá trị, cập nhật tài liệu này trước rồi mới đổi code.
- **Nguồn giá trị:** cột "Nguồn" ở mục 2 phân biệt giá trị Owner đã chọn trong đề xuất (`Đề xuất A`) với giá trị bổ sung chưa nằm trong đề xuất (`Dẫn xuất`: suy ra từ màu đã chọn, tương phản đã tính lại bằng WCAG 2.1; chưa qua review) và giá trị `Giữ nguyên` so với runtime.
- **Khi viết code mới:** dùng tên token (`bg-brand-primary`, `text-text-secondary`, `border-border-color`, `text-status-danger`), không ghi hex. Nhờ vậy giao diện tự theo Palette A khi token được chuyển.

## 2. Bảng màu Palette A

Giá trị runtime nằm ở `src/index.css`, phần `:root`; Tailwind ánh xạ qua `@theme` trong cùng file. Không tạo bộ màu riêng cho từng role.

| Vai trò | CSS token | Palette A | Runtime hiện tại | Nguồn |
|---|---|---|---|---|
| Primary | `--brand-primary` | `#2864A8` | `#405BD5` | Đề xuất A |
| Primary hover | `--brand-primary-hover` | `#22558F` | `#3349B5` | Đề xuất A |
| Primary pressed | `--brand-primary-active` | `#1F4E83` | `#283A98` | Dẫn xuất |
| Primary nhẹ | `--brand-blue-soft` | `#EAF0F6` | `#E8EDFC` | Dẫn xuất |
| Sidebar / nền tối / ink | `--brand-dark`, `--bg-sidebar` | `#202B46` | `#202B46` | Đề xuất A |
| Hover nền tối | `--brand-dark-hover` | `#303B58` | `#303B58` | Giữ nguyên |
| Accent (teal) | `--brand-accent`, `--brand-cyan` | `#117C87` | `#24A9D2` | Đề xuất A |
| Accent đậm | `--brand-accent-dark` | `#0E636C` | `#08799E` | Dẫn xuất |
| Accent nhẹ | `--brand-accent-soft` | `#CFE5E7` | `#98D9E8` | Dẫn xuất |
| Nền trang | `--bg-main`, `--bg-page` | `#F5F7FA` | `#F5F7FC` | Đề xuất A |
| Card / modal | `--bg-card` | `#FFFFFF` | `#FFFFFF` | Giữ nguyên |
| Nền phụ | `--bg-secondary` | `#EEF3F6` | `#EEF2FA` | Đề xuất A |
| Viền (đường kẻ, card, bảng) | `--border-color` | `#D7E0E8` | `#DEE4F0` | Đề xuất A |
| Viền đậm (ô nhập, control) | `--border-strong` | `#7C8CA1` | chưa có | Dẫn xuất (đạt 3:1) |
| Chữ chính | `--text-primary` | `#202B46` | `#202B46` | Đề xuất A |
| Chữ phụ | `--text-secondary` | `#52617C` | `#52617C` | Đề xuất A |
| Chữ muted | `--text-muted` | `#626E84` | `#6B7890` | Dẫn xuất (đạt 4.5:1 trên cả ba nền) |
| Chữ trên nền tối | `--text-inverse` | `#FFFFFF` | `#FFFFFF` | Giữ nguyên |

Ghi chú:
- `--brand-cyan` là alias của accent. Tên giữ nguyên để không phải sửa code cũ; giá trị nay là teal `#117C87`, không còn là cyan. Code mới dùng `brand-accent`.
- `--brand-cyan-shadow` (`rgb(36 169 210 / 35%)`) gắn với cyan cũ; khi chuyển token đổi theo accent mới `rgb(17 124 135 / 35%)`.
- Palette A không có màu tím. Các token `brand-purple`, `brand-purple-dark`, `brand-lavender-soft`, cùng `brand-teal`, `brand-teal-dark`, `brand-mint-soft`, `brand-amber`, `brand-lime`, `brand-sky-soft` còn trong runtime và được giữ nguyên giá trị để không phá component hiện có. Code mới không dùng tím làm màu thương hiệu hay trạng thái; việc gỡ hoặc đổi các token này cần quyết định riêng (mục 7).

### Tương phản (tính lại ngày 11/11/2026, WCAG 2.1, trên `#FFFFFF` trừ khi ghi khác)

| Cặp | Tỉ lệ | Dùng cho |
|---|---:|---|
| Primary `#2864A8` | 6.04:1 | Chữ thường, nút primary (chữ trắng trên nền primary cũng 6.04:1) |
| Primary hover `#22558F` | 7.60:1 | Hover |
| Primary pressed `#1F4E83` (chữ trắng) | 8.48:1 | Trạng thái nhấn |
| Primary trên blue-soft `#EAF0F6` | 5.26:1 | Chip, nền nhẹ |
| Accent `#117C87` | 4.93:1 | Chữ thường (sát ngưỡng), icon; chữ trắng trên nền accent cũng 4.93:1 |
| Accent đậm `#0E636C` | 6.95:1 | Chữ nhỏ khi cần dư tương phản |
| Chữ phụ `#52617C` | 6.25:1 (trên `#F5F7FA`: 5.82:1; trên `#EEF3F6`: 5.59:1) | Chữ phụ, nhãn |
| Chữ chính `#202B46` trên `#F5F7FA` | 13.08:1 | Nội dung |
| Chữ trắng trên sidebar `#202B46` | 14.04:1 | Sidebar |
| Danger `#9B2C1F` | 7.57:1 (trên `#F7EEED`: 6.64:1; trên `#F5F7FA`: 7.05:1) | Chữ lỗi, viền lỗi, nút destructive (chữ trắng trên nền danger cũng 7.57:1) |
| Danger hover `#7F2419` (chữ trắng) | 9.68:1 | Hover nút destructive |
| Chữ muted `#626E84` | 5.14:1 (trên `#F5F7FA`: 4.79:1; trên `#EEF3F6`: 4.60:1) | Thông tin phụ, mã, ghi chú |
| Viền đậm `#7C8CA1` | 3.43:1 (trên `#F5F7FA`: 3.20:1; trên `#EEF3F6`: 3.07:1) | Viền ô nhập và control (WCAG 1.4.11, cần 3:1) |

Dùng token không chứng minh mọi cặp màu trên màn thật đạt AA; kiểm màu foreground và background thực tế trên các màn được sửa (4.5:1 cho chữ thường, 3:1 cho chữ lớn và thành phần giao diện).

## 3. Trạng thái ngữ nghĩa

| Trạng thái | Token Tailwind | Giá trị | Nền / viền |
|---|---|---|---|
| Thành công | `status-success` | `#15803D` | `#ECFDF5` / `#A7F3D0` |
| Cảnh báo | `status-warning` | `#B45309` | `#FFFBEB` / `#FDE68A` |
| Thông tin | `status-info` | `#2563EB` | `#F0F9FF` / `#BAE6FD` |
| Lỗi / nguy hiểm | `status-error`, `status-danger` | `#9B2C1F` (đỏ gạch) | `#F7EEED` / `#E1C0BC`; hover `#7F2419` |

- **Danger dùng đỏ gạch `#9B2C1F`** (Owner chọn ngày 11/11/2026; đề xuất Palette A gốc là umber `#744522` nhưng bản xem thử cho thấy umber trông gần như trung tính). Chỉ dùng token `status-danger`; không dùng `rose-*`, `red-*` hay hex đỏ khác, và không dùng đỏ thương hiệu cũ. Mô phỏng mù đỏ-lục cho thấy danger và cảnh báo hổ phách rút về cùng một tông, nên mọi trạng thái lỗi và nguy hiểm bắt buộc kèm nhãn chữ hoặc icon riêng (ví dụ biểu tượng lỗi, chữ "Lỗi"; cảnh báo dùng biểu tượng khác), không dùng màu làm dấu hiệu duy nhất.
- Success, warning và info **giữ nguyên giá trị runtime**; đề xuất Palette A không nêu giá trị mới cho ba màu này (chỉ ghi warning dùng amber đậm, tức giá trị hiện tại). Nền và viền của bốn trạng thái hiện lấy từ bảng màu Tailwind mặc định (emerald, amber, sky, rose-50/200). Alias `status-*-bg` và `status-*-border` cần được thêm vào `@theme` khi chuyển token, kèm `status-danger-hover`; riêng danger đổi từ rose sang giá trị trong bảng trên.
- Success, warning, info không dùng chung màu primary chỉ để giao diện đồng màu.
- Accent teal trên nền trắng đạt 4.93:1, đủ cho chữ thường nhưng sát ngưỡng. Với chữ nhỏ (12px) ưu tiên primary hoặc accent đậm.

## 4. Typography

Be Vietnam Pro cho cả `vi` và `en`, không đổi font theo ngôn ngữ (cấu hình trong `src/index.css`, `index.html` đã nạp các weight 300 đến 900). Cùng cỡ chữ và line-height cho hai ngôn ngữ; nội dung tự wrap khi bản dịch dài. Dùng rem cố định, không dùng cỡ chữ fluid trong dashboard.

| Vai trò | Cỡ / line-height | Weight | Tailwind |
|---|---:|---:|---|
| Tiêu đề trang | 20 / 28px | 700 | `text-xl leading-7 font-bold` |
| Tiêu đề section | 18 / 28px | 600 | `text-lg leading-7 font-semibold` |
| Tiêu đề card / dialog | 16 / 24px | 600 | `text-base leading-6 font-semibold` |
| Nội dung, ô dữ liệu bảng | 14 / 20px | 400 | `text-sm leading-5 font-normal` |
| Nội dung thoải mái | 16 / 24px | 400 | `text-base leading-6 font-normal` |
| Nhãn, chú thích, header bảng, badge | 12 / 16px | 500 đến 600 | `text-xs leading-4 font-medium` hoặc `font-semibold` |
| Chỉ số chính | 24 / 32px | 700 | `text-2xl leading-8 font-bold tabular-nums` |

- Weight trong màn vận hành: 400 cho nội dung, 500 cho dữ liệu phụ, 600 cho nhãn và nút, 700 cho tiêu đề. Giữ 800 đến 900 cho nội dung display ngoài màn vận hành.
- Không dùng 10px hay 11px cho dữ liệu cần đọc hoặc thao tác. Dùng `tabular-nums` cho tiền, ID, số lượng và ngày. Dùng `text-balance` cho tiêu đề nhiều dòng.
- Public marketing giữ thang tiêu đề riêng; màn vận hành ưu tiên khả năng quét và so sánh.
- Không tạo ID giả `mem-*` / `stf-*` trong API mode. Dùng ID authoritative từ BE.

## 5. Thành phần

### Nút

Vùng bấm tối thiểu 44×44px. Nút icon-only luôn `h-11 w-11` và có `aria-label`. Giữ nhãn hành động; không dùng màu làm dấu hiệu duy nhất.

```js
const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none";

const buttonPrimary =
  `${buttonBase} bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-active focus-visible:ring-brand-primary`;

const buttonSecondary =
  `${buttonBase} border border-border-color bg-white text-text-primary hover:bg-bg-secondary active:bg-bg-main focus-visible:ring-brand-primary`;

const buttonDanger =
  `${buttonBase} bg-status-danger text-white hover:bg-status-danger-hover active:brightness-90 focus-visible:ring-status-danger`;

const buttonIcon =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none";
```

- Nút dạng link: `inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-brand-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2`.
- Trong bảng, nút icon vẫn `h-11 w-11`; không thu nhỏ vùng bấm để giảm mật độ.
- Destructive dùng token danger, không dùng cho tạo, lưu hay import thông thường.
- `status-danger-hover` là alias mới, cần thêm vào `@theme` khi chuyển token.

### Bảng

Giữ semantic `<table>`. Wrapper `overflow-x-auto`; `min-width` theo số cột: mặc định 760px (Users, Roles), bảng nhiều cột 900px (Audit Logs). Chỉ đổi số khi có số đo render.

```js
const tableWrapper = "w-full overflow-x-auto rounded-lg border border-border-color bg-white";
const table = "w-full min-w-[760px] border-collapse text-left text-sm text-text-primary";
const tableHead = "border-b border-border-color bg-bg-secondary text-xs font-semibold text-text-secondary";
const tableHeaderCell = "px-4 py-3 text-left align-middle font-semibold";
const tableRow = "border-b border-border-color transition-colors last:border-0 hover:bg-bg-main";
const tableCell = "px-4 py-3 align-middle text-sm leading-5";
const tableNumericCell = "px-4 py-3 text-right align-middle text-sm leading-5 tabular-nums";
```

- Padding header và ô `12px 16px`; dòng cao thực tế tối thiểu khoảng 44px với line-height 20px.
- Ô dữ liệu chính 14px (`text-sm leading-5`); header, nhãn, badge và dòng phụ giữ 12px theo vai trò, không thay `text-xs` hàng loạt.
- `whitespace-nowrap` riêng cho ngày, mã và trạng thái ngắn; tên, email, mô tả dài được wrap.
- Hover dùng nền nhẹ, không đổi màu chữ. Nếu cả hàng bấm được thì cần focus bàn phím và affordance rõ; nếu chỉ có action ở cột cuối thì không biến cả hàng thành link.
- Phân trang, bộ lọc và action trong hàng dùng cùng `min-h-11`. Trên mobile giữ wrapper cuộn và cột thao tác nhìn thấy được.

### Ô nhập

```js
const input =
  "min-h-11 w-full rounded-md border border-border-strong bg-white px-3 text-sm leading-5 text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:opacity-60";

const fieldLabel = "mb-1.5 block text-xs font-semibold leading-4 text-text-primary";
const fieldError = "mt-1.5 text-xs leading-4 text-status-danger";
```

Ô nhập dùng `border-border-strong` (3:1) thay vì `border-border-color` (1.34:1), vì viền là dấu hiệu duy nhất cho biết vùng nhập. Mỗi control có label nhìn thấy được. Nối lỗi với input qua `aria-describedby`; kèm thông báo hoặc icon để lỗi nhận ra được khi không phân biệt màu. Checkbox và radio có vùng bấm 44px qua `label`.

### Badge và trạng thái

```js
const badgeBase = "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-4";
const badgeSuccess = `${badgeBase} border-status-success-border bg-status-success-bg text-status-success`;
const badgeWarning = `${badgeBase} border-status-warning-border bg-status-warning-bg text-status-warning`;
const badgeInfo = `${badgeBase} border-status-info-border bg-status-info-bg text-status-info`;
const badgeDanger = `${badgeBase} border-status-danger-border bg-status-danger-bg text-status-danger`;
```

Badge luôn kèm từ trạng thái hoặc icon. Loading, empty, error và forbidden giữ bố cục nhất quán giữa các màn; error có hành động retry ngay tại vùng dữ liệu lỗi.

### Card, section, toolbar

```js
const panel = "rounded-lg border border-border-color bg-white p-4 shadow-sm";
const pageSection = "space-y-4";
const toolbar = "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between";
const emptyState = "px-6 py-10 text-center text-sm leading-5 text-text-secondary";
const errorState = "rounded-md border border-status-danger-border bg-status-danger-bg p-4 text-sm leading-5 text-status-danger";
const loadingSkeleton = "animate-pulse rounded-md bg-bg-secondary motion-reduce:animate-none";
```

Dùng panel cho một nhóm nội dung có ranh giới; không lồng panel trong panel. Skeleton khi đã biết hình dạng dữ liệu; spinner nhỏ trong nút khi hành động đang xử lý.

### Điều hướng và tương tác khác

- **Sidebar:** `bg-bg-sidebar text-text-inverse`; mục đang chọn `bg-brand-primary text-white border-brand-accent`; mục thường dùng chữ sáng, hover `brand-dark-hover`. Cần kiểm render khi chuyển token vì primary mới tối hơn và gần navy hơn primary cũ.
- **Tab ngang:** chữ và viền primary; accent chỉ là điểm nhấn bổ trợ.
- **Focus:** vòng focus nhìn thấy được trên mọi control, dùng `brand-primary`. Hỗ trợ `prefers-reduced-motion`.
- Alias cũ (`webzone-red`, `wz-primary`, `mlc-red`, `brand-flame`, `sc-primary`...) đã ánh xạ về primary để tương thích; tên có chữ red không bảo đảm màu đỏ. Code mới dùng `brand-primary` và token trạng thái đúng nghĩa, không thêm alias cũ.

## 6. Quy tắc áp dụng và phối hợp

1. Không ghi trực tiếp màu thương hiệu cũ (đỏ `#BA0000`, `#D62323`, `#BA1A1A`; chàm `#405BD5` và các sắc dẫn xuất) cho nút, điều hướng hay trạng thái. Dùng token.
2. Không tạo palette riêng theo role, gradient hay hiệu ứng trang trí, và không redesign ngoài phạm vi task.
3. Thành viên khác phụ trách Manager và Member. Đồng bộ màu ở API, context, Header, Sidebar hay component dùng chung phải kiểm phạm vi để tránh xung đột; không sửa luồng Member trong task màu.
4. Đổi palette hay token không tự mở rộng thành đổi layout, flow, API, route hay quyền.
5. Cập nhật tài liệu này không chứng nhận mọi màn đã bỏ hardcode màu hay đạt accessibility; kiểm theo các màn thật được sửa, ở 1280×800 và 375×667.

## 7. Kết quả xem thử và điểm chưa chốt (11/11/2026)

Bản xem thử dựng ngoài repo (Chromium, route chặn mọi request ngoài, 1280×800 và 375×667, kèm mô phỏng mù màu đỏ-lục và thang xám). Đây là trang mẫu, không phải màn thật của SCMS; font hiển thị là font hệ thống, không phải Be Vietnam Pro.

**Đã chốt:**
1. **Danger:** Owner chọn đỏ gạch `#9B2C1F` (hover `#7F2419`, nền `#F7EEED`, viền `#E1C0BC`). Lý do: với umber `#744522` (đề xuất gốc), ô nhập lỗi, badge và khung lỗi trông gần như nâu xám trung tính, nút "Xóa" trông như nút thông thường. Đỏ gạch đọc ngay là lỗi: tương phản 7.57:1 với trắng và 6.64:1 trên nền `#F7EEED`. Khoảng cách màu cảm nhận tới cảnh báo hổ phách `#B45309` là ΔE 24.5 (umber là 33.9), vẫn phân biệt được ở thị giác bình thường. Khi mô phỏng mù đỏ-lục, danger và cảnh báo rút về cùng tông; vì vậy icon và nhãn chữ là bắt buộc.
2. **Chữ muted:** `#6B7890` chỉ đạt 4.45:1 trên trắng và 4.15:1 trên `#F5F7FA`. Đổi sang `#626E84` (5.14:1, 4.79:1 và 4.60:1 trên trắng, `#F5F7FA`, `#EEF3F6`).
3. **Viền ô nhập:** `#D7E0E8` chỉ đạt 1.34:1 trên trắng. Thêm token `--border-strong` `#7C8CA1` (3.43:1) cho ô nhập và control; viền nhạt giữ cho đường kẻ, card, bảng.
4. **Info `#2563EB` so với primary `#2864A8`:** tương phản độ sáng chỉ 1.17:1, nhưng khoảng cách màu cảm nhận ΔE = 41 và bản xem thử cho thấy hai màu khác rõ (xanh tươi so với xanh thép). Giữ nguyên info.

**Chưa chốt:**
5. **Các giá trị dẫn xuất** (`#1F4E83`, `#EAF0F6`, `#0E636C`, `#CFE5E7`, `#626E84`, `#7C8CA1`, và bộ danger `#7F2419`, `#F7EEED`, `#E1C0BC`) chưa nằm trong đề xuất ngày 08/11 và chưa qua review của thành viên khác.
6. **Token màu phụ** (tím, lavender, teal, mint, amber, lime, sky-soft): giữ hay gỡ, và `brand-sky-soft` có đổi theo accent mới (`#CFE5E7`) hay không.
7. **Đổi tên token** `brand-cyan` thành tên đúng nghĩa: để sau khi chuyển token, vì ảnh hưởng nhiều file.
8. **Sidebar mục đang chọn** (`brand-primary` trên nền navy, viền `brand-accent`): bản xem thử đọc được, nhưng cần kiểm trên Sidebar thật khi chuyển token.

## 8. Chuyển token vào runtime (Đã hoàn thành 11/11/2026)

Task W2 đã hoàn tất việc chuyển các token của Palette A vào `:root` và `@theme` trong `src/index.css` vào ngày 11/11/2026. Các token bao gồm primary `#2864A8`, hover `#22558F`, pressed `#1F4E83`, accent `#117C87`, danger `#9B2C1F` (hover `#7F2419`, nền `#F7EEED`, viền `#E1C0BC`), text-muted `#626E84` và border-strong `#7C8CA1` đã có mặt ở runtime và được ánh xạ qua Tailwind CSS. Giao diện cổng quản trị và các thành phần dùng chung đã đồng bộ theo hệ token này.
