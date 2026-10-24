import { httpClient } from "./httpClient.js"
import { extractList } from "./schemaValidators.js"

export const scanAttendance = async (payload) => {
  return httpClient.post("/api/attendances/scan", payload)
}

export const manualCheckIn = async (payload) => {
  return httpClient.post("/api/attendances/check-in", payload)
}

export const manualCheckOut = async (attendanceId) => {
  const url = attendanceId
    ? `/api/attendances/check-out?attendanceId=${encodeURIComponent(attendanceId)}`
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
  manualCheckIn,
  manualCheckOut,
  correctAttendance,
  searchAttendances,
}

export default attendanceApi
