/**
 * Tiện ích chuẩn hóa và hiển thị thời gian cho Admin Portal.
 *
 * Nguyên tắc thiết kế:
 * 1. Xác thực ngày lịch (calendar date) và thành phần giờ trước khi tạo Date để ngăn JavaScript tự động rollover (ví dụ 30/02).
 * 2. Chỉ chấp nhận các định dạng chuỗi đã xác định trong contract:
 *    - Date-only: YYYY-MM-DD (được định dạng cố định theo múi giờ Việt Nam Asia/Ho_Chi_Minh).
 *    - ISO LocalDateTime dùng 'T', không offset: được hiểu theo múi giờ Việt Nam (UTC+7).
 *    - ISO Timestamp có 'Z' hoặc offset: giữ nguyên mốc thời gian tuyệt đối và hiển thị theo giờ Việt Nam.
 * 3. Chuỗi ngoài contract (như định dạng dùng dấu cách YYYY-MM-DD HH:mm:ss) trả về 'Không hợp lệ', không dùng parser phụ thuộc máy.
 * 4. Microsecond của DTO Backend được giữ trong phạm vi độ chính xác Date hỗ trợ (lấy millisecond).
 * 5. Null/undefined/rỗng trả về fallback 'Chưa có', không crash, không hiển thị 'Invalid Date'.
 */

export const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh"
const VIETNAM_LOCALE = "vi-VN"

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
}

function daysInMonth(year, month) {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31
    case 4:
    case 6:
    case 9:
    case 11:
      return 30
    case 2:
      return isLeapYear(year) ? 29 : 28
    default:
      return 0
  }
}

function isValidCalendarDate(year, month, day) {
  if (year < 1000 || year > 9999) return false
  if (month < 1 || month > 12) return false
  const maxDay = daysInMonth(year, month)
  return day >= 1 && day <= maxDay
}

function isValidTime(hour, minute, second) {
  if (hour < 0 || hour > 23) return false
  if (minute < 0 || minute > 59) return false
  if (second < 0 || second > 59) return false
  return true
}

/**
 * Phân tích giá trị thời gian thành đối tượng Date đã căn chuẩn theo múi giờ Việt Nam.
 * @param {string|number|Date|null|undefined} value
 * @returns {{ valid: boolean, empty: boolean, date: Date | null, isDateOnly: boolean }}
 */
export function parseToVietnamDate(value) {
  if (value === null || value === undefined) {
    return { valid: false, empty: true, date: null, isDateOnly: false }
  }

  if (value instanceof Date) {
    const isValid = !Number.isNaN(value.getTime())
    return { valid: isValid, empty: false, date: isValid ? value : null, isDateOnly: false }
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { valid: false, empty: false, date: null, isDateOnly: false }
    }
    const date = new Date(value)
    const isValid = !Number.isNaN(date.getTime())
    return { valid: isValid, empty: false, date: isValid ? date : null, isDateOnly: false }
  }

  const str = String(value).trim()
  if (!str) {
    return { valid: false, empty: true, date: null, isDateOnly: false }
  }

  // 1. Date-only: YYYY-MM-DD
  // Tính ổn định đến từ việc xác thực lịch nghiêm ngặt và format cố định theo múi giờ Việt Nam
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (dateOnlyMatch) {
    const y = Number(dateOnlyMatch[1])
    const m = Number(dateOnlyMatch[2])
    const d = Number(dateOnlyMatch[3])
    if (!isValidCalendarDate(y, m, d)) {
      return { valid: false, empty: false, date: null, isDateOnly: true }
    }
    // Gán mốc 00:00:00 tại Asia/Ho_Chi_Minh (UTC+7 -> tương đương 17:00 UTC ngày hôm trước)
    const date = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 7 * 3600 * 1000)
    return { valid: true, empty: false, date, isDateOnly: true }
  }

  // 2. ISO LocalDateTime: YYYY-MM-DDTHH:mm(:ss(.SSS)?)? KHÔNG CÓ offset/Z
  const localMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(str)
  if (localMatch) {
    const y = Number(localMatch[1])
    const m = Number(localMatch[2])
    const d = Number(localMatch[3])
    const h = Number(localMatch[4])
    const min = Number(localMatch[5])
    const s = localMatch[6] ? Number(localMatch[6]) : 0
    const fraction = localMatch[7] || ""

    if (!isValidCalendarDate(y, m, d) || !isValidTime(h, min, s)) {
      return { valid: false, empty: false, date: null, isDateOnly: false }
    }

    // Giữ microsecond của DTO trong phạm vi độ chính xác Date hỗ trợ (millisecond 3 chữ số)
    const ms = fraction ? Number(fraction.slice(0, 3).padEnd(3, "0")) : 0
    // Chuỗi nghiệp vụ không offset được hiểu theo giờ Việt Nam (UTC+7)
    const date = new Date(Date.UTC(y, m - 1, d, h, min, s, ms) - 7 * 3600 * 1000)
    return { valid: true, empty: false, date, isDateOnly: false }
  }

  // 3. ISO Timestamp có 'Z' hoặc offset: [+-]HH:mm, [+-]HHmm, [+-]HH
  const offsetMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}(?::?\d{2})?)$/.exec(str)
  if (offsetMatch) {
    const y = Number(offsetMatch[1])
    const m = Number(offsetMatch[2])
    const d = Number(offsetMatch[3])
    const h = Number(offsetMatch[4])
    const min = Number(offsetMatch[5])
    const s = offsetMatch[6] ? Number(offsetMatch[6]) : 0
    const fraction = offsetMatch[7] || ""
    const tzStr = offsetMatch[8]

    if (!isValidCalendarDate(y, m, d) || !isValidTime(h, min, s)) {
      return { valid: false, empty: false, date: null, isDateOnly: false }
    }

    let offsetMinutes = 0
    if (tzStr !== "Z") {
      const sign = tzStr[0] === "+" ? 1 : -1
      const cleanTz = tzStr.slice(1).replace(":", "")
      const offH = Number(cleanTz.slice(0, 2))
      const offM = cleanTz.length >= 4 ? Number(cleanTz.slice(2, 4)) : 0
      if (offH > 23 || offM > 59) {
        return { valid: false, empty: false, date: null, isDateOnly: false }
      }
      offsetMinutes = sign * (offH * 60 + offM)
    }

    const ms = fraction ? Number(fraction.slice(0, 3).padEnd(3, "0")) : 0
    const date = new Date(Date.UTC(y, m - 1, d, h, min, s, ms) - offsetMinutes * 60 * 1000)
    return { valid: true, empty: false, date, isDateOnly: false }
  }

  // 4. Chuỗi ngoài contract (kể cả dùng dấu cách thay 'T' hay định dạng lạ) -> từ chối, không dùng parser phụ thuộc máy
  return { valid: false, empty: false, date: null, isDateOnly: false }
}

/**
 * Định dạng ngày (Date-only hoặc CreatedAt ngày) theo phong cách chuẩn tiếng Việt.
 * Ví dụ: "29 thg 10, 2026"
 * @param {string|number|Date|null|undefined} value
 * @param {string} emptyFallback Mặc định là 'Chưa có'
 * @param {string} invalidFallback Mặc định là 'Không hợp lệ'
 * @returns {string}
 */
export function formatAdminDate(value, emptyFallback = "Chưa có", invalidFallback = "Không hợp lệ") {
  const parsed = parseToVietnamDate(value)
  if (parsed.empty) return emptyFallback
  if (!parsed.valid) return invalidFallback

  return new Intl.DateTimeFormat(VIETNAM_LOCALE, {
    dateStyle: "medium",
    timeZone: VIETNAM_TIMEZONE,
  }).format(parsed.date)
}

/**
 * Định dạng ngày giờ chi tiết (phục vụ Audit logs hoặc chi tiết giao dịch).
 * Ví dụ: "00:30:00 29/10/26"
 * @param {string|number|Date|null|undefined} value
 * @param {string} emptyFallback Mặc định là 'Chưa có'
 * @param {string} invalidFallback Mặc định là 'Không hợp lệ'
 * @returns {string}
 */
export function formatAdminDateTime(value, emptyFallback = "Chưa có", invalidFallback = "Không hợp lệ") {
  const parsed = parseToVietnamDate(value)
  if (parsed.empty) return emptyFallback
  if (!parsed.valid) return invalidFallback

  return new Intl.DateTimeFormat(VIETNAM_LOCALE, {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: VIETNAM_TIMEZONE,
  }).format(parsed.date)
}
