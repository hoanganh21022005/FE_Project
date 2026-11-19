// Một nơi duy nhất đổi cách gọi thứ trong tuần. Chủ nhật là điểm dễ sai:
//   - JS (Date#getDay, trạng thái chọn thứ của giao diện): 0 = Chủ nhật, 1..6 = Thứ hai..Thứ bảy
//   - API lịch Normal (daysOfWeek): 1..7, Chủ nhật = 7
//   - Lịch làm việc của Coach: khóa chữ "MONDAY".."SUNDAY"
const WEEKDAY_KEYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

const toJsDay = (value) => {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.trim()))) {
    const number = Number(value)
    if (number === 7) return 0
    return Number.isInteger(number) && number >= 0 && number <= 6 ? number : null
  }
  if (typeof value === 'string') {
    const key = value.trim().toUpperCase()
    const index = WEEKDAY_KEYS.findIndex((name) => name === key || name.slice(0, 3) === key)
    return index >= 0 ? index : null
  }
  return null
}

/**
 * Đổi một thứ giữa ba cách gọi. `value` có thể là số JS (0..6), số API (1..7), chuỗi số hoặc khóa chữ
 * ("SUNDAY" hay "SUN"); `to` là 'js' (0..6), 'api' (1..7) hoặc 'key' ("SUNDAY".."SATURDAY").
 * Trả null khi `value` không phải một thứ hợp lệ.
 */
export function convertWeekday(value, to) {
  const jsDay = toJsDay(value)
  if (jsDay === null) return null
  if (to === 'js') return jsDay
  if (to === 'api') return jsDay === 0 ? 7 : jsDay
  if (to === 'key') return WEEKDAY_KEYS[jsDay]
  throw new Error(`Không hỗ trợ đổi thứ sang "${to}".`)
}
