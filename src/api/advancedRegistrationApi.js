import { httpClient } from './httpClient.js'
import { extractList, isValidNumericId } from './schemaValidators.js'

const requireList = (response, name) => {
  const rows = extractList(response)
  if (!Array.isArray(rows) || rows.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error(`Backend trả về ${name} không đúng định dạng.`)
  }
  return rows
}

export const getMyAdvancedRegistrations = async () =>
  requireList(await httpClient.get('/api/advanced-registrations'), 'danh sách đăng ký Advanced')

export const getSubjectSpecializations = async (subjectId) => {
  if (!isValidNumericId(subjectId)) throw new Error('ID môn học không hợp lệ.')
  const query = new URLSearchParams({ subjectId: String(subjectId) })
  return requireList(await httpClient.get(`/api/specializations?${query.toString()}`), 'chuyên môn huấn luyện viên')
}

export const getCoachesForSpecialization = async (specializationId) => {
  if (!isValidNumericId(specializationId)) throw new Error('ID chuyên môn không hợp lệ.')
  const query = new URLSearchParams({ specializationId: String(specializationId) })
  return requireList(await httpClient.get(`/api/coaches?${query.toString()}`), 'danh sách huấn luyện viên')
}

export const getCoachAdmissionCapacity = async (coachId, subjectId) => {
  if (!isValidNumericId(coachId) || !isValidNumericId(subjectId)) throw new Error('ID huấn luyện viên hoặc môn học không hợp lệ.')
  const query = new URLSearchParams({ subjectId: String(subjectId) })
  const response = await httpClient.get(`/api/coaches/${coachId}/admission-capacity?${query.toString()}`)
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Backend trả về năng lực tiếp nhận không đúng định dạng.')
  }
  return response
}

export const requestAdvancedRegistration = async ({ subjectId, primaryCoachId, requestKey }) => {
  if (!isValidNumericId(subjectId) || !isValidNumericId(primaryCoachId)) throw new Error('Môn học hoặc huấn luyện viên không hợp lệ.')
  if (typeof requestKey !== 'string' || !/^[A-Za-z0-9_.:-]{1,80}$/.test(requestKey)) throw new Error('Mã requestKey không hợp lệ.')
  return httpClient.post('/api/advanced-registrations', { subjectId, primaryCoachId, requestKey })
}

export const createAdvancedOrder = async (registrationId, paymentMethod) => {
  if (!isValidNumericId(registrationId)) throw new Error('ID đăng ký Advanced không hợp lệ.')
  if (!['Cash', 'VNPay'].includes(paymentMethod)) throw new Error('Phương thức thanh toán không hợp lệ.')
  return httpClient.post(`/api/advanced-registrations/${registrationId}/order`, { paymentMethod })
}

export const advancedRegistrationApi = {
  getMyAdvancedRegistrations,
  getSubjectSpecializations,
  getCoachesForSpecialization,
  getCoachAdmissionCapacity,
  requestAdvancedRegistration,
  createAdvancedOrder,
}
