import { httpClient } from "./httpClient.js"
import { extractList } from "./schemaValidators.js"
import { getVnpayReturnContext } from "../utils/vnpayCheckout.js"
import {
  getMemberEnrollments,
  getMemberEnrolledClasses,
  cancelEnrollmentById,
} from "./classEnrollmentApi.js"
import {
  getMyMemberProfile,
  patchMyMemberProfile,
  registerMemberProfile,
} from "./memberApi.js"
import {
  getInvoiceReceipt,
  getPaymentResolutions,
  openPaymentResolution,
} from "./invoiceApi.js"
import {
  getMyActiveConversation,
  getMyChatUnreadCount,
  getOrCreateConversation,
  getConversationMessages,
  sendConversationMessage,
  markConversationRead,
  closeConversation,
  reopenConversation,
} from "./chatApi.js"

const list = async (path) => {
  const data = await httpClient.get(path)
  return extractList(data) || []
}

// The member enrollment history is the documented source for enrolled Normal classes.
// /api/sessions is a general schedule lookup and is not member-scoped by the API contract.
export const getMemberClasses = (memberId) => getMemberEnrollments(memberId)
export const getClassSessions = (params = {}) => {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params || {})) {
    if (val !== undefined && val !== null && val !== "") {
      query.set(key, String(val))
    }
  }
  const qStr = query.toString() ? `?${query.toString()}` : ""
  return list(`/api/sessions${qStr}`)
}
export const getSessionById = (sessionId) =>
  httpClient.get(`/api/sessions/${encodeURIComponent(sessionId)}`)

export const checkSessionConflict = (payload) =>
  httpClient.post("/api/sessions/check-conflict", payload)

export const getClassCatalogSessions = async (
  classId,
  { strict = false } = {},
) => {
  if (!Number.isInteger(Number(classId)) || Number(classId) <= 0) {
    throw new Error("ID lớp học không hợp lệ.")
  }
  try {
    const response = await httpClient.get(
      `/api/sessions/catalog/${Number(classId)}`,
    )
    const sessions = extractList(response)
    if (strict && !Array.isArray(sessions)) {
      throw new Error("Lịch học của lớp trả về không đúng định dạng.")
    }
    return Array.isArray(sessions) ? sessions : []
  } catch (error) {
    if (error?.status === 404) {
      return getClassSessions({ classId: Number(classId) }).catch(() => [])
    }
    throw error
  }
}
export const hasScheduledClassSession = (classId, sessions = []) =>
  Array.isArray(sessions) &&
  sessions.some(
    (session) =>
      String(session.classId) === String(classId) &&
      String(session.status || "").toLowerCase() === "scheduled" &&
      session.isPrivate !== true,
  )
export const getMemberAttendances = async (memberId, params = {}) => {
  const query = new URLSearchParams()
  if (memberId !== undefined && memberId !== null && memberId !== "") {
    query.set("memberId", String(memberId))
  }
  if (params.sessionId) query.set("sessionId", String(params.sessionId))
  if (params.state) query.set("state", String(params.state))
  if (params.startDate) query.set("startDate", String(params.startDate))
  if (params.endDate) query.set("endDate", String(params.endDate))
  const qStr = query.toString() ? `?${query.toString()}` : ""
  return list(`/api/attendances${qStr}`)
}
export const getMemberCheckinCode = async () => {
  try {
    return await httpClient.get("/api/attendances/me/checkin-code")
  } catch (error) {
    if (error?.status === 404) {
      return httpClient.get("/api/members/me/checkin-code")
    }
    throw error
  }
}
export const getMemberTrainingPlans = (memberId) =>
  list(`/api/training-plans?memberId=${encodeURIComponent(memberId)}`)
export const getTrainingPlans = (params = {}) => {
  const query = new URLSearchParams()
  if (params.coachId) query.set("coachId", String(params.coachId))
  if (params.classId) query.set("classId", String(params.classId))
  if (params.memberId) query.set("memberId", String(params.memberId))
  const qStr = query.toString() ? `?${query.toString()}` : ""
  return list(`/api/training-plans${qStr}`)
}
export const createTrainingPlan = (payload) =>
  httpClient.post("/api/training-plans", payload)
export const updateTrainingPlanById = (id, payload) =>
  httpClient.put(`/api/training-plans/${encodeURIComponent(id)}`, payload)
export const deleteTrainingPlanById = (id) =>
  httpClient.delete(`/api/training-plans/${encodeURIComponent(id)}`)

export const getMemberTrainingResults = (memberId) =>
  list(`/api/training-results?memberId=${encodeURIComponent(memberId)}`)
export const getTrainingResults = (params = {}) => {
  const query = new URLSearchParams()
  if (params.sessionId) query.set("sessionId", String(params.sessionId))
  if (params.memberId) query.set("memberId", String(params.memberId))
  if (params.coachId) query.set("coachId", String(params.coachId))
  const qStr = query.toString() ? `?${query.toString()}` : ""
  return list(`/api/training-results${qStr}`)
}
export const createTrainingResult = (payload) =>
  httpClient.post("/api/training-results", payload)
export const recordBulkTrainingResults = (payload) =>
  httpClient.post("/api/training-results/bulk", payload)

export const getMemberBodyMetrics = async (memberId) => {
  if (!memberId) return []
  return list(`/api/members/${encodeURIComponent(memberId)}/body-metrics`)
}
export const createMemberBodyMetric = async (memberId, payload) => {
  return httpClient.post(
    `/api/members/${encodeURIComponent(memberId)}/body-metrics`,
    payload,
  )
}
export const deleteMemberBodyMetric = async (memberId, metricId) => {
  return httpClient.delete(
    `/api/members/${encodeURIComponent(memberId)}/body-metrics/${encodeURIComponent(metricId)}`,
  )
}
export const getMemberEvaluations = async (memberId) => {
  if (!memberId) return []
  try {
    return await list(
      `/api/evaluations?memberId=${encodeURIComponent(memberId)}`,
    )
  } catch {
    return []
  }
}
export const getEvaluationById = (id) =>
  httpClient.get(`/api/evaluations/${encodeURIComponent(id)}`)

export const getTrainingPlanById = (planId) =>
  httpClient.get(`/api/training-plans/${planId}`)
export const requestAbsence = (sessionId, reason) =>
  httpClient.post(`/api/sessions/${sessionId}/absence`, { reason })
export const getSessionAbsenceNotices = (sessionId) =>
  list(`/api/sessions/${sessionId}/absence-notices`)
export const cancelPrivateSession = async (sessionId) => {
  return httpClient.post(`/api/sessions/${sessionId}/cancel-private`)
}
export const submitClassFeedback = (classId, payload) =>
  httpClient.post(`/api/classes/${classId}/feedback`, {
    classId: Number(classId),
    coachId: Number(payload.coachId),
    classRating: Math.min(5, Math.max(1, Number(payload.classRating) || 5)),
    coachRating: Math.min(5, Math.max(1, Number(payload.coachRating) || 5)),
    comment: String(payload.comment || "").slice(0, 1000),
  })
export const getMyClassFeedback = async (classId) => {
  try {
    return await httpClient.get(`/api/classes/${classId}/feedback/me`)
  } catch (error) {
    if (error?.status === 404) return null
    throw error
  }
}
export const getClassFeedbacks = async (classId) => {
  try {
    return await httpClient.get(`/api/classes/${classId}/feedback`)
  } catch (error) {
    if (error?.status === 404) return null
    throw error
  }
}

export const getCoaches = async (params = {}) => {
  const query = new URLSearchParams()
  if (params.specializationId)
    query.set("specializationId", params.specializationId)
  if (params.keyword) query.set("keyword", params.keyword)
  const qStr = query.toString()
  return list(`/api/coaches${qStr ? `?${qStr}` : ""}`)
}

export const getCoachAvailableSlots = async (
  coachId,
  date,
  { startDate, endDate, subjectId, roomId } = {},
) => {
  const effectiveDate = String(date || startDate || "").slice(0, 10)
  if (!coachId || !effectiveDate) return []
  const query = new URLSearchParams({
    date: effectiveDate,
    startDate: String(startDate || effectiveDate).slice(0, 10),
    endDate: String(endDate || effectiveDate).slice(0, 10),
  })
  if (subjectId) query.set("subjectId", subjectId)
  if (roomId) query.set("roomId", roomId)
  try {
    return await list(
      `/api/coaches/${encodeURIComponent(coachId)}/available-slots?${query.toString()}`,
    )
  } catch (error) {
    if (error?.status === 404) {
      return list(
        `/api/sessions/coaches/${encodeURIComponent(coachId)}/available-slots?${query.toString()}`,
      )
    }
    throw error
  }
}

export const getTimeSlots = async (isOutdoor) => {
  const q = isOutdoor !== undefined ? `?isOutdoor=${Boolean(isOutdoor)}` : ""
  return list(`/api/sessions/time-slots${q}`)
}

export const getRooms = async () => {
  return list("/api/rooms")
}

export const getActiveHolidays = async () => {
  try {
    return await list("/api/holidays/active")
  } catch {
    return []
  }
}

export const getCenterIncidents = async () => {
  try {
    return await list("/api/center-incidents")
  } catch {
    return []
  }
}

export const bookPrivateSession = async (payload) => {
  return httpClient.post("/api/sessions/book-private", payload)
}

export const getCoachFeedback = async (params = {}) => {
  const query = new URLSearchParams()
  if (params.classId) query.set("classId", params.classId)
  const qStr = query.toString()
  const data = await httpClient.get(
    `/api/coaches/me/feedback${qStr ? `?${qStr}` : ""}`,
  )
  if (Array.isArray(data)) {
    return { totalFeedback: data.length, averageCoachRating: 0, feedback: data }
  }
  return {
    totalFeedback: Number(data?.totalFeedback || 0),
    averageCoachRating: Number(data?.averageCoachRating || 0),
    feedback: Array.isArray(data?.feedback) ? data.feedback : [],
  }
}

export const getCoachWorkSchedule = async (coachId) => {
  if (!coachId) return null
  return httpClient.get(
    `/api/coaches/${encodeURIComponent(coachId)}/work-schedule`,
  )
}

export const updateCoachWorkSchedule = async (coachId, payload) => {
  return httpClient.put(
    `/api/coaches/${encodeURIComponent(coachId)}/work-schedule`,
    payload,
  )
}

export const getCoachAdmissionCapacity = async (coachId, subjectId) => {
  return httpClient.get(
    `/api/coaches/${encodeURIComponent(coachId)}/admission-capacity?subjectId=${encodeURIComponent(subjectId)}`,
  )
}

export const getAdvancedRegistrations = async () => {
  return list("/api/advanced-registrations")
}

export const createAdvancedRegistration = async (payload) => {
  return httpClient.post("/api/advanced-registrations", payload)
}

export const decideAdvancedRegistration = async (id, payload = {}) => {
  const accepted = Boolean(
    payload.accepted !== undefined ? payload.accepted : payload.accept,
  )
  const reason = String(payload.reason ?? payload.note ?? "").trim()
  return httpClient.post(`/api/advanced-registrations/${id}/decision`, {
    accepted,
    reason,
  })
}

export const assignAlternativeCoach = async (id, payload = {}) => {
  return decideAdvancedRegistration(id, payload)
}

export const confirmAlternativeCoach = async (id, payload = {}) => {
  return decideAdvancedRegistration(id, payload)
}

export const orderAdvancedRegistration = async (id, payload) => {
  const body = String(payload?.paymentMethod || '').toLowerCase() === 'vnpay'
    ? { ...payload, ...getVnpayReturnContext() }
    : payload
  return httpClient.post(`/api/advanced-registrations/${id}/order`, body)
}

export {
  getMyMemberProfile,
  patchMyMemberProfile,
  registerMemberProfile,
  getMemberEnrolledClasses,
  cancelEnrollmentById,
  getInvoiceReceipt,
  getPaymentResolutions,
  openPaymentResolution,
  getMyActiveConversation,
  getMyChatUnreadCount,
  getOrCreateConversation,
  getConversationMessages,
  sendConversationMessage,
  markConversationRead,
  closeConversation,
  reopenConversation,
}

export const memberPortalApi = {
  getMyMemberProfile,
  patchMyMemberProfile,
  registerMemberProfile,
  getMemberClasses,
  getMemberEnrolledClasses,
  cancelEnrollmentById,
  getClassSessions,
  getSessionById,
  checkSessionConflict,
  getClassCatalogSessions,
  getMemberAttendances,
  getMemberCheckinCode,
  getMemberTrainingPlans,
  getTrainingPlans,
  createTrainingPlan,
  updateTrainingPlanById,
  deleteTrainingPlanById,
  getMemberTrainingResults,
  getTrainingResults,
  createTrainingResult,
  recordBulkTrainingResults,
  getMemberBodyMetrics,
  createMemberBodyMetric,
  deleteMemberBodyMetric,
  getMemberEvaluations,
  getEvaluationById,
  getTrainingPlanById,
  requestAbsence,
  getSessionAbsenceNotices,
  cancelPrivateSession,
  submitClassFeedback,
  getMyClassFeedback,
  getClassFeedbacks,
  getCoaches,
  getCoachAvailableSlots,
  getTimeSlots,
  getRooms,
  getActiveHolidays,
  getCenterIncidents,
  bookPrivateSession,
  getCoachFeedback,
  getCoachWorkSchedule,
  updateCoachWorkSchedule,
  getCoachAdmissionCapacity,
  getAdvancedRegistrations,
  createAdvancedRegistration,
  decideAdvancedRegistration,
  assignAlternativeCoach,
  confirmAlternativeCoach,
  orderAdvancedRegistration,
  getInvoiceReceipt,
  getPaymentResolutions,
  openPaymentResolution,
  getMyActiveConversation,
  getMyChatUnreadCount,
  getOrCreateConversation,
  getConversationMessages,
  sendConversationMessage,
  markConversationRead,
  closeConversation,
  reopenConversation,
}

export default memberPortalApi
