import { httpClient } from "./httpClient.js"
import { extractList } from "./schemaValidators.js"

export const getEnrollmentsByClass = async (classId) => {
  if (!classId) return []
  const data = await httpClient.get(`/api/classes/${classId}/enrollments`)
  const list = extractList(data)
  return Array.isArray(list) ? list : []
}

export const enrollMemberInClass = async (classId, memberId) => {
  return await httpClient.post(`/api/classes/${classId}/enroll`, {
    classId: Number(classId),
    memberId: Number(memberId),
  })
}

export const cancelMemberEnrollment = async (classId, memberId) => {
  return await httpClient.post(`/api/classes/${classId}/cancel-enrollment`, {
    classId: Number(classId),
    memberId: Number(memberId),
  })
}

export const getMemberEnrollments = async (memberId, { strict = false } = {}) => {
  if (!memberId) return []
  const data = await httpClient.get(`/api/members/${memberId}/enrollments`)
  const list = extractList(data)
  if (strict && !Array.isArray(list)) throw new Error("Phản hồi danh sách lớp đã đăng ký không đúng định dạng.")
  return Array.isArray(list) ? list : []
}

export const classEnrollmentApi = {
  getEnrollmentsByClass,
  enrollMemberInClass,
  cancelMemberEnrollment,
  getMemberEnrollments,
}

export default classEnrollmentApi
