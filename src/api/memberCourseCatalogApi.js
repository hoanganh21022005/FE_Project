import { httpClient } from './httpClient.js'
import { asNumber, inferNormalClassWeekdaysFromSessions, optionalBoolean, toFrontendDaysOfWeek } from './mappers.js'
import { extractList, isValidNumericId } from './schemaValidators.js'

const readArray = (response, resourceName) => {
  const rows = extractList(response)
  if (!Array.isArray(rows)) throw new Error(`Danh sách ${resourceName} trả về không đúng định dạng.`)
  if (rows.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error(`Bản ghi ${resourceName} trả về không hợp lệ.`)
  }
  return rows
}

export async function getMemberCourseClasses() {
  const response = await httpClient.get('/api/classes')
  return readArray(response, 'lớp học').map((item) => ({
    id: asNumber(item.id),
    name: item.name ?? null,
    subjectId: asNumber(item.subjectId),
    subjectName: item.subjectName ?? null,
    coachId: asNumber(item.coachId),
    coachName: item.coachName ?? null,
    classType: item.classType ?? null,
    status: item.status ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    totalSessions: asNumber(item.totalSessions),
    maxCapacity: asNumber(item.maxCapacity),
    enrolledCount: asNumber(item.enrolledCount),
    tuitionFee: asNumber(item.tuitionFee),
    scheduleText: item.scheduleText ?? item.schedule ?? null,
    selectedDays: (() => {
      const mappedDays = toFrontendDaysOfWeek(item.daysOfWeek ?? item.selectedDays)
      if (Array.isArray(mappedDays) && mappedDays.length > 0) return mappedDays
      if (String(item.classType || '').trim().toLowerCase() !== 'normal') return null
      return inferNormalClassWeekdaysFromSessions(
        item.sessions ?? item.scheduleSessions ?? item.schedules,
        item.totalSessions ?? 12,
      )
    })(),
    sessions: item.sessions ?? item.scheduleSessions ?? item.schedules ?? null,
    // Field theo contract hạn và quyền thao tác: thiếu thì giữ null (khác với false). Tài khoản không phải Member cũng là null.
    registrationAllowed: optionalBoolean(item.registrationAllowed),
    registrationBlockReason: typeof item.registrationBlockReason === 'string' && item.registrationBlockReason.trim() ? item.registrationBlockReason.trim() : null,
    registrationDeadline: item.registrationDeadline ?? null,
    serverTime: item.serverTime ?? null,
  }))
}

const REGISTRATION_FIELDS_EMPTY = Object.freeze({
  registrationAllowed: null,
  registrationBlockReason: null,
  registrationDeadline: null,
  serverTime: null,
})

/**
 * Chi tiết đăng ký của MỘT lớp cho Member đang đăng nhập: GET /api/classes/{id}.
 * Danh sách /api/classes luôn trả các field này là null; chỉ chi tiết mới đánh giá theo Member
 * (ALREADY_ENROLLED, SCHEDULE_CONFLICT, BOOKING_BLOCKED, WAITLIST_FULL, NORMAL_REGISTRATION_CLOSED...).
 * Không bao giờ ném lỗi: lỗi mạng, 4xx hoặc 5xx thì trả 4 field = null và `loaded: false`
 * (giữ hành vi cũ, không khóa, không báo lỗi chặn); thiếu field cũng là null, không đổi thành false.
 */
export async function getMemberCourseClassRegistration(classId) {
  if (!isValidNumericId(classId)) return { ...REGISTRATION_FIELDS_EMPTY, loaded: false }
  try {
    const item = await httpClient.get(`/api/classes/${Number(classId)}`, { notifyForbidden: false, notifyUnauthorized: false })
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ...REGISTRATION_FIELDS_EMPTY, loaded: false }
    return {
      registrationAllowed: optionalBoolean(item.registrationAllowed),
      registrationBlockReason: typeof item.registrationBlockReason === 'string' && item.registrationBlockReason.trim() ? item.registrationBlockReason.trim() : null,
      registrationDeadline: item.registrationDeadline ?? null,
      serverTime: item.serverTime ?? null,
      loaded: true,
    }
  } catch {
    return { ...REGISTRATION_FIELDS_EMPTY, loaded: false }
  }
}

export const memberCourseCatalogApi = { getMemberCourseClasses, getMemberCourseClassRegistration }
