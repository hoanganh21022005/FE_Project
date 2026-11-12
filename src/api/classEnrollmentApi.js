import { httpClient } from "./httpClient.js"
import { extractList } from "./schemaValidators.js"
import { getVnpayReturnContext } from "../utils/vnpayCheckout.js"

export const getEnrollmentsByClass = async (classId, { strict = false, ...options } = {}) => {
  if (!classId) return []
  try {
    const data = await httpClient.get(`/api/classes/${classId}/enrollments`, {
      notifyForbidden: false,
      ...options,
    })
    const list = extractList(data)
    if (strict && !Array.isArray(list)) {
      throw new Error("Phản hồi danh sách enrollment không đúng định dạng.")
    }
    return Array.isArray(list) ? list : []
  } catch (err) {
    if (err?.status === 403 || err?.status === 404) {
      try {
        const fallback = await httpClient.get(
          `/api/enrollments?classId=${encodeURIComponent(classId)}`,
          { notifyForbidden: false, ...options },
        )
        const fallbackList = extractList(fallback)
        if (strict && !Array.isArray(fallbackList)) {
          throw new Error("Phản hồi danh sách enrollment không đúng định dạng.")
        }
        return Array.isArray(fallbackList) ? fallbackList : []
      } catch (fallbackError) {
        if (strict) throw fallbackError
        return []
      }
    }
    throw err
  }
}

export const enrollMemberInClass = async (classId, memberId) => {
  return await httpClient.post(`/api/classes/${classId}/enroll`, {
    classId: Number(classId),
    memberId: Number(memberId),
  })
}

// Member self-service: identity is derived by the backend from JSESSIONID.
export const enrollCurrentMemberInClass = async (classId, paymentMethod = 'VNPay') => {
  if (!Number.isInteger(Number(classId)) || Number(classId) <= 0) {
    throw new Error('ID lớp học không hợp lệ.');
  }
  if (!['VNPay', 'Cash'].includes(paymentMethod)) {
    throw new Error('Phương thức thanh toán lớp học không hợp lệ.');
  }
  const payload = { paymentMethod, ...(paymentMethod === 'VNPay' ? getVnpayReturnContext() : {}) }
  return httpClient.post(`/api/classes/${Number(classId)}/enroll`, payload);
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

export const getMemberEnrolledClasses = async (memberId) => {
  if (!memberId) return []
  const data = await httpClient.get(`/api/members/${memberId}/classes`)
  const list = extractList(data)
  return Array.isArray(list) ? list : []
}

export const getAllEnrollments = async ({ classId, memberId, status } = {}) => {
  const query = new URLSearchParams()
  if (classId) query.set("classId", String(classId))
  if (memberId) query.set("memberId", String(memberId))
  if (status) query.set("status", String(status))
  const qStr = query.toString() ? `?${query.toString()}` : ""
  const data = await httpClient.get(`/api/enrollments${qStr}`)
  const list = extractList(data)
  return Array.isArray(list) ? list : []
}

export const createEnrollmentRecord = async (payload) => {
  return httpClient.post("/api/enrollments", payload)
}

export const cancelEnrollmentById = async (enrollmentId, reason = "") => {
  if (!enrollmentId) throw new Error("ID đăng ký lớp không hợp lệ.")
  return httpClient.patch(`/api/enrollments/${enrollmentId}/cancel`, {
    reason: String(reason || "").trim(),
  })
}

export const deleteEnrollmentById = async (enrollmentId, payload) => {
  if (!enrollmentId) throw new Error("ID đăng ký lớp không hợp lệ.")
  return httpClient.delete(`/api/enrollments/${enrollmentId}`, payload ? { body: payload } : undefined)
}

export const classEnrollmentApi = {
  getEnrollmentsByClass,
  enrollMemberInClass,
  enrollCurrentMemberInClass,
  cancelMemberEnrollment,
  getMemberEnrollments,
  getMemberEnrolledClasses,
  getAllEnrollments,
  createEnrollmentRecord,
  cancelEnrollmentById,
  deleteEnrollmentById,
}

export default classEnrollmentApi
