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
  status = "Present",
  notes = "",
}) => {
  const payload = {
    memberId: Number(memberId),
    status,
    notes,
  }
  if (sessionId && !Number.isNaN(Number(sessionId))) {
    payload.sessionId = Number(sessionId)
  }
  try {
    return await httpClient.post("/api/attendances", payload)
  } catch (error) {
    if (error?.status === 404 || error?.status === 405) {
      return httpClient.post("/api/attendances/check-in", payload)
    }
    throw error
  }
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

export const attendanceApi = {
  scanAttendance,
  recordSessionAttendance,
  manualCheckIn,
  manualCheckOut,
  correctAttendance,
  searchAttendances,
}

export default attendanceApi
