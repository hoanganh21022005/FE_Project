import { httpClient } from './httpClient.js'
import { extractList, isValidNumericId } from './schemaValidators.js'

const requireList = (response, name) => {
  const rows = extractList(response)
  if (!Array.isArray(rows) || rows.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error(`Dữ liệu ${name} trả về không đúng định dạng.`)
  }
  return rows
}

const normalizeAdvancedRegistration = (item) => {
  const invoice = item?.invoice ?? item?.order?.invoice ?? item?.data?.invoice
  const order = item?.order ?? item?.data?.order
  return {
    ...item,
    acceptedAt: item?.acceptedAt ?? item?.accepted_at ?? null,
    confirmationDeadline: item?.confirmationDeadline ?? item?.confirmation_deadline ?? null,
    invoiceId: item?.invoiceId ?? item?.invoiceID ?? invoice?.invoiceId ?? invoice?.id ?? order?.invoiceId ?? null,
    invoiceCode: item?.invoiceCode ?? invoice?.invoiceCode ?? invoice?.code ?? null,
    amount: item?.amount ?? invoice?.amount ?? order?.amount ?? null,
    paymentStatus: item?.paymentStatus ?? invoice?.paymentStatus ?? order?.paymentStatus ?? null,
    orderStatus: item?.orderStatus ?? order?.status ?? invoice?.status ?? null,
    paymentUrl: item?.paymentUrl ?? invoice?.paymentUrl ?? order?.paymentUrl ?? null,
    invoiceExpiresAt: item?.invoiceExpiresAt ?? invoice?.expiresAt ?? null,
  }
}

export const getMyAdvancedRegistrations = async () =>
  requireList(await httpClient.get('/api/advanced-registrations'), 'danh sách đăng ký Advanced').map(normalizeAdvancedRegistration)

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

const unwrapOrderResponse = (response) => {
  let payload = response
  for (let depth = 0; depth < 4; depth += 1) {
    const nested = ['data', 'result', 'payload', 'order', 'invoice'].find((key) =>
      payload?.[key] && typeof payload[key] === 'object' && !Array.isArray(payload[key]))
    if (!nested) break
    payload = { ...payload, ...payload[nested] }
  }
  return payload
}

export const normalizeAdvancedOrderResponse = (response) => {
  const payload = unwrapOrderResponse(response)
  const invoice = response?.invoice ?? response?.data?.invoice ?? response?.order?.invoice ?? payload?.invoice
  const order = response?.order ?? response?.data?.order ?? payload?.order
  return {
    ...payload,
    invoiceId: payload?.invoiceId ?? payload?.invoiceID ?? invoice?.invoiceId ?? invoice?.id ?? order?.invoiceId ?? null,
    invoiceCode: payload?.invoiceCode ?? invoice?.invoiceCode ?? invoice?.code ?? null,
    paymentUrl: payload?.paymentUrl ?? payload?.url ?? payload?.vnpayUrl ?? invoice?.paymentUrl ?? order?.paymentUrl ?? null,
    amount: payload?.amount ?? payload?.totalAmount ?? payload?.total ?? invoice?.amount ?? null,
    paymentStatus: payload?.paymentStatus ?? invoice?.paymentStatus ?? null,
    status: payload?.status ?? order?.status ?? invoice?.status ?? null,
    expiresAt: payload?.expiresAt ?? payload?.invoiceExpiresAt ?? invoice?.expiresAt ?? null,
  }
}

export const getCoachAdmissionCapacity = async (coachId, subjectId) => {
  if (!isValidNumericId(coachId) || !isValidNumericId(subjectId)) throw new Error('ID huấn luyện viên hoặc môn học không hợp lệ.')
  const query = new URLSearchParams({ subjectId: String(subjectId) })
  const response = await httpClient.get(`/api/coaches/${coachId}/admission-capacity?${query.toString()}`)
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('Dữ liệu năng lực tiếp nhận trả về không đúng định dạng.')
  }
  return response
}

export const requestAdvancedRegistration = async ({ subjectId, primaryCoachId, requestKey }) => {
  if (!isValidNumericId(subjectId) || !isValidNumericId(primaryCoachId)) throw new Error('Môn học hoặc huấn luyện viên không hợp lệ.')
  if (typeof requestKey !== 'string' || !/^[A-Za-z0-9_.:-]{1,80}$/.test(requestKey)) throw new Error('Mã requestKey không hợp lệ.')
  return httpClient.post('/api/advanced-registrations', { subjectId, primaryCoachId, requestKey })
}

export const cancelAdvancedRegistration = async (registrationId) => {
  if (!isValidNumericId(registrationId)) throw new Error('ID đăng ký Advanced không hợp lệ.')
  return httpClient.delete(`/api/advanced-registrations/${registrationId}`)
}

export const createAdvancedOrder = async (registrationId, paymentMethod) => {
  if (!isValidNumericId(registrationId)) throw new Error('ID đăng ký Advanced không hợp lệ.')
  if (!['Cash', 'VNPay'].includes(paymentMethod)) throw new Error('Phương thức thanh toán không hợp lệ.')
  const response = await httpClient.post(`/api/advanced-registrations/${registrationId}/order`, { paymentMethod })
  return normalizeAdvancedOrderResponse(response)
}

export const decideAdvancedRegistration = async (registrationId, { accepted, reason = '' } = {}) => {
  if (!isValidNumericId(registrationId)) throw new Error('ID đăng ký Advanced không hợp lệ.')
  const normalizedReason = String(reason || '').trim()
  const payload = { accepted: Boolean(accepted) }
  if (normalizedReason) payload.reason = normalizedReason
  return httpClient.post(`/api/advanced-registrations/${registrationId}/decision`, payload)
}

export const getCoachWorkSchedule = async (coachId) => {
  if (!isValidNumericId(coachId)) throw new Error('ID huấn luyện viên không hợp lệ.')
  return httpClient.get(`/api/coaches/${coachId}/work-schedule`)
}

export const advancedRegistrationApi = {
  getMyAdvancedRegistrations,
  getSubjectSpecializations,
  getCoachesForSpecialization,
  getCoachAdmissionCapacity,
  requestAdvancedRegistration,
  cancelAdvancedRegistration,
  createAdvancedOrder,
  decideAdvancedRegistration,
  getCoachWorkSchedule,
}
