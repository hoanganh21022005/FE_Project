---
title: G2 Admin portal direction
date: 2026-10-03
status: decided
---

# G2 Admin Portal Direction

## Intent / Problem

G1 đã thiết lập auth, role, session và route guard. Admin hiện chỉ có placeholder trong app shell dùng chung, chưa có portal độc lập hoặc dữ liệu quản trị read-only từ backend.

## Desired Outcome

Admin đăng nhập qua lối vào rõ ràng, sử dụng layout/navigation riêng và đọc được users, roles, permissions, audit logs từ backend. Bốn màn Admin có loading, empty, error, retry và guard đúng; lỗi một endpoint không phá dữ liệu khác.

## Constraints

- Hoàn tất G2.1-G2.7 trong một lượt.
- Dùng auth/session/httpClient hiện có và ID số của backend.
- API mode không fallback mock; mock mode vẫn hoạt động cho UI/test.
- Menu/action dựa trên authorities thật khi backend cung cấp.
- WCAG 2.1 AA, responsive, reduced motion.
- Không ghi credential vào source, test hoặc report.

## Non-goals

- Không tạo/sửa/xóa user, role hoặc permission; mutation thuộc G3.
- Không gọi `/api/reports/dashboard`.
- Không sửa backend, deploy, commit hoặc push.
- Không đánh dấu checklist hoàn thành trước review.

## Domain Context

Product UI cho System Admin làm việc trong ca sáng tại môi trường văn phòng sáng, cần quét nhanh dữ liệu vận hành. Visual direction: "Bàn Điều Hành Tin Cậy", palette Pearl/Driftwood/Morning Blue, mật độ vừa phải và điều hướng Admin riêng.

## Decision

Tạo Admin shell riêng trong SPA hiện hữu, route qua navigation helpers và guard G1. Dữ liệu Admin được tải bằng adapter riêng; mỗi resource giữ state và retry độc lập. Dashboard tính count từ cùng resource state; các màn danh sách chỉ đọc dùng mapper theo OpenAPI thực.

## Reasoning

Cách này giữ contract G1, tách rõ ownership Admin/Manager, tránh dependency vào endpoint report đang lỗi và cho phép một phần portal tiếp tục hoạt động khi một GET thất bại.

## Acceptance Criteria

- `/admin/login`, `/admin/dashboard`, `/admin/users`, `/admin/roles`, `/admin/audit-logs` hoạt động với deep link và F5.
- Admin shell không hiển thị menu Center Manager; Manager bị chặn khi nhập URL Admin.
- Bốn GET endpoints đi qua `adminApi.js`; mapper giữ ID số và field DTO thật.
- Dashboard có count gắn nguồn; mỗi panel có loading/empty/error/retry độc lập.
- User search/filter, role-permission matrix read-only và audit DTO thật hoạt động.
- Logout từ Admin quay về `/admin/login`.
- Logic tests, browser flow, production/mock build và diff check đạt.

## Open Questions / Risks

- Authorities thực tế có thể khác tên permission dự kiến; navigation phải fail closed cho action chi tiết nhưng vẫn cho Admin thấy bốn màn G2 theo role route đã được G1 xác nhận.
- Live backend có thể không sẵn sàng hoặc session hết hạn; báo cáo phải tách lỗi môi trường khỏi lỗi implementation.
