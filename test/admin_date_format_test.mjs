import assert from "node:assert/strict"
import test from "node:test"
import {
  parseToVietnamDate,
  formatAdminDate,
  formatAdminDateTime,
  VIETNAM_TIMEZONE,
} from "../src/components/admin/adminDateUtils.js"

test("P03-FIX: Chống rollover ngày không tồn tại (30/02) trong mọi định dạng", () => {
  // 1. Ngày 30/02 trong ISO LocalDateTime không offset (Reviewer issue 1)
  assert.equal(formatAdminDate("2026-02-30T10:00:00"), "Không hợp lệ")
  assert.equal(formatAdminDateTime("2026-02-30T10:00:00"), "Không hợp lệ")

  // 2. Ngày 30/02 trong timestamp có offset +07:00
  assert.equal(formatAdminDate("2026-02-30T10:00:00+07:00"), "Không hợp lệ")
  assert.equal(formatAdminDateTime("2026-02-30T10:00:00+07:00"), "Không hợp lệ")

  // 3. Ngày 30/02 trong timestamp có Z
  assert.equal(formatAdminDate("2026-02-30T03:00:00Z"), "Không hợp lệ")
  assert.equal(formatAdminDateTime("2026-02-30T03:00:00Z"), "Không hợp lệ")

  // 4. Ngày 31 trong tháng có 30 ngày (ví dụ 31/04)
  assert.equal(formatAdminDate("2026-04-31"), "Không hợp lệ")
  assert.equal(formatAdminDateTime("2026-04-31T12:00:00"), "Không hợp lệ")
})

test("P03-FIX: Từ chối chuỗi ngoài contract (dùng dấu cách thay 'T')", () => {
  // Chuỗi dùng dấu cách thay vì T (Reviewer issue 2)
  assert.equal(formatAdminDate("2026-10-29 00:30:00"), "Không hợp lệ")
  assert.equal(formatAdminDateTime("2026-10-29 00:30:00"), "Không hợp lệ")

  // Các định dạng ngoài contract khác
  assert.equal(formatAdminDate("29/10/2026"), "Không hợp lệ")
  assert.equal(formatAdminDate("2026/10/29"), "Không hợp lệ")
  assert.equal(formatAdminDateTime("29-10-2026 00:30:00"), "Không hợp lệ")
})

test("P03-FIX: Xác thực năm nhuận chính xác tuyệt đối", () => {
  // Năm nhuận hợp lệ (2024 chia hết 4, 2000 chia hết 400)
  const leap2024 = formatAdminDate("2024-02-29")
  assert.match(leap2024, /29.*thg.*2.*2024/)

  const leap2000 = formatAdminDate("2000-02-29")
  assert.match(leap2000, /29.*thg.*2.*2000/)

  const leapTime2024 = formatAdminDateTime("2024-02-29T15:20:00")
  assert.match(leapTime2024, /15:20:00/)
  assert.match(leapTime2024, /29\/2\/24|29\/02\/2024/)

  // Năm không nhuận (2026, 2025, 1900 chia hết 100 nhưng không chia hết 400)
  assert.equal(formatAdminDate("2026-02-29"), "Không hợp lệ")
  assert.equal(formatAdminDate("2025-02-29"), "Không hợp lệ")
  assert.equal(formatAdminDate("1900-02-29"), "Không hợp lệ")
  assert.equal(formatAdminDateTime("2026-02-29T10:00:00"), "Không hợp lệ")
})

test("P03-FIX: Xác thực thành phần thời gian (giờ 0-23, phút 0-59, giây 0-59)", () => {
  assert.equal(formatAdminDateTime("2026-10-29T24:00:00"), "Không hợp lệ")
  assert.equal(formatAdminDateTime("2026-10-29T25:00:00"), "Không hợp lệ")
  assert.equal(formatAdminDateTime("2026-10-29T10:60:00"), "Không hợp lệ")
  assert.equal(formatAdminDateTime("2026-10-29T10:00:60"), "Không hợp lệ")
})

test("adminDateUtils - Null, rỗng và khoảng trắng trả về fallback rõ ràng", () => {
  assert.equal(formatAdminDate(null), "Chưa có")
  assert.equal(formatAdminDate(undefined), "Chưa có")
  assert.equal(formatAdminDate(""), "Chưa có")
  assert.equal(formatAdminDate("   "), "Chưa có")

  assert.equal(formatAdminDateTime(null), "Chưa có")
  assert.equal(formatAdminDateTime(undefined), "Chưa có")
  assert.equal(formatAdminDateTime(""), "Chưa có")
  assert.equal(formatAdminDateTime("   "), "Chưa có")

  // Fallback tùy biến
  assert.equal(formatAdminDate(null, "N/A"), "N/A")
  assert.equal(formatAdminDateTime(null, "Không có dữ liệu"), "Không có dữ liệu")
})

test("adminDateUtils - Giá trị không hợp lệ trả về fallback, không crash", () => {
  assert.equal(formatAdminDate("invalid-date"), "Không hợp lệ")
  assert.equal(formatAdminDate("2026-99-99"), "Không hợp lệ")
  assert.equal(formatAdminDate("abcd-ef-gh"), "Không hợp lệ")

  assert.equal(formatAdminDateTime("invalid-date"), "Không hợp lệ")
  assert.equal(formatAdminDateTime("2026-13-45T99:99:99"), "Không hợp lệ")

  // Fallback tùy biến
  assert.equal(formatAdminDate("invalid", "Chưa có", "Lỗi ngày"), "Lỗi ngày")
})

test("adminDateUtils - Date-only (YYYY-MM-DD) không bị nhảy sang ngày trước/sau", () => {
  // Đầu năm
  const d1 = formatAdminDate("2000-01-01")
  assert.match(d1, /1.*thg.*1.*2000/)

  // Cuối năm
  const d2 = formatAdminDate("1995-12-31")
  assert.match(d2, /31.*thg.*12.*1995/)
})

test("adminDateUtils - LocalDateTime không offset được hiểu đúng theo múi giờ Việt Nam (UTC+7)", () => {
  // Nửa đêm (00:30 sáng tại Việt Nam)
  const midnight = formatAdminDateTime("2026-10-29T00:30:00")
  assert.match(midnight, /00:30:00/)
  assert.match(midnight, /29\/10\/26|29\/10\/2026/)

  // Trước nửa đêm (23:45 đêm ngày 28/10)
  const beforeMidnight = formatAdminDateTime("2026-10-28T23:45:00")
  assert.match(beforeMidnight, /23:45:00/)
  assert.match(beforeMidnight, /28\/10\/26|28\/10\/2026/)

  // DTO có microsecond thực tế từ Audit Log Backend (.616951 -> giữ 616ms)
  const auditDto = formatAdminDateTime("2026-10-29T11:14:52.616951")
  assert.match(auditDto, /11:14:52/)
  assert.match(auditDto, /29\/10\/26|29\/10\/2026/)
})

test("adminDateUtils - Timestamp có Z hoặc offset giữ đúng mốc thời gian tuyệt đối", () => {
  // 03:30:00 UTC chính là 10:30:00 tại Việt Nam (UTC+7)
  const utcZ = formatAdminDateTime("2026-10-29T03:30:00Z")
  assert.match(utcZ, /10:30:00/)
  assert.match(utcZ, /29\/10\/26|29\/10\/2026/)

  // 10:30:00+07:00 cũng chính là 10:30:00 tại Việt Nam
  const offset7 = formatAdminDateTime("2026-10-29T10:30:00+07:00")
  assert.match(offset7, /10:30:00/)
  assert.match(offset7, /29\/10\/26|29\/10\/2026/)

  // Hai biểu diễn tương đương phải cho cùng kết quả
  assert.equal(utcZ, offset7)
})

test("adminDateUtils - Hằng số múi giờ là Asia/Ho_Chi_Minh", () => {
  assert.equal(VIETNAM_TIMEZONE, "Asia/Ho_Chi_Minh")
})
