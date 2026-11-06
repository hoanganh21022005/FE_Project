const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
})

function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date : null
}

function keyFromUtcDate(date) {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

// Date-only and unzoned API values are calendar dates; zoned timestamps are instants.
export function vietnamDateKey(value) {
  if (typeof value === 'string') {
    const input = value.trim()
    if (parseDateKey(input)) return input
    const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/i.exec(input)
    if (!match || !parseDateKey(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] || 0) > 59) return null
    if (!match[5]) return match[1]
    value = new Date(input.replace(' ', 'T'))
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null
  const parts = Object.fromEntries(vietnamDateFormatter.formatToParts(value).map(({ type, value: part }) => [type, part]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function addCalendarDays(key, amount) {
  const date = parseDateKey(key)
  if (!date) return null
  date.setUTCDate(date.getUTCDate() + amount)
  return keyFromUtcDate(date)
}

export function shiftCalendarMonth(monthKey, amount) {
  const date = parseDateKey(`${monthKey}-01`)
  if (!date) return null
  date.setUTCMonth(date.getUTCMonth() + amount)
  return keyFromUtcDate(date).slice(0, 7)
}

export function currentCalendarMonth(now = new Date()) {
  return vietnamDateKey(now)?.slice(0, 7) ?? null
}

export function matchesClassDateRange(value, range, today = vietnamDateKey(new Date())) {
  if (!range || range === 'all') return true
  const dateKey = vietnamDateKey(value)
  const todayDate = parseDateKey(today || '')
  if (!dateKey || !todayDate) return false
  const monday = addCalendarDays(today, -((todayDate.getUTCDay() + 6) % 7))
  const month = today.slice(0, 7)
  const ranges = {
    today: [today, addCalendarDays(today, 1)],
    this_week: [monday, addCalendarDays(monday, 7)],
    next_week: [addCalendarDays(monday, 7), addCalendarDays(monday, 14)],
    this_month: [`${month}-01`, `${shiftCalendarMonth(month, 1)}-01`],
    next_month: [`${shiftCalendarMonth(month, 1)}-01`, `${shiftCalendarMonth(month, 2)}-01`],
  }
  const bounds = ranges[range]
  return bounds ? dateKey >= bounds[0] && dateKey < bounds[1] : false
}

export function calendarMonthCells(monthKey) {
  const first = parseDateKey(`${monthKey}-01`)
  if (!first) return []
  const offset = (first.getUTCDay() + 6) % 7
  const next = parseDateKey(`${shiftCalendarMonth(monthKey, 1)}-01`)
  const days = Math.round((next - first) / 86400000)
  const count = Math.ceil((offset + days) / 7) * 7
  return Array.from({ length: count }, (_, index) => {
    const day = index - offset + 1
    return day > 0 && day <= days ? `${monthKey}-${String(day).padStart(2, '0')}` : null
  })
}

// Preserve the API's sessions and show the class opening date when no session shares it.
export function buildClassCalendarEntries(classes, sessions) {
  const entries = {}
  const classesById = new Map(classes.filter((cls) => cls?.id != null).map((cls) => [String(cls.id), cls]))
  const sessionDays = new Set()
  for (const session of sessions) {
    const cls = session?.classId == null ? null : classesById.get(String(session.classId))
    const date = vietnamDateKey(session?.sessionDate ?? session?.date)
    if (!cls || !date) continue
    const key = `${cls.id}|${date}`
    sessionDays.add(key)
    ;(entries[date] ||= []).push({ type: 'session', class: cls, session })
  }
  for (const cls of classes) {
    const date = vietnamDateKey(cls?.startDate || cls?.date)
    if (!date || cls?.id == null || sessionDays.has(`${cls.id}|${date}`)) continue
    ;(entries[date] ||= []).push({ type: 'class', class: cls })
  }
  return entries
}
