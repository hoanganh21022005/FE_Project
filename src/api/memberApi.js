import { httpClient } from "./httpClient.js"
import { mapMember, toMemberRequest } from "./memberMappers.js"
import { extractList } from "./schemaValidators.js"

export const getMembers = async (options) => {
  const data = await httpClient.get("/api/members", options)
  const list = extractList(data)
  return Array.isArray(list) ? list.map(mapMember).filter(Boolean) : []
}

export const getMemberById = async (id) => {
  if (id === null || id === undefined || id === "") {
    throw new Error("ID hội viên không hợp lệ.")
  }
  const data = await httpClient.get(`/api/members/${id}`)
  return mapMember(data)
}

export const createMember = async (data) => {
  const payload = toMemberRequest(data)
  const created = await httpClient.post("/api/members", payload)
  return mapMember(created)
}

export const updateMember = async (id, data) => {
  if (id === null || id === undefined || id === "") {
    throw new Error("ID hội viên không hợp lệ.")
  }
  const payload = toMemberRequest(data)
  const updated = await httpClient.put(`/api/members/${id}`, payload)
  return mapMember(updated)
}

export const updateMemberStatus = async (id, status) => {
  if (id === null || id === undefined || id === "")
    throw new Error("Member ID is required.")
  const updated = await httpClient.patch(`/api/members/${id}/status`, {
    status: String(status).toUpperCase(),
  })
  return mapMember(updated)
}

export const getAtRiskMembers = async () => {
  const data = await httpClient.get("/api/members/at-risk")
  const list = extractList(data)
  return Array.isArray(list) ? list : []
}

export const getCoachAtRiskMembers = async () => {
  const data = await httpClient.get("/api/coaches/me/at-risk-members")
  const list = extractList(data)
  return Array.isArray(list) ? list : []
}

export const liftBookingBlock = async (memberId, reason = "") => {
  if (!memberId) throw new Error("Member ID is required.")
  return httpClient.patch(`/api/members/${memberId}/booking-block/lift`, {
    reason,
  })
}

export const getMyMemberProfile = async () => {
  return httpClient.get("/api/members/me")
}

export const patchMyMemberProfile = async (data = {}) => {
  const payload = {}
  if (data.name !== undefined && String(data.name).trim() !== "") {
    payload.name = String(data.name).trim()
  }
  if (data.phone !== undefined) {
    payload.phone = data.phone ? String(data.phone).trim() : null
  }
  if (data.address !== undefined) {
    payload.address = data.address ? String(data.address).trim() : null
  }
  if (data.dateOfBirth !== undefined) {
    payload.dateOfBirth = data.dateOfBirth
      ? String(data.dateOfBirth).slice(0, 10)
      : null
  }
  if (data.gender !== undefined) {
    const rawGender = String(data.gender || "").trim()
    const normalizedGender =
      rawGender.toLowerCase() === "nam" || rawGender.toLowerCase() === "male"
        ? "Male"
        : rawGender.toLowerCase() === "nữ" ||
            rawGender.toLowerCase() === "nu" ||
            rawGender.toLowerCase() === "female"
          ? "Female"
          : rawGender
            ? "Other"
            : null
    payload.gender = normalizedGender
  }
  if (data.goal !== undefined) {
    payload.goal = data.goal ? String(data.goal).trim() : null
  }
  if (data.healthNote !== undefined) {
    payload.healthNote = data.healthNote ? String(data.healthNote).trim() : null
  }
  return httpClient.patch("/api/members/me", payload)
}

export const registerMemberProfile = async (data) => {
  const payload = toMemberRequest(data)
  const created = await httpClient.post("/api/members/register", payload)
  return mapMember(created)
}

export const getMyCheckinCode = async () => {
  return httpClient.get("/api/members/me/checkin-code")
}

export const memberApi = {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  updateMemberStatus,
  getAtRiskMembers,
  getCoachAtRiskMembers,
  liftBookingBlock,
  getMyMemberProfile,
  patchMyMemberProfile,
  registerMemberProfile,
  getMyCheckinCode,
}

export default memberApi
