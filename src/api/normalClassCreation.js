import { toClassRequest } from './mappers.js'

export const NORMAL_CLASS_API_BLOCKED_MESSAGE =
  'Hệ thống hiện chưa hỗ trợ lưu lớp học ở trạng thái Nháp; lớp học cần được khởi tạo hoàn chỉnh cùng đầy đủ 12 buổi học.'

export const isNormalClassApiCreationBlocked = (apiEnabled, targetStatus = 'Open') =>
  Boolean(apiEnabled) && String(targetStatus || 'Open').trim().toLowerCase() === 'draft'

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
  const sportsClass = {
    name: baseClass.name,
    subjectId: baseClass.subjectId,
    coachId: baseClass.coachId,
    maxCapacity: baseClass.maxCapacity,
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
