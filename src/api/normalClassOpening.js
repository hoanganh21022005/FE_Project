import { getErrorMessage } from './apiErrors.js'

const DAY_MS = 24 * 60 * 60 * 1000
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000

const normalize = (value) => String(value ?? '').trim().toLowerCase()
const validPositiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0

export const validNormalClassOpeningRequest = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Opening confirmation payload must be an object.')
  }
  const extraFields = Object.keys(payload).filter((key) => key !== 'reason')
  if (extraFields.length) {
    throw new TypeError(`Unsupported opening confirmation field: ${extraFields[0]}`)
  }
  if (payload.reason === undefined || payload.reason === null || String(payload.reason).trim() === '') {
    return {}
  }
  if (typeof payload.reason !== 'string') {
    throw new TypeError('Opening confirmation reason must be a string.')
  }
  return { reason: payload.reason.trim() }
}

// OpenAPI defines SessionResponse times as Asia/Ho_Chi_Minh local wall-clock values.
export const parseVietnamSessionStart = (session) => {
  const date = String(session?.sessionDate ?? '')
  const time = String(session?.startTime ?? '')
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const timeMatch = time.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/)
  if (!match || !timeMatch) return null

  const [, yearText, monthText, dayText] = match
  const [, hourText, minuteText, secondText = '0', fractionText = '0'] = timeMatch
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const millisecond = Number(`0.${fractionText}`) * 1000
  const dateUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond)
  const parsed = new Date(dateUtc)
  if (
    parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59
  ) return null

  return dateUtc - VIETNAM_OFFSET_MS
}

export const getFirstNormalClassSession = (sessions) => {
  if (!Array.isArray(sessions)) return null
  return sessions
    .filter((session) => session && session.centerInvalidated !== true && !['cancelled', 'canceled'].includes(normalize(session.status)))
    .map((session) => ({ session, startsAt: parseVietnamSessionStart(session) }))
    .filter((entry) => entry.startsAt !== null)
    .sort((a, b) => a.startsAt - b.startsAt)[0] ?? null
}

export const getOpeningReasonRequirement = ({ firstSession, now = new Date() } = {}) => {
  const startsAt = parseVietnamSessionStart(firstSession)
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  if (startsAt === null || !Number.isFinite(nowMs)) {
    return { known: false, reasonRequired: null, startsAt: null, hoursUntilStart: null }
  }

  const millisecondsUntilStart = startsAt - nowMs
  return {
    known: true,
    reasonRequired: millisecondsUntilStart > 0 && millisecondsUntilStart <= DAY_MS,
    startsAt,
    hoursUntilStart: millisecondsUntilStart / (60 * 60 * 1000),
  }
}

export const evaluateNormalClassOpening = ({
  classItem,
  enrollments,
  sessions,
  authorities = [],
  reason = '',
  now = new Date(),
} = {}) => {
  const blockers = []
  const unverified = []
  const isNormal = normalize(classItem?.classType) === 'normal'
  if (!classItem) blockers.push('Không tìm thấy thông tin lớp.')
  else if (!isNormal) blockers.push('Chỉ hỗ trợ xác nhận khai giảng lớp Normal.')

  if (!Array.isArray(authorities)) unverified.push('Chưa xác minh quyền MANAGE_CLASSES.')
  else if (!authorities.includes('MANAGE_CLASSES')) blockers.push('Tài khoản chưa có quyền MANAGE_CLASSES.')

  const status = normalize(classItem?.apiStatus ?? classItem?.status)
  if (!status) unverified.push('Chưa có trạng thái lớp từ Backend.')
  else if (status !== 'open' && status !== 'published') blockers.push('Trạng thái lớp hiện tại không cho phép xác nhận khai giảng.')

  if (classItem?.openingConfirmedAt === undefined) unverified.push('Chưa có metadata xác nhận khai giảng.')
  else if (classItem.openingConfirmedAt !== null) blockers.push('Lớp đã được xác nhận khai giảng.')

  if (classItem?.changePending === undefined || classItem?.changePending === null) {
    unverified.push('Chưa xác minh trạng thái phương án thay đổi.')
  } else if (classItem.changePending) {
    blockers.push('Lớp đang có phương án thay đổi chờ xử lý.')
  }

  const coachAssigned = validPositiveId(classItem?.coachId)
  if (classItem && !coachAssigned) blockers.push('Lớp chưa có Coach được phân công.')

  const firstSessionEntry = getFirstNormalClassSession(sessions)
  if (!firstSessionEntry) {
    unverified.push(Array.isArray(sessions) ? 'Chưa xác định được buổi học đầu tiên.' : 'Chưa tải được lịch học để xác minh buổi đầu tiên.')
  } else {
    if (!validPositiveId(firstSessionEntry.session.coachId)) unverified.push('Chưa xác minh Coach của buổi học đầu tiên.')
    if (!validPositiveId(firstSessionEntry.session.roomId)) unverified.push('Chưa xác minh phòng của buổi học đầu tiên.')
  }

  const rawMinimum = classItem?.minCapacity
  const minimum = Number(rawMinimum)
  const hasMinimum = rawMinimum !== null && rawMinimum !== undefined && rawMinimum !== '' && Number.isInteger(minimum) && minimum >= 0
  let paidRegisteredCount = null
  if (!hasMinimum) {
    unverified.push('Chưa có sĩ số tối thiểu từ Backend.')
  }
  if (!Array.isArray(enrollments)) {
    unverified.push('Chưa tải được danh sách đăng ký để xác minh sĩ số đã thanh toán.')
  } else {
    paidRegisteredCount = enrollments.filter((enrollment) =>
      normalize(enrollment?.status) === 'registered' && normalize(enrollment?.paymentStatus) === 'paid',
    ).length
    if (hasMinimum && paidRegisteredCount < minimum) {
      blockers.push(`Chưa đủ sĩ số tối thiểu đã thanh toán (${paidRegisteredCount}/${minimum}).`)
    }
  }

  const timing = firstSessionEntry
    ? getOpeningReasonRequirement({ firstSession: firstSessionEntry.session, now })
    : { known: false, reasonRequired: null, startsAt: null, hoursUntilStart: null }
  if (!timing.known) {
    unverified.push('Chưa xác minh thời điểm bắt đầu buổi học đầu tiên.')
  } else if (timing.hoursUntilStart <= 0) {
    blockers.push('Buổi học đầu tiên đã bắt đầu hoặc đã qua.')
  }

  const normalizedReason = String(reason ?? '').trim()
  if (timing.reasonRequired && !normalizedReason) {
    blockers.push('Cần nhập lý do khi xác nhận trong 24 giờ trước buổi đầu tiên.')
  }

  // Coach state, room suitability, schedule conflicts and final opening eligibility
  // remain Backend checks; this result never claims those rules are satisfied.
  unverified.push('Backend cần xác nhận Coach, phòng, lịch và điều kiện khai giảng cuối cùng.')

  return {
    canSubmit: blockers.length === 0,
    eligibilityStatus: blockers.length ? 'not-ready' : unverified.length ? 'unverified' : 'prechecks-passed',
    isNormal,
    paidRegisteredCount,
    minimum: hasMinimum ? minimum : null,
    firstSession: firstSessionEntry?.session ?? null,
    firstSessionStartsAt: timing.startsAt,
    reasonRequired: timing.known ? timing.reasonRequired : null,
    payload: timing.reasonRequired && normalizedReason ? { reason: normalizedReason } : {},
    blockers,
    unverified,
    backendIsFinalAuthority: true,
  }
}

export const getNormalClassOpeningError = (error) => ({
  status: Number(error?.status ?? error?.response?.status) || 0,
  code: typeof error?.code === 'string' ? error.code : null,
  message: getErrorMessage(error, 'Không thể xác nhận khai giảng. Vui lòng thử lại.'),
  details: error?.details ?? error?.response?.data ?? null,
})

