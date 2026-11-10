import { httpClient } from './httpClient.js'
import { getErrorMessage } from './apiErrors.js'
import { normalizeRole, ROLE_MANAGER, ROLE_RECEPTIONIST } from '../utils/navigation.js'

const INT32_MAX = 2147483647
const positiveInt32 = (value) => Number.isInteger(value) && value > 0 && value <= INT32_MAX
const safeVersion = (value) => Number.isSafeInteger(value) && value >= 0

export class NormalRefundValidationError extends Error {
  constructor(message, code = 'NORMAL_REFUND_VALIDATION') {
    super(message)
    this.name = 'NormalRefundValidationError'
    this.code = code
    this.status = 0
  }
}

const requireId = (value, label) => {
  const id = typeof value === 'number' ? value : Number(value)
  if (!positiveInt32(id)) throw new NormalRefundValidationError(`${label} must be a positive int32.`)
  return id
}

const requireRefund = (value, expectedId) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NormalRefundValidationError('A current NormalRefundView response is required.', 'NORMAL_REFUND_VIEW_UNVERIFIED')
  }
  if (!positiveInt32(value.id) || value.id !== expectedId) {
    throw new NormalRefundValidationError('Refund ID does not match the current Backend response.', 'NORMAL_REFUND_ID_MISMATCH')
  }
  if (!safeVersion(value.version)) {
    throw new NormalRefundValidationError('Refund version is missing or cannot be represented safely.', 'NORMAL_REFUND_VERSION_UNVERIFIED')
  }
  return value
}

const assertOnlyKeys = (payload, allowed) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NormalRefundValidationError('Request input must be an object.')
  }
  const extra = Object.keys(payload).find((key) => !allowed.includes(key))
  if (extra) throw new NormalRefundValidationError(`Unsupported request field: ${extra}`)
}

const optionalText = (value, field) => {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new NormalRefundValidationError(`${field} must be a string.`)
  const trimmed = value.trim()
  return trimmed || undefined
}

export const buildNormalRefundReviewRequest = (refund, input = {}) => {
  const current = requireRefund(refund, refund?.id)
  assertOnlyKeys(input, ['source', 'note'])
  const source = optionalText(input.source, 'source')
  const note = optionalText(input.note, 'note')
  if (!source) {
    throw new NormalRefundValidationError('A Backend-approved review source must be supplied explicitly.', 'NORMAL_REFUND_SOURCE_UNVERIFIED')
  }
  return {
    version: current.version,
    source,
    ...(note === undefined ? {} : { note }),
  }
}

const isValidDateTime = (value) => typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value))

export const buildNormalRefundVerificationRequest = (refund, attempt, input = {}) => {
  const current = requireRefund(refund, refund?.id)
  assertOnlyKeys(input, ['outcome', 'bankSource', 'reference', 'performedAt', 'note'])
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) {
    throw new NormalRefundValidationError('A current Backend NormalRefundAttemptView is required.', 'NORMAL_REFUND_ATTEMPT_UNVERIFIED')
  }
  if (!positiveInt32(attempt.id)) {
    throw new NormalRefundValidationError('Attempt ID is missing or invalid.', 'NORMAL_REFUND_ATTEMPT_UNVERIFIED')
  }
  if (typeof attempt.amount !== 'number' || !Number.isFinite(attempt.amount) || attempt.amount < 0) {
    throw new NormalRefundValidationError('Attempt amount is not verified by Backend.', 'NORMAL_REFUND_AMOUNT_UNVERIFIED')
  }
  const receiverId = attempt.receiverId ?? current.receiverId
  if (!positiveInt32(receiverId)) {
    throw new NormalRefundValidationError('Refund receiver is not verified by Backend.', 'NORMAL_REFUND_RECEIVER_UNVERIFIED')
  }

  const outcome = optionalText(input.outcome, 'outcome')
  const bankSource = optionalText(input.bankSource, 'bankSource')
  const reference = optionalText(input.reference, 'reference') ?? optionalText(attempt.bankReference, 'attempt.bankReference')
  const performedAt = optionalText(input.performedAt, 'performedAt') ?? optionalText(attempt.performedAt, 'attempt.performedAt')
  const note = optionalText(input.note, 'note')
  if (!outcome || !bankSource || !reference || !isValidDateTime(performedAt)) {
    throw new NormalRefundValidationError(
      'Outcome, bank source, reference and a verified transfer time are required before reconciliation.',
      'NORMAL_REFUND_VERIFICATION_UNVERIFIED',
    )
  }

  return {
    version: current.version,
    outcome,
    bankSource,
    reference,
    amount: attempt.amount,
    receiverId,
    performedAt,
    ...(note === undefined ? {} : { note }),
  }
}

export const inspectNormalRefund = (refund) => {
  if (!refund || typeof refund !== 'object' || Array.isArray(refund)) {
    return {
      verified: false,
      id: null,
      invoiceId: null,
      classId: null,
      memberId: null,
      origin: null,
      status: null,
      amount: null,
      version: null,
      receiverId: null,
      bank: null,
      accountNumber: null,
      accountName: null,
      receiverVerified: null,
      dueAt: null,
      firstDueAt: null,
      overdue: null,
      issueNote: null,
      attempts: null,
    }
  }
  return {
    verified: true,
    id: refund.id ?? null,
    invoiceId: refund.invoiceId ?? null,
    classId: refund.classId ?? null,
    memberId: refund.memberId ?? null,
    origin: refund.origin ?? null,
    status: refund.status ?? null,
    amount: refund.amount ?? null,
    version: refund.version ?? null,
    receiverId: refund.receiverId ?? null,
    bank: refund.bank ?? null,
    accountNumber: refund.accountNumber ?? null,
    accountName: refund.accountName ?? null,
    receiverVerified: typeof refund.receiverVerified === 'boolean' ? refund.receiverVerified : null,
    dueAt: refund.dueAt ?? null,
    firstDueAt: refund.firstDueAt ?? null,
    overdue: typeof refund.overdue === 'boolean' ? refund.overdue : null,
    issueNote: refund.issueNote ?? null,
    attempts: Array.isArray(refund.attempts) ? refund.attempts : null,
  }
}

const requireView = (refund) => {
  if (!refund || typeof refund !== 'object' || Array.isArray(refund)) {
    throw new NormalRefundValidationError('Backend returned an invalid NormalRefundView.', 'NORMAL_REFUND_RESPONSE_INVALID')
  }
  return refund
}

const requireArray = (value, label) => {
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new NormalRefundValidationError(`Backend returned an invalid ${label} list.`, 'NORMAL_REFUND_RESPONSE_INVALID')
  }
  return value
}

export const getNormalRefunds = async (options) =>
  requireArray(await httpClient.get('/api/normal-refunds', options), 'NormalRefundView')

export const getNormalRefundById = async (refundId, options) => {
  const id = requireId(refundId, 'refundId')
  const refund = requireView(await httpClient.get(`/api/normal-refunds/${id}`, options))
  if (!positiveInt32(refund.id) || refund.id !== id) {
    throw new NormalRefundValidationError('Refund ID does not match the requested Backend resource.', 'NORMAL_REFUND_ID_MISMATCH')
  }
  return refund
}

export const getNormalRefundHistory = async (refundId, options) => {
  const id = requireId(refundId, 'refundId')
  const history = await httpClient.get(`/api/normal-refunds/${id}/history`, options)
  if (!history || typeof history !== 'object' || Array.isArray(history)) {
    throw new NormalRefundValidationError('Backend returned an invalid NormalRefundHistory.', 'NORMAL_REFUND_RESPONSE_INVALID')
  }
  return history
}

export const getNormalRefundDocument = async (refundId, documentId, options) => {
  const id = requireId(refundId, 'refundId')
  const document = requireId(documentId, 'documentId')
  const response = await httpClient.getBlob(`/api/normal-refunds/${id}/documents/${document}`, options)
  const mimeType = typeof response?.contentType === 'string' ? response.contentType.split(';')[0].trim().toLowerCase() : ''
  if (!(typeof Blob !== 'undefined' && response?.data instanceof Blob) || response.data.size === 0 || !mimeType || mimeType === 'application/json' || mimeType === 'text/html') {
    throw new NormalRefundValidationError(
      'The Backend document response is empty or has an unsupported content type.',
      'NORMAL_REFUND_DOCUMENT_UNVERIFIED',
    )
  }
  return {
    blob: response.data,
    contentType: response.contentType,
    contentDisposition: response.contentDisposition ?? null,
  }
}

const writesInFlight = new Map()
const managerMutationOnce = (path, input, execute) => {
  const key = `${path}:${JSON.stringify(input)}`
  const existing = writesInFlight.get(key)
  if (existing) return existing
  const request = Promise.resolve()
    .then(execute)
    .then(requireView)
    .finally(() => writesInFlight.delete(key))
  writesInFlight.set(key, request)
  return request
}

const currentRefundThenPost = (refundId, route, input, buildRequest, options) => {
  const id = requireId(refundId, 'refundId')
  const path = `/api/normal-refunds/${id}/${route}`
  return managerMutationOnce(path, input, async () => {
    const current = await getNormalRefundById(id, options)
    const payload = buildRequest(current, input)
    return httpClient.post(path, payload, options)
  })
}

export const verifyNormalRefundReceiver = (refundId, input = {}, options) =>
  currentRefundThenPost(refundId, 'verify-receiver', input, buildNormalRefundReviewRequest, options)

export const approveNormalRefund = (refundId, input = {}, options) =>
  currentRefundThenPost(refundId, 'approve', input, buildNormalRefundReviewRequest, options)

export const requestNormalRefundInformation = (refundId, input = {}, options) =>
  currentRefundThenPost(refundId, 'request-information', input, buildNormalRefundReviewRequest, options)

export const recordNormalRefundIssue = (refundId, input = {}, options) =>
  currentRefundThenPost(refundId, 'issues', input, buildNormalRefundReviewRequest, options)

export const verifyNormalRefundAttempt = (refundId, attemptId, input = {}, options) => {
  const id = requireId(refundId, 'refundId')
  const attempt = requireId(attemptId, 'attemptId')
  const path = `/api/normal-refunds/${id}/attempts/${attempt}/verify`
  return managerMutationOnce(path, input, async () => {
    const current = await getNormalRefundById(id, options)
    if (!Array.isArray(current.attempts)) {
      throw new NormalRefundValidationError('Current Backend attempt list is unavailable.', 'NORMAL_REFUND_ATTEMPT_UNVERIFIED')
    }
    const currentAttempt = current.attempts.find((item) => String(item?.id) === String(attempt))
    const payload = buildNormalRefundVerificationRequest(current, currentAttempt, input)
    return httpClient.post(path, payload, options)
  })
}

const authoritySet = (user) => Array.isArray(user?.authorities)
  ? user.authorities.map((authority) => String(authority).trim().toUpperCase())
  : []

export const isNormalRefundManager = (user) => normalizeRole(user?.role, { isApiMode: true }) === ROLE_MANAGER
export const isNormalRefundReceptionist = (user) => normalizeRole(user?.role, { isApiMode: true }) === ROLE_RECEPTIONIST
export const canReviewNormalRefund = (user) =>
  isNormalRefundManager(user) && authoritySet(user).includes('MANAGE_INVOICES')

export const getNormalRefundError = (error) => {
  const status = Number(error?.status ?? error?.response?.status) || 0
  return {
    status,
    code: typeof error?.code === 'string' ? error.code : null,
    message: typeof error?.message === 'string' && error.message ? error.message : getErrorMessage(error, 'Normal refund request failed.'),
    details: error?.details ?? error?.response?.data ?? null,
    outcomeUncertain: status === 0 || status >= 500,
    reloadBeforeNextAction: status === 0 || status === 409 || status >= 500,
  }
}

export const normalRefundVersionSemantics = Object.freeze({
  review: 'Uses version from a fresh GET /api/normal-refunds/{id} response for that refund ID.',
  attemptVerification: 'Uses the current NormalRefundView.version; NormalRefundAttemptView does not define its own version.',
  safeIntegerLimit: 'OpenAPI declares int64; values outside JavaScript safe integer range are blocked to avoid precision loss.',
})

// Intentionally no Manager claim, submit, or document-upload exports. Those are Receptionist workflows.
