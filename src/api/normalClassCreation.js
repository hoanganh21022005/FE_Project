import { toClassRequest } from './mappers.js'

export const NORMAL_CLASS_API_BLOCKED_MESSAGE =
  'Hệ thống hiện chưa hỗ trợ lưu lớp học ở trạng thái Nháp; lớp học cần được khởi tạo hoàn chỉnh cùng đầy đủ 12 buổi học.'

export const isNormalClassApiCreationBlocked = (apiEnabled, targetStatus = 'Open') =>
  Boolean(apiEnabled) && String(targetStatus || 'Open').trim().toLowerCase() === 'draft'

export const getDefaultNormalMinCapacity = (maxCapacity) => {
  const max = Number(maxCapacity)
  return Number.isInteger(max) && max > 0 ? Math.ceil((max * 2) / 3) : null
}

export const adjustNormalMinCapacityForMaxChange = (
  currentMinCapacity,
  nextMaxCapacity,
  managerCustomized = false,
) => {
  const defaultMinCapacity = getDefaultNormalMinCapacity(nextMaxCapacity)
  if (defaultMinCapacity === null) return currentMinCapacity
  if (!managerCustomized) return defaultMinCapacity

  const current = Number(currentMinCapacity)
  if (!Number.isInteger(current)) return defaultMinCapacity
  return Math.min(Number(nextMaxCapacity), Math.max(defaultMinCapacity, current))
}

export const validateNormalClassCapacity = ({
  maxCapacity,
  minCapacity,
  roomCapacity,
  maxAllowedCapacity,
  requireRoomCapacity = false,
} = {}) => {
  const max = Number(maxCapacity)
  const min = Number(minCapacity)
  const defaultMin = getDefaultNormalMinCapacity(max)

  if (defaultMin === null) return 'Sĩ số tối đa phải là số nguyên lớn hơn 0.'
  if (!Number.isInteger(min)) return 'Sĩ số tối thiểu phải là số nguyên.'
  if (Number.isFinite(Number(maxAllowedCapacity)) && max > Number(maxAllowedCapacity)) {
    return `Sĩ số lớp không được vượt quá ${Number(maxAllowedCapacity)} học viên.`
  }
  const roomMax = Number(roomCapacity)
  if (requireRoomCapacity && (!Number.isInteger(roomMax) || roomMax <= 0)) {
    return 'Không xác định được sức chứa phòng đã chọn. Vui lòng tải lại danh mục phòng.'
  }
  if (
    roomCapacity !== null && roomCapacity !== undefined && roomCapacity !== '' &&
    Number.isInteger(roomMax) && roomMax >= 0 && max > roomMax
  ) {
    return `Sĩ số vượt quá sức chứa của phòng (${roomMax} người).`
  }
  if (min < defaultMin) {
    return `Sĩ số tối thiểu không được thấp hơn mức mặc định ${defaultMin}.`
  }
  if (min > max) return 'Sĩ số tối thiểu không được lớn hơn sĩ số tối đa.'
  return ''
}

export const toBackendDaysOfWeek = (daysOfWeek) => {
  if (!Array.isArray(daysOfWeek)) return daysOfWeek
  return daysOfWeek.map((day) => day === 0 ? 7 : day === '0' ? '7' : day)
}

const NORMAL_CLASS_WEEKDAY_PATTERNS = [
  [1, 3, 5],
  [2, 4, 6],
  [1, 3, 0],
  [2, 4, 0],
  [3, 5, 0],
]

export const normalizeNormalClassWeekdays = (days) => {
  if (!Array.isArray(days)) return null
  const normalized = [...new Set(days.map((day) => {
    const numericDay = typeof day === 'number'
      ? day
      : typeof day === 'string' && /^\d+$/.test(day.trim())
        ? Number(day)
        : Number.NaN
    return numericDay === 7 ? 0 : numericDay
  }))]
  if (normalized.length !== 3 || normalized.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return null
  return NORMAL_CLASS_WEEKDAY_PATTERNS.find((pattern) =>
    pattern.length === normalized.length && pattern.every((day) => normalized.includes(day)),
  ) ?? null
}

export const parseLocalDate = (dateValue) => {
  const value = String(dateValue ?? '').slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText), month = Number(monthText), day = Number(dayText)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export const formatLocalDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getLocalWeekday = (dateValue) => parseLocalDate(dateValue)?.getDay() ?? null

export const getNextValidUpcomingDate = (selectedDays, startTime = '06:00', now = new Date()) => {
  const weekdays = [...new Set(Array.isArray(selectedDays)
    ? selectedDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [])]
  if (!weekdays.length || !(now instanceof Date) || Number.isNaN(now.getTime())) return ''
  const [hour = 6, minute = 0] = String(startTime || '06:00').split(':').map(Number)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return ''

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (let offset = 0; offset <= 7; offset += 1) {
    if (weekdays.includes(cursor.getDay())) {
      const sessionStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), hour, minute)
      if (sessionStart > now) return formatLocalDate(cursor)
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return ''
}

export const generateNormalClassPreview = (startDate, selectedDays, count = 12) => {
  const firstDate = parseLocalDate(startDate)
  const weekdays = [...new Set(Array.isArray(selectedDays)
    ? selectedDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [])]
  const sessionCount = Number(count)
  if (!firstDate || !weekdays.length || !Number.isInteger(sessionCount) || sessionCount <= 0) return []

  const sessions = []
  const cursor = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate())
  for (let offset = 0; offset < 366 && sessions.length < sessionCount; offset += 1) {
    if (weekdays.includes(cursor.getDay())) {
      sessions.push({ index: sessions.length + 1, dateStr: formatLocalDate(cursor) })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return sessions
}

export const createNormalClassRequestId = () => {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16)
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const computeNormalClassFingerprint = ({
  sportsClass,
  roomId,
  daysOfWeek,
  startTime,
  endTime,
} = {}) =>
  JSON.stringify({
    sportsClass,
    roomId: Number(roomId),
    daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
    startTime: startTime ?? null,
    endTime: endTime ?? null,
  })

export const buildNormalClassWithSessionsRequest = (
  data = {},
  { stateRef = null, requestId = null } = {},
) => {
  const mergedClassInput = {
    ...data,
    ...(data.sportsClass || {}),
    classType: 'Normal',
    totalSessions: 12,
  }
  const baseClass = toClassRequest(mergedClassInput)
  const defaultMinCapacity = getDefaultNormalMinCapacity(baseClass.maxCapacity)
  const requestedMinCapacity = mergedClassInput.minCapacity == null
    ? defaultMinCapacity
    : Number(mergedClassInput.minCapacity)
  const capacityError = validateNormalClassCapacity({
    maxCapacity: baseClass.maxCapacity,
    minCapacity: requestedMinCapacity,
    roomCapacity: data.roomCapacity,
    maxAllowedCapacity: 15,
    requireRoomCapacity: data.requireRoomCapacity,
  })
  if (capacityError) throw new Error(capacityError)

  const sportsClass = {
    name: baseClass.name,
    subjectId: baseClass.subjectId,
    coachId: baseClass.coachId,
    maxCapacity: baseClass.maxCapacity,
    minCapacity: requestedMinCapacity,
    startDate: baseClass.startDate,
    ...(baseClass.endDate ? { endDate: baseClass.endDate } : {}),
    ...(baseClass.tuitionFee !== null && baseClass.tuitionFee !== undefined
      ? { tuitionFee: baseClass.tuitionFee }
      : {}),
    ...(typeof mergedClassInput.description === 'string' && mergedClassInput.description.trim()
      ? { description: mergedClassInput.description.trim() }
      : {}),
    classType: 'Normal',
    totalSessions: 12,
    ...(baseClass.status ? { status: baseClass.status } : {}),
  }

  const roomId = Number(data.roomId)
  const rawDays = Array.isArray(data.daysOfWeek)
    ? data.daysOfWeek
    : Array.isArray(data.selectedDays)
      ? data.selectedDays
      : []
  const selectedPattern = normalizeNormalClassWeekdays(rawDays)
  if (!selectedPattern) throw new Error('Chọn đúng một trong năm mẫu lịch Normal.')
  if (!selectedPattern.includes(getLocalWeekday(baseClass.startDate))) {
    throw new Error('Ngày bắt đầu phải thuộc mẫu thứ đã chọn.')
  }
  const daysOfWeek = toBackendDaysOfWeek(selectedPattern)
    .map((day) => typeof day === 'string' && /^\d+$/.test(day) ? Number(day) : day)
  const startTime = data.startTime ?? null
  const endTime = data.endTime ?? null

  const fingerprint = computeNormalClassFingerprint({
    sportsClass,
    roomId,
    daysOfWeek,
    startTime,
    endTime,
  })

  let resolvedRequestId = null
  if (typeof requestId === 'string' && requestId.trim()) {
    resolvedRequestId = requestId.trim()
  } else if (typeof data.requestId === 'string' && data.requestId.trim()) {
    resolvedRequestId = data.requestId.trim()
  } else if (stateRef && typeof stateRef === 'object') {
    const current = stateRef.current
    const hasExistingId =
      current && typeof current.requestId === 'string' && current.requestId.trim().length > 0
    const isPayloadChanged = Boolean(hasExistingId && current.fingerprint !== fingerprint)

    if (!hasExistingId) {
      resolvedRequestId = createNormalClassRequestId()
      stateRef.current = {
        fingerprint,
        requestId: resolvedRequestId,
        idempotencyConflict: false,
        attemptLocked: false,
      }
    } else if (!isPayloadChanged) {
      resolvedRequestId = current.requestId
    } else if (current.idempotencyConflict === true || !current.attemptLocked) {
      resolvedRequestId = createNormalClassRequestId()
      stateRef.current = {
        fingerprint,
        requestId: resolvedRequestId,
        idempotencyConflict: false,
        attemptLocked: false,
      }
    } else {
      resolvedRequestId = current.requestId
    }
  } else {
    resolvedRequestId = createNormalClassRequestId()
  }

  return {
    requestId: resolvedRequestId,
    sportsClass,
    roomId,
    daysOfWeek,
    startTime,
    endTime,
  }
}

export const verifyNormalClassSessions = async (
  classId,
  {
    getSessionsFn,
    getCatalogSessionsFn = null,
    expectedCount = 12,
    expectedDaysOfWeek,
    initialSessions = null,
  } = {},
) => {
  const numericClassId = Number(classId)
  if (!Number.isInteger(numericClassId) || numericClassId <= 0) {
    const err = new Error('API chưa trả về mã lớp học hợp lệ để xác minh danh sách buổi học.')
    err.code = 'INVALID_CREATED_CLASS_ID'
    throw err
  }

  const hasCompleteInitialSessions = Array.isArray(initialSessions) && initialSessions.length === expectedCount &&
    initialSessions.every((session) => session && typeof session === 'object' &&
      (session.sessionDate ?? session.date) != null &&
      (session.startTime ?? session.startAt) != null &&
      (session.endTime ?? session.endAt) != null)
  if (typeof getSessionsFn !== 'function' && typeof getCatalogSessionsFn !== 'function' && !hasCompleteInitialSessions) {
    const err = new Error('Thiếu hàm truy vấn buổi học để xác minh 12 buổi của lớp Normal.')
    err.code = 'MISSING_SESSION_VERIFIER'
    throw err
  }

  let sessions = hasCompleteInitialSessions
    ? initialSessions
    : null
  let primaryError = null
  if (!Array.isArray(sessions) && typeof getSessionsFn === 'function') {
    try {
      sessions = await getSessionsFn({ classId: numericClassId })
    } catch (err) {
      primaryError = err
    }
  }

  if (!Array.isArray(sessions) && typeof getCatalogSessionsFn === 'function') {
    try {
      sessions = await getCatalogSessionsFn(numericClassId)
    } catch (fallbackErr) {
      throw primaryError || fallbackErr
    }
  }

  if (!Array.isArray(sessions)) {
    throw primaryError || new Error(`Không thể tải danh sách buổi học để xác minh lớp #${numericClassId}.`)
  }

  const validSessions = sessions.filter((session) => {
    if (!session || typeof session !== 'object') return false
    if (session.classId !== undefined && session.classId !== null && Number(session.classId) !== numericClassId) {
      return false
    }
    const status = String(session.status || '').trim().toLowerCase()
    return status !== 'cancelled' && status !== 'canceled'
  })

  if (validSessions.length !== expectedCount) {
    const err = new Error(
      `Lớp học #${numericClassId} đã tạo nhưng đối soát chỉ ghi nhận ${validSessions.length}/${expectedCount} buổi học hợp lệ. Vui lòng kiểm tra lại lịch học trên hệ thống.`,
    )
    err.code = 'INCOMPLETE_NORMAL_CLASS_SESSIONS'
    err.actualCount = validSessions.length
    err.expectedCount = expectedCount
    throw err
  }

  const expectedDays = [...new Set(toBackendDaysOfWeek(expectedDaysOfWeek || [])
    .map((day) => Number(day) === 7 ? 0 : Number(day)))]
  const validExpectedDays = expectedDays.length === 3 && expectedDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  const failVerification = (message, code = 'INVALID_NORMAL_CLASS_SESSIONS') => {
    const err = new Error(message)
    err.code = code
    err.actualCount = validSessions.length
    err.expectedCount = expectedCount
    throw err
  }
  if (!validExpectedDays) {
    failVerification('Không đủ dữ liệu ngày mẫu để xác minh lịch Backend trả về.', 'MISSING_NORMAL_CLASS_WEEKDAYS')
  }

  const normalizedSessions = validSessions.map((session) => {
    const dateValue = session.sessionDate ?? session.date
    const date = parseLocalDate(dateValue)
    const startTime = String(session.startTime ?? session.startAt ?? '').slice(0, 8)
    const endTime = String(session.endTime ?? session.endAt ?? '').slice(0, 8)
    const parseTime = (value) => {
      const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
      if (!match) return null
      const [, hour, minute, second = '0'] = match
      const h = Number(hour), m = Number(minute), s = Number(second)
      if (h > 23 || m > 59 || s > 59) return null
      return h * 3600 + m * 60 + s
    }
    return {
      session,
      date,
      dateStr: date ? formatLocalDate(date) : '',
      startSeconds: parseTime(startTime),
      endSeconds: parseTime(endTime),
    }
  })

  if (normalizedSessions.some(({ date, startSeconds, endSeconds }) =>
    !date || startSeconds === null || endSeconds === null || endSeconds <= startSeconds,
  )) {
    failVerification('Lịch Backend trả về có ngày hoặc khung giờ không hợp lệ; chưa thể xác minh đủ 12 buổi.')
  }

  const sortedSessions = [...normalizedSessions].sort((a, b) => a.dateStr.localeCompare(b.dateStr))
  if (new Set(sortedSessions.map(({ dateStr }) => dateStr)).size !== expectedCount) {
    failVerification('Lịch Backend trả về có ngày học trùng; chưa thể xác minh đủ 12 buổi.')
  }
  if (sortedSessions.some(({ date }) => !expectedDays.includes(date.getDay()))) {
    failVerification('Lịch Backend trả về có ngày ngoài mẫu lịch đã chọn; cần kiểm tra ngoại lệ ngày nghỉ trước khi xác nhận.')
  }

  return {
    verified: true,
    count: validSessions.length,
    sessions: sortedSessions.map(({ session }) => session),
    endDate: sortedSessions.at(-1)?.dateStr ?? null,
  }
}
