import { httpClient } from "./httpClient.js"
import { extractList } from "./schemaValidators.js"

export const scanAttendance = async (payload) => {
  try {
    return await httpClient.post("/api/attendances/qr-checkin", payload)
  } catch (error) {
    if (error?.status === 404) {
      return httpClient.post("/api/attendances/scan", payload)
    }
    throw error
  }
}

export const recordSessionAttendance = async ({
  memberId,
  sessionId,
  coachId,
  status = "Present",
  notes = "",
}) => {
  const numericMemberId = Number(memberId)
  const numericSessionId = Number(sessionId)
  const numericCoachId = Number(coachId)
  const normalizedStatus = String(status || "Present").trim()

  if (
    !Number.isNaN(numericSessionId) &&
    numericSessionId > 0 &&
    !Number.isNaN(numericCoachId) &&
    numericCoachId > 0
  ) {
    try {
      await httpClient.post(
        "/api/training-results",
        {
          sessionId: numericSessionId,
          memberId: numericMemberId,
          coachId: numericCoachId,
          attendanceStatus: normalizedStatus,
          content: notes || `Điểm danh buổi tập: ${normalizedStatus}`,
          reason: notes || undefined,
        },
        { notifyForbidden: false },
      )
    } catch {
      // ignore if training-results fails or requires existing result update
    }
  }

  if (normalizedStatus.toLowerCase() === "absent") {
    return { memberId: numericMemberId, sessionId: numericSessionId || null, state: "Absent" }
  }

  return httpClient.post("/api/attendances/check-in", {
    memberId: numericMemberId,
    notes: notes || `Điểm danh: ${normalizedStatus}`,
  })
}

export const manualCheckIn = async (payload) => {
  if (payload?.sessionId || payload?.status) {
    return recordSessionAttendance({
      memberId: payload.memberId,
      sessionId: payload.sessionId,
      status: payload.status || "Present",
      notes: payload.notes || "",
    })
  }
  try {
    return await httpClient.post("/api/attendances/check-in", payload)
  } catch (error) {
    if (error?.status === 404) {
      return httpClient.post("/api/attendances", {
        memberId: Number(payload?.memberId),
        status: "Present",
        notes: payload?.notes || "",
      })
    }
    throw error
  }
}

export const manualCheckOut = async (memberId) => {
  const id = typeof memberId === "object" ? memberId?.memberId : memberId
  const url = id
    ? `/api/attendances/check-out?memberId=${encodeURIComponent(id)}`
    : "/api/attendances/check-out"
  return httpClient.post(url)
}

export const correctAttendance = async ({ attendanceId, newState, reason }) => {
  return httpClient.post("/api/attendances/correct", {
    attendanceId,
    newState,
    reason,
  })
}

export const searchAttendances = async (params = {}) => {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      query.set(key, String(val))
    }
  }
  const qStr = query.toString() ? `?${query.toString()}` : ""
  const data = await httpClient.get(`/api/attendances${qStr}`)
  return extractList(data) || []
}

export const getSessions = async (params = {}) => {
  const query = new URLSearchParams()
  for (const [key, val] of Object.entries(params || {})) {
    if (val !== undefined && val !== null && val !== "") {
      query.set(key, String(val))
    }
  }
  const qStr = query.toString() ? `?${query.toString()}` : ""
  const data = await httpClient.get(`/api/sessions${qStr}`)
  return extractList(data) || []
}

export const attendanceApi = {
  scanAttendance,
  scanCheckin: scanAttendance,
  recordSessionAttendance,
  manualCheckIn,
  manualCheckOut,
  correctAttendance,
  searchAttendances,
  getSessions,
}

export default attendanceApi
