import { httpClient } from "./httpClient.js"
import { extractList } from "./schemaValidators.js"
import { getMemberEnrollments } from "./classEnrollmentApi.js"

const list = async (path) => {
  const data = await httpClient.get(path)
  return extractList(data) || []
}

// The member enrollment history is the documented source for enrolled Normal classes.
// /api/sessions is a general schedule lookup and is not member-scoped by the API contract.
export const getMemberClasses = (memberId) => getMemberEnrollments(memberId)
export const getClassSessions = () => list("/api/sessions")
export const hasScheduledClassSession = (classId, sessions = []) =>
  Array.isArray(sessions) &&
  sessions.some(
    (session) =>
      String(session.classId) === String(classId) &&
      String(session.status || "").toLowerCase() === "scheduled" &&
      session.isPrivate !== true,
  )
export const getMemberAttendances = (memberId) =>
  list(`/api/attendances?memberId=${encodeURIComponent(memberId)}`)
export const getMemberCheckinCode = () =>
  httpClient.get("/api/members/me/checkin-code")
export const getMemberTrainingPlans = (memberId) =>
  list(`/api/training-plans?memberId=${encodeURIComponent(memberId)}`)
export const getMemberTrainingResults = (memberId) =>
  list(`/api/training-results?memberId=${encodeURIComponent(memberId)}`)
export const getTrainingPlanById = (planId) =>
  httpClient.get(`/api/training-plans/${planId}`)
export const requestAbsence = (sessionId, reason) =>
  httpClient.post(`/api/sessions/${sessionId}/absence`, { reason })
export const getSessionAbsenceNotices = (sessionId) =>
  list(`/api/sessions/${sessionId}/absence-notices`)
export const cancelPrivateSession = (sessionId) =>
  httpClient.post(`/api/sessions/${sessionId}/cancel-private`)
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
  { subjectId, roomId } = {},
) => {
  if (!coachId || !date) return []
  const query = new URLSearchParams({ date: String(date).slice(0, 10) })
  if (subjectId) query.set("subjectId", subjectId)
  if (roomId) query.set("roomId", roomId)
  return list(
    `/api/sessions/coaches/${encodeURIComponent(coachId)}/available-slots?${query.toString()}`,
  )
}

export const getTimeSlots = async (isOutdoor) => {
  const q = isOutdoor !== undefined ? `?isOutdoor=${Boolean(isOutdoor)}` : ""
  return list(`/api/sessions/time-slots${q}`)
}

export const getRooms = async () => {
  return list("/api/rooms")
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

export const decideAdvancedRegistration = async (id, payload) => {
  return httpClient.post(`/api/advanced-registrations/${id}/decision`, payload)
}

export const orderAdvancedRegistration = async (id, payload) => {
  return httpClient.post(`/api/advanced-registrations/${id}/order`, payload)
}

export const memberPortalApi = {
  getMemberClasses,
  getClassSessions,
  getMemberAttendances,
  getMemberCheckinCode,
  getMemberTrainingPlans,
  getMemberTrainingResults,
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
  bookPrivateSession,
  getCoachFeedback,
  getCoachWorkSchedule,
  updateCoachWorkSchedule,
  getCoachAdmissionCapacity,
  getAdvancedRegistrations,
  createAdvancedRegistration,
  decideAdvancedRegistration,
  orderAdvancedRegistration,
}

export default memberPortalApi
