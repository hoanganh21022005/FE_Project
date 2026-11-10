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
  const daysOfWeek = toBackendDaysOfWeek(rawDays).map((day) =>
    typeof day === 'string' && /^\d+$/.test(day) ? Number(day) : day,
  )
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
  { getSessionsFn, getCatalogSessionsFn = null, expectedCount = 12 } = {},
) => {
  const numericClassId = Number(classId)
  if (!Number.isInteger(numericClassId) || numericClassId <= 0) {
    const err = new Error('API chưa trả về mã lớp học hợp lệ để xác minh danh sách buổi học.')
    err.code = 'INVALID_CREATED_CLASS_ID'
    throw err
  }

  if (typeof getSessionsFn !== 'function' && typeof getCatalogSessionsFn !== 'function') {
    const err = new Error('Thiếu hàm truy vấn buổi học để xác minh 12 buổi của lớp Normal.')
    err.code = 'MISSING_SESSION_VERIFIER'
    throw err
  }

  let sessions = null
  let primaryError = null
  if (typeof getSessionsFn === 'function') {
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

  const dates = validSessions
    .map((session) => session.sessionDate || session.date || null)
    .filter(Boolean)
    .sort()

  return {
    verified: true,
    count: validSessions.length,
    sessions: validSessions,
    endDate: dates.length > 0 ? dates[dates.length - 1] : null,
  }
}
