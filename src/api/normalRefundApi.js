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

const requiredText = (value, field, maxLength = 2000) => {
  const text = optionalText(value, field)
  if (!text) throw new NormalRefundValidationError(`${field} is required.`, `NORMAL_REFUND_${field.toUpperCase()}_REQUIRED`)
  if (text.length > maxLength) throw new NormalRefundValidationError(`${field} exceeds ${maxLength} characters.`, `NORMAL_REFUND_${field.toUpperCase()}_TOO_LONG`)
  return text
}

export const buildVerifyNormalRefundReceiverRequest = (refund, input = {}) => {
  const current = requireRefund(refund, refund?.id)
  assertOnlyKeys(input, ['source', 'note'])
  const source = requiredText(input.source, 'source')
  const note = optionalText(input.note, 'note')
  if (note?.length > 2000) throw new NormalRefundValidationError('note exceeds 2000 characters.', 'NORMAL_REFUND_NOTE_TOO_LONG')
  return {
    version: current.version,
    source,
    ...(note === undefined ? {} : { note }),
  }
}

export const buildApproveNormalRefundRequest = (refund, input = {}) => {
  const current = requireRefund(refund, refund?.id)
  assertOnlyKeys(input, [])
  if (current.receiverVerified !== true) {
    throw new NormalRefundValidationError('Receiver must be verified before approval.', 'RECEIVER_VERIFICATION_REQUIRED')
  }
  return { version: current.version }
}

export const buildNormalRefundNoteRequest = (refund, input = {}) => {
  const current = requireRefund(refund, refund?.id)
  assertOnlyKeys(input, ['note'])
  return { version: current.version, note: requiredText(input.note, 'note') }
}

const isValidDateTime = (value) => typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value))

export const buildNormalRefundVerificationRequest = (refund, attempt, input = {}) => {
  const current = requireRefund(refund, refund?.id)
  assertOnlyKeys(input, [
    'outcome', 'bankSource', 'reference', 'amount', 'receiverId', 'performedAt', 'note',
    'independentBankCheckConfirmed', 'documentVerified',
  ])
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) {
    throw new NormalRefundValidationError('A current Backend NormalRefundAttemptView is required.', 'NORMAL_REFUND_ATTEMPT_UNVERIFIED')
  }
  if (!positiveInt32(attempt.id)) {
    throw new NormalRefundValidationError('Attempt ID is missing or invalid.', 'NORMAL_REFUND_ATTEMPT_UNVERIFIED')
  }
  const outcome = optionalText(input.outcome, 'outcome')
  const allowedOutcomes = ['Success', 'Pending', 'Failed', 'Reversed']
  if (!allowedOutcomes.includes(outcome)) throw new NormalRefundValidationError('Outcome must match a Backend-supported value.', 'BANK_OUTCOME_INVALID')
  const bankSource = requiredText(input.bankSource, 'bankSource')
  const note = requiredText(input.note, 'note')

  if (outcome !== 'Success') return { version: current.version, outcome, bankSource, note }

  if (input.independentBankCheckConfirmed !== true) {
    throw new NormalRefundValidationError('Manager must confirm an independent bank check.', 'NORMAL_REFUND_INDEPENDENT_CHECK_REQUIRED')
  }
  if (input.documentVerified !== true || !Array.isArray(attempt.documentIds) || attempt.documentIds.length === 0) {
    throw new NormalRefundValidationError('A valid transfer document is required before Success reconciliation.', 'TRANSFER_DOCUMENT_REQUIRED')
  }
  if (String(attempt.status || '').trim().toLowerCase() !== 'submitted') {
    throw new NormalRefundValidationError('Only a Submitted transfer attempt can be reconciled as Success.', 'NORMAL_REFUND_ATTEMPT_NOT_SUBMITTED')
  }

  const reference = optionalText(input.reference, 'reference')
  if (!reference) throw new NormalRefundValidationError('reference is required.', 'NORMAL_REFUND_REFERENCE_REQUIRED')
  const rawAmount = input.amount
  const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount)
  if (!Number.isFinite(amount) || amount < 0 || rawAmount === '' || rawAmount === null || rawAmount === undefined) {
    throw new NormalRefundValidationError('An independently verified amount is required.', 'NORMAL_REFUND_AMOUNT_UNVERIFIED')
  }
  if (typeof current.amount !== 'number' || !Number.isFinite(current.amount)) {
    throw new NormalRefundValidationError('Backend refund amount is unavailable for exact reconciliation.', 'NORMAL_REFUND_AMOUNT_UNVERIFIED')
  }
  if (typeof attempt.amount !== 'number' || !Number.isFinite(attempt.amount)) {
    throw new NormalRefundValidationError('Backend submitted attempt amount is unavailable for exact reconciliation.', 'NORMAL_REFUND_AMOUNT_UNVERIFIED')
  }
  const receiverId = Number(input.receiverId)
  if (!positiveInt32(receiverId)) throw new NormalRefundValidationError('An independently verified receiverId is required.', 'NORMAL_REFUND_RECEIVER_UNVERIFIED')
  const performedAt = requiredText(input.performedAt, 'performedAt')
  if (!isValidDateTime(performedAt)) throw new NormalRefundValidationError('performedAt must be a valid date-time.', 'NORMAL_REFUND_VERIFICATION_UNVERIFIED')
  if (amount !== current.amount) {
    throw new NormalRefundValidationError('Reconciled amount does not exactly match the Backend refund amount.', 'BANK_VERIFICATION_MISMATCH')
  }
  if (amount !== attempt.amount) {
    throw new NormalRefundValidationError('Reconciled amount does not exactly match the Backend submitted attempt.', 'BANK_VERIFICATION_MISMATCH')
  }
  const expectedReceiver = attempt.receiverId ?? current.receiverId
  if (!positiveInt32(expectedReceiver)) {
    throw new NormalRefundValidationError('Backend recipient ID is unavailable for exact reconciliation.', 'NORMAL_REFUND_RECEIVER_UNVERIFIED')
  }
  if (receiverId !== expectedReceiver) {
    throw new NormalRefundValidationError('Reconciled receiverId does not match the Backend recipient.', 'BANK_VERIFICATION_MISMATCH')
  }
  if (current.receiverId !== null && current.receiverId !== undefined && positiveInt32(current.receiverId) && receiverId !== current.receiverId) {
    throw new NormalRefundValidationError('Reconciled receiverId does not match the current Backend recipient.', 'BANK_VERIFICATION_MISMATCH')
  }
  if (!attempt.bankReference || reference !== attempt.bankReference) {
    throw new NormalRefundValidationError('Reconciled reference does not match the submitted transfer reference.', 'BANK_VERIFICATION_MISMATCH')
  }
  if (!isValidDateTime(attempt.performedAt) || Date.parse(performedAt) !== Date.parse(attempt.performedAt)) {
    throw new NormalRefundValidationError('Reconciled performedAt does not match the submitted transfer time.', 'BANK_VERIFICATION_MISMATCH')
  }
  return { version: current.version, outcome, bankSource, reference, amount, receiverId, performedAt, note }
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
const managerMutationOnce = (path, input, actor, execute) => {
  const key = `${path}:${actor?.id ?? 'unknown'}:${JSON.stringify(input)}`
  const existing = writesInFlight.get(key)
  if (existing) return existing
  const request = Promise.resolve()
    .then(execute)
    .then(requireView)
    .finally(() => writesInFlight.delete(key))
  writesInFlight.set(key, request)
  return request
}

export const canActOnNormalRefund = (user, refund) => {
  if (!canReviewNormalRefund(user)) return false
  if (user?.authenticated !== true) return false
  if (typeof user?.status === 'string' && user.status.trim().toLowerCase() !== 'active') return false
  if (user?.isActive === false || user?.enabled === false) return false
  const actorCenter = user?.centerId
  const refundCenter = refund?.centerId
  if (actorCenter !== undefined && actorCenter !== null && refundCenter !== undefined && refundCenter !== null) {
    if (String(actorCenter) !== String(refundCenter)) return false
  }
  return true
}

const requireManagerActor = (actor, refund) => {
  if (!canActOnNormalRefund(actor, refund)) {
    throw new NormalRefundValidationError(
      'A signed-in active Center Manager with MANAGE_INVOICES in the refund center is required.',
      'NORMAL_REFUND_MANAGER_ACCESS_REQUIRED',
    )
  }
}

const splitActorOptions = (options = {}) => {
  const { actor, ...httpOptions } = options || {}
  return { actor, httpOptions }
}

const currentRefundThenPost = (refundId, route, input, buildRequest, options) => {
  const id = requireId(refundId, 'refundId')
  const path = `/api/normal-refunds/${id}/${route}`
  const { actor, httpOptions } = splitActorOptions(options)
  return managerMutationOnce(path, input, actor, async () => {
    if (!canActOnNormalRefund(actor)) requireManagerActor(actor, null)
    const current = await getNormalRefundById(id, httpOptions)
    requireManagerActor(actor, current)
    const payload = buildRequest(current, input)
    return httpClient.post(path, payload, httpOptions)
  })
}

export const verifyNormalRefundReceiver = (refundId, input = {}, options) =>
  currentRefundThenPost(refundId, 'verify-receiver', input, buildVerifyNormalRefundReceiverRequest, options)

export const approveNormalRefund = (refundId, input = {}, options) =>
  currentRefundThenPost(refundId, 'approve', input, buildApproveNormalRefundRequest, options)

export const requestNormalRefundInformation = (refundId, input = {}, options) =>
  currentRefundThenPost(refundId, 'request-information', input, buildNormalRefundNoteRequest, options)

export const recordNormalRefundIssue = (refundId, input = {}, options) =>
  currentRefundThenPost(refundId, 'issues', input, buildNormalRefundNoteRequest, options)

export const verifyNormalRefundAttempt = (refundId, attemptId, input = {}, options) => {
  const id = requireId(refundId, 'refundId')
  const attempt = requireId(attemptId, 'attemptId')
  const path = `/api/normal-refunds/${id}/attempts/${attempt}/verify`
  const { actor, httpOptions } = splitActorOptions(options)
  return managerMutationOnce(path, input, actor, async () => {
    if (!canActOnNormalRefund(actor)) requireManagerActor(actor, null)
    const current = await getNormalRefundById(id, httpOptions)
    requireManagerActor(actor, current)
    if (!Array.isArray(current.attempts)) {
      throw new NormalRefundValidationError('Current Backend attempt list is unavailable.', 'NORMAL_REFUND_ATTEMPT_UNVERIFIED')
    }
    const currentAttempt = current.attempts.find((item) => String(item?.id) === String(attempt))
    if (input?.outcome === 'Success') {
      if (input?.documentVerified !== true || !Array.isArray(currentAttempt?.documentIds) || currentAttempt.documentIds.length === 0) {
        throw new NormalRefundValidationError('A valid transfer document must be inspected before Success reconciliation.', 'TRANSFER_DOCUMENT_REQUIRED')
      }
      let documentAvailable = false
      for (const documentId of currentAttempt.documentIds) {
        try {
          await getNormalRefundDocument(id, documentId, httpOptions)
          documentAvailable = true
          break
        } catch {
          // Continue checking other document IDs without logging response data.
        }
      }
      if (!documentAvailable) throw new NormalRefundValidationError('No valid transfer document could be read from Backend.', 'TRANSFER_DOCUMENT_REQUIRED')
    }
    const payload = buildNormalRefundVerificationRequest(current, currentAttempt, input)
    return httpClient.post(path, payload, httpOptions)
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
