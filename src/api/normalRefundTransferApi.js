// Hoàn tiền Normal: các bước của Member (khai tài khoản nhận) và Lễ tân (nhận việc,
// tải chứng từ, nộp kết quả chuyển khoản). Tách khỏi normalRefundApi.js (luồng Manager)
// để hai bên không lẫn quyền. Hợp đồng theo OpenAPI và NormalRefundService của Backend:
//   POST /api/normal-refunds/{id}/receiver                      Member, body {version, bank, accountNumber, accountName}
//   POST /api/normal-refunds/{id}/claim                         Lễ tân, body {version, requestId(UUID)}
//   POST /api/normal-refunds/{id}/attempts/{attempt}/documents  Lễ tân, multipart "file" (PNG/JPEG/PDF, tối đa 5 MiB)
//   POST /api/normal-refunds/{id}/attempts/{attempt}/submit     Lễ tân, body {reference, amount, currency:"VND", performedAt}
// Backend là nơi kiểm quyền và trạng thái cuối cùng; các kiểm tra ở đây chỉ chặn dữ liệu sai hình dạng.
import { httpClient } from './httpClient.js'
import { NormalRefundValidationError, getNormalRefundById } from './normalRefundApi.js'
import { normalizeRole, ROLE_RECEPTIONIST } from '../utils/navigation.js'

const INT32_MAX = 2147483647
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
const DOCUMENT_TYPES = ['image/png', 'image/jpeg', 'application/pdf']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACCOUNT_NUMBER_PATTERN = /^[A-Za-z0-9]{4,40}$/
// Backend dùng LocalDateTime: không có múi giờ (Z hoặc +07:00 sẽ bị từ chối).
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?$/

const positiveInt32 = (value) => Number.isInteger(value) && value > 0 && value <= INT32_MAX
const safeVersion = (value) => Number.isSafeInteger(value) && value >= 0

const requireId = (value, label) => {
  const id = typeof value === 'number' ? value : Number(value)
  if (!positiveInt32(id)) throw new NormalRefundValidationError(`${label} must be a positive int32.`)
  return id
}

const assertOnlyKeys = (payload, allowed) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NormalRefundValidationError('Request input must be an object.')
  }
  const extra = Object.keys(payload).find((key) => !allowed.includes(key))
  if (extra) throw new NormalRefundValidationError(`Unsupported request field: ${extra}`)
}

const requiredText = (value, field, maxLength) => {
  if (typeof value !== 'string') throw new NormalRefundValidationError(`${field} is required.`, `NORMAL_REFUND_${field.toUpperCase()}_REQUIRED`)
  const text = value.trim()
  if (!text) throw new NormalRefundValidationError(`${field} is required.`, `NORMAL_REFUND_${field.toUpperCase()}_REQUIRED`)
  if (text.length > maxLength) throw new NormalRefundValidationError(`${field} exceeds ${maxLength} characters.`, `NORMAL_REFUND_${field.toUpperCase()}_TOO_LONG`)
  return text
}

const requireVersion = (refund) => {
  if (!refund || typeof refund !== 'object' || Array.isArray(refund) || !safeVersion(refund.version)) {
    throw new NormalRefundValidationError('A current NormalRefundView with a safe integer version is required.', 'NORMAL_REFUND_VERSION_UNVERIFIED')
  }
  return refund.version
}

// Truyền object NormalRefundView mới nhất (khuyến nghị, tránh gọi thêm) hoặc mã hoàn tiền để tải lại.
const resolveRefund = async (refundOrId, options) => {
  if (refundOrId && typeof refundOrId === 'object') {
    requireId(refundOrId.id, 'refundId')
    return refundOrId
  }
  return getNormalRefundById(requireId(refundOrId, 'refundId'), options)
}

const inFlight = new Map()
const postOnce = (path, body, options) => {
  const key = `${path}:${JSON.stringify(body)}`
  const existing = inFlight.get(key)
  if (existing) return existing
  const request = httpClient.post(path, body, options).finally(() => inFlight.delete(key))
  inFlight.set(key, request)
  return request
}

const requireView = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NormalRefundValidationError(`Backend returned an invalid ${label}.`, 'NORMAL_REFUND_RESPONSE_INVALID')
  }
  return value
}

export const canWorkNormalRefundTransfer = (user) =>
  normalizeRole(user?.role, { isApiMode: true }) === ROLE_RECEPTIONIST &&
  Array.isArray(user?.authorities) &&
  user.authorities.map((authority) => String(authority).trim().toUpperCase()).includes('MANAGE_INVOICES')

// ---- Member: khai tài khoản nhận hoàn tiền -------------------------------------------------

export const buildNormalRefundReceiverRequest = (refund, input = {}) => {
  assertOnlyKeys(input, ['bank', 'accountNumber', 'accountName'])
  const bank = requiredText(input.bank, 'bank', 120)
  const accountName = requiredText(input.accountName, 'accountName', 150)
  const accountNumber = input.accountNumber
  if (typeof accountNumber !== 'string' || !ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
    throw new NormalRefundValidationError('Account number must contain 4..40 letters or digits.', 'NORMAL_REFUND_ACCOUNT_NUMBER_INVALID')
  }
  return { version: requireVersion(refund), bank, accountNumber, accountName }
}

export const submitNormalRefundReceiver = async (refundOrId, input = {}, options) => {
  const refund = await resolveRefund(refundOrId, options)
  const body = buildNormalRefundReceiverRequest(refund, input)
  return requireView(await postOnce(`/api/normal-refunds/${refund.id}/receiver`, body, options), 'NormalRefundView')
}

// ---- Lễ tân: nhận việc ----------------------------------------------------------------------

// requestId phải ổn định khi thử lại cùng một lần nhận việc; tạo một lần rồi giữ lại.
export const createNormalRefundClaimRequestId = () => {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new NormalRefundValidationError('This browser cannot generate a claim request ID.', 'NORMAL_REFUND_REQUEST_ID_UNAVAILABLE')
  }
  return globalThis.crypto.randomUUID()
}

export const buildNormalRefundClaimRequest = (refund, requestId) => {
  if (typeof requestId !== 'string' || !UUID_PATTERN.test(requestId)) {
    throw new NormalRefundValidationError('requestId must be a stable UUID.', 'NORMAL_REFUND_REQUEST_ID_REQUIRED')
  }
  return { version: requireVersion(refund), requestId }
}

export const claimNormalRefund = async (refundOrId, input = {}, options) => {
  assertOnlyKeys(input, ['requestId'])
  const refund = await resolveRefund(refundOrId, options)
  const body = buildNormalRefundClaimRequest(refund, input.requestId)
  return requireView(await postOnce(`/api/normal-refunds/${refund.id}/claim`, body, options), 'NormalRefundAttemptView')
}

// ---- Lễ tân: tải chứng từ chuyển khoản ----------------------------------------------------

export const validateNormalRefundDocument = (file) => {
  const isFile = typeof Blob !== 'undefined' && file instanceof Blob
  if (!isFile) throw new NormalRefundValidationError('A document file is required.', 'DOCUMENT_REQUIRED')
  if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) {
    throw new NormalRefundValidationError('Document must be larger than 0 and at most 5 MiB.', 'DOCUMENT_SIZE_INVALID')
  }
  if (!DOCUMENT_TYPES.includes(String(file.type || '').toLowerCase())) {
    throw new NormalRefundValidationError('Document must be a PNG, JPEG or PDF.', 'DOCUMENT_TYPE_INVALID')
  }
  return file
}

// Trả về mã chứng từ (Backend trả số nguyên; cùng nội dung tải lại thì trả mã cũ).
export const uploadNormalRefundDocument = async (refundId, attemptId, file, options) => {
  const id = requireId(refundId, 'refundId')
  const attempt = requireId(attemptId, 'attemptId')
  validateNormalRefundDocument(file)
  const form = new FormData()
  form.append('file', file, typeof file.name === 'string' && file.name ? file.name : 'document')
  const response = await httpClient.post(`/api/normal-refunds/${id}/attempts/${attempt}/documents`, form, options)
  const documentId = typeof response === 'number' ? response : Number(response?.id ?? response?.documentId)
  if (!positiveInt32(documentId)) {
    throw new NormalRefundValidationError('Backend returned an invalid document ID.', 'NORMAL_REFUND_RESPONSE_INVALID')
  }
  return documentId
}

// ---- Lễ tân: nộp kết quả chuyển khoản -------------------------------------------------------

export const buildNormalRefundSubmission = (input = {}, attempt = null) => {
  assertOnlyKeys(input, ['reference', 'amount', 'currency', 'performedAt'])
  const reference = requiredText(input.reference, 'reference', 120)
  const amount = typeof input.amount === 'number' ? input.amount : Number.NaN
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new NormalRefundValidationError('amount must be a positive number.', 'NORMAL_REFUND_AMOUNT_INVALID')
  }
  if (attempt && typeof attempt.amount === 'number' && attempt.amount !== amount) {
    throw new NormalRefundValidationError('amount must equal the approved refund amount.', 'REFUND_AMOUNT_MISMATCH')
  }
  if (input.currency !== undefined && input.currency !== 'VND') {
    throw new NormalRefundValidationError('currency must be VND.', 'NORMAL_REFUND_CURRENCY_INVALID')
  }
  const performedAt = typeof input.performedAt === 'string' ? input.performedAt.trim() : ''
  if (!LOCAL_DATE_TIME_PATTERN.test(performedAt) || !Number.isFinite(Date.parse(performedAt))) {
    throw new NormalRefundValidationError('performedAt must be a local date-time such as 2026-11-16T10:30:00 (no time zone).', 'NORMAL_REFUND_PERFORMED_AT_INVALID')
  }
  return { reference, amount, currency: 'VND', performedAt }
}

// `options.attempt` (tùy chọn) là NormalRefundAttemptView hiện tại để so khớp số tiền trước khi gửi.
export const submitNormalRefundTransfer = async (refundId, attemptId, input = {}, options = {}) => {
  const id = requireId(refundId, 'refundId')
  const attempt = requireId(attemptId, 'attemptId')
  const { attempt: currentAttempt, ...httpOptions } = options || {}
  const body = buildNormalRefundSubmission(input, currentAttempt)
  return requireView(
    await postOnce(`/api/normal-refunds/${id}/attempts/${attempt}/submit`, body, httpOptions),
    'NormalRefundAttemptView',
  )
}
