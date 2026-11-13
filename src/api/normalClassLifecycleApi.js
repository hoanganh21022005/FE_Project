import { httpClient } from './httpClient.js'
import { getErrorMessage } from './apiErrors.js'
import { normalizeRole, ROLE_MANAGER } from '../utils/navigation.js'

const INT32_MAX = 2147483647
const normalize = (value) => String(value ?? '').trim().toLowerCase()
const positiveInt32 = (value) => Number.isInteger(value) && value > 0 && value <= INT32_MAX
const validVersion = (value) => Number.isSafeInteger(value) && value >= 0

export class NormalLifecycleValidationError extends Error {
  constructor(message, code = 'NORMAL_LIFECYCLE_VALIDATION') {
    super(message)
    this.name = 'NormalLifecycleValidationError'
    this.code = code
    this.status = 0
  }
}

const requireId = (value, label) => {
  const id = typeof value === 'number' ? value : Number(value)
  if (!positiveInt32(id)) {
    throw new NormalLifecycleValidationError(`${label} must be a positive int32.`)
  }
  return id
}

const requireVersion = (value) => {
  if (!validVersion(value)) {
    throw new NormalLifecycleValidationError(
      'A current, safe integer version from an authoritative response is required.',
      'NORMAL_LIFECYCLE_VERSION_REQUIRED',
    )
  }
  return value
}

const normalizeReason = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined
  if (typeof value !== 'string') {
    throw new NormalLifecycleValidationError('Reason must be a string when provided.')
  }
  return value.trim()
}

const assertOnlyKeys = (payload, allowedKeys) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NormalLifecycleValidationError('Request payload must be an object.')
  }
  const extra = Object.keys(payload).find((key) => !allowedKeys.includes(key))
  if (extra) {
    throw new NormalLifecycleValidationError(`Unsupported request field: ${extra}`)
  }
}

const proposalKind = (kind) => {
  const value = normalize(kind).replace(/[^a-z]/g, '')
  if (value === 'postpone') return 'postpone'
  if (value === 'transfer') return 'transfer'
  return 'unknown'
}

export const classifyNormalProposalKind = (kind) => {
  const classified = proposalKind(kind)
  return {
    kind: classified,
    verified: classified !== 'unknown',
    wireValue: typeof kind === 'string' ? kind : null,
    note: classified === 'unknown' ? 'NEED_BE_CONFIRMATION: kind enum is not defined in OpenAPI.' : null,
  }
}

export const validateNormalClassProposalInput = (payload) => {
  const keys = ['kind', 'targetClassId', 'shiftDays', 'version', 'reason']
  assertOnlyKeys(payload, keys)
  if (typeof payload.kind !== 'string' || !payload.kind.trim()) {
    throw new NormalLifecycleValidationError('Proposal kind is required.')
  }
  const type = proposalKind(payload.kind)
  if (type === 'unknown') {
    throw new NormalLifecycleValidationError(
      'Unrecognized proposal kind; confirm the Backend kind value before creating this proposal.',
      'NORMAL_PROPOSAL_KIND_NEEDS_BE_CONFIRMATION',
    )
  }

  const body = {
    kind: payload.kind.trim(),
    version: requireVersion(payload.version),
  }
  const reason = normalizeReason(payload.reason)
  if (reason !== undefined) body.reason = reason

  if (type === 'postpone') {
    if (!Number.isInteger(payload.shiftDays) || payload.shiftDays <= 0 || payload.shiftDays > INT32_MAX) {
      throw new NormalLifecycleValidationError('Postpone proposals require a positive int32 shiftDays.')
    }
    if (payload.targetClassId !== undefined && payload.targetClassId !== null) {
      throw new NormalLifecycleValidationError('Postpone proposals must not include targetClassId.')
    }
    body.shiftDays = payload.shiftDays
  } else {
    if (payload.shiftDays !== undefined && payload.shiftDays !== null) {
      throw new NormalLifecycleValidationError('Transfer proposals must not include shiftDays.')
    }
    body.targetClassId = requireId(payload.targetClassId, 'targetClassId')
  }
  return body
}

export const validateNormalChangeDecision = (payload) => {
  assertOnlyKeys(payload, ['version', 'reason'])
  const body = { version: requireVersion(payload.version) }
  const reason = normalizeReason(payload.reason)
  if (reason !== undefined) body.reason = reason
  return body
}

const requireProposalView = (proposal) => {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new Error('Backend returned an invalid NormalChangeProposalView.')
  }
  // Keep the original DTO intact: version, fingerprint, schedule and member choices
  // are Backend-owned concurrency and decision data.
  return proposal
}

const proposalsInFlight = new Map()
const postOnceWhileInFlight = (path, payload, options, validateResponse = (value) => value) => {
  const key = `${path}:${JSON.stringify(payload)}`
  const current = proposalsInFlight.get(key)
  if (current) return current
  const request = httpClient.post(path, payload, options).then(validateResponse)
    .finally(() => proposalsInFlight.delete(key))
  proposalsInFlight.set(key, request)
  return request
}

export const getNormalClassProposals = async (classId, options) => {
  const id = requireId(classId, 'classId')
  const response = await httpClient.get(`/api/classes/${id}/normal-proposals`, options)
  if (!Array.isArray(response) || response.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error('Backend returned an invalid NormalChangeProposalView list.')
  }
  return response
}

export const createNormalClassProposal = (classId, payload, options) => {
  const id = requireId(classId, 'classId')
  const body = validateNormalClassProposalInput(payload)
  return postOnceWhileInFlight(`/api/classes/${id}/normal-proposals`, body, options, requireProposalView)
}

export const applyNormalClassProposal = (proposalId, payload, options) => {
  const id = requireId(proposalId, 'proposalId')
  const body = validateNormalChangeDecision(payload)
  return postOnceWhileInFlight(`/api/normal-proposals/${id}/apply`, body, options, requireProposalView)
}

export const cancelNormalClassBeforeOpening = (classId, payload, options) => {
  const id = requireId(classId, 'classId')
  const body = validateNormalChangeDecision(payload)
  return postOnceWhileInFlight(`/api/classes/${id}/cancel-before-opening`, body, options, (response) => {
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      throw new Error('Backend returned an invalid SportsClassResponse.')
    }
    return response
  })
}

export const canManageNormalClassLifecycle = (role, authorities = []) =>
  normalizeRole(role, { isApiMode: true }) === ROLE_MANAGER &&
  Array.isArray(authorities) && authorities.includes('MANAGE_CLASSES')

export const evaluateNormalClassLifecycle = (classItem, { action = 'proposal', kind = null } = {}) => {
  const blockers = []
  const unverified = []
  if (!classItem || typeof classItem !== 'object') {
    return { canAttempt: false, state: 'unverified', blockers, unverified: ['Class data is unavailable.'] }
  }

  if (normalize(classItem.classType) !== 'normal') {
    blockers.push('Only Normal classes support this lifecycle operation.')
  }
  const status = normalize(classItem.apiStatus ?? classItem.status)
  if (!status) unverified.push('Backend class status is unavailable.')
  else if (status !== 'open') blockers.push('The class is not Open; this operation is only for before-opening lifecycle.')

  if (action === 'proposal' && classItem.changePending === true) blockers.push('A class change proposal is already pending.')
  else if (action === 'proposal' && classItem.changePending !== false) unverified.push('Pending-change state is unavailable.')

  if (!validVersion(classItem.lifecycleVersion)) {
    unverified.push('Class lifecycleVersion is unavailable or invalid; reload the class before continuing.')
  }

  const kindType = proposalKind(kind)
  if (action === 'proposal' && kindType === 'postpone') {
    if (classItem.postponementCount == null || !Number.isInteger(Number(classItem.postponementCount))) {
      unverified.push('Postponement count is unavailable; Backend must enforce the once-only limit.')
    } else if (Number(classItem.postponementCount) >= 1) {
      blockers.push('The opening date has already been postponed once.')
    }
  }

  if (action !== 'proposal' && action !== 'cancel') {
    blockers.push('Unsupported Normal lifecycle action.')
  }

  const state = blockers.length ? 'blocked' : unverified.length ? 'unverified' : 'prechecks-passed'
  return {
    canAttempt: blockers.length === 0,
    state,
    classType: classItem.classType ?? null,
    status: classItem.apiStatus ?? classItem.status ?? null,
    lifecycleVersion: classItem.lifecycleVersion ?? null,
    postponementCount: classItem.postponementCount ?? null,
    changePending: typeof classItem.changePending === 'boolean' ? classItem.changePending : null,
    blockers,
    unverified,
    backendIsFinalAuthority: true,
  }
}

export const inspectNormalClassProposal = (proposal) => {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    return {
      state: 'unverified',
      kind: 'unknown',
      status: null,
      proposalVersion: null,
      fingerprint: null,
      choices: null,
      pendingChoiceCount: null,
      hasWaitingChoices: null,
      versionSemantics: 'Apply uses the current proposal version.',
    }
  }

  const choices = Array.isArray(proposal.choices) ? proposal.choices : null
  const choicesWellFormed = choices !== null && choices.every((item) =>
    item && typeof item === 'object' && !Array.isArray(item) && typeof item.choice === 'string' && item.choice.trim(),
  )
  const unknownChoiceExists = choicesWellFormed && choices.some((item) =>
    !['waiting', 'accept', 'refund'].includes(normalize(item.choice)),
  )
  const pendingChoiceCount = choicesWellFormed && !unknownChoiceExists
    ? choices.filter((item) => normalize(item.choice) === 'waiting').length
    : null
  const status = typeof proposal.status === 'string' ? proposal.status : null
  const normalizedStatus = normalize(status)
  const kind = proposalKind(proposal.kind)
  const hasWaitingChoices = pendingChoiceCount === null ? null : pendingChoiceCount > 0
  const isPending = normalizedStatus === 'pending' || hasWaitingChoices === true
  const state = isPending ? 'pending' : 'unverified'

  return {
    state,
    kind: kind === 'unknown' ? 'unknown' : kind,
    status,
    proposalVersion: proposal.version ?? null,
    fingerprint: proposal.fingerprint ?? null,
    choices,
    pendingChoiceCount,
    hasWaitingChoices,
    memberChoicesVerified: choicesWellFormed && !unknownChoiceExists,
    versionSemantics: 'Apply uses the current proposal version.',
  }
}

export const evaluateNormalProposalApply = (proposal, classItem = null) => {
  const inspected = inspectNormalClassProposal(proposal)
  const blockers = []
  const unverified = []
  if (normalize(inspected.status) !== 'pending') blockers.push('Only a Pending proposal can be applied.')
  if (!validVersion(inspected.proposalVersion)) unverified.push('Proposal version is unavailable or invalid.')

  if (inspected.hasWaitingChoices === true) blockers.push('At least one Member is still waiting to decide.')
  else if (inspected.hasWaitingChoices === null) unverified.push('Member choices are unavailable or incomplete.')

  if (classItem) {
    if (!validVersion(classItem.lifecycleVersion)) {
      unverified.push('Class lifecycleVersion is unavailable; reload the class before applying.')
    } else if (validVersion(inspected.proposalVersion) && inspected.proposalVersion !== classItem.lifecycleVersion) {
      blockers.push('The proposal version is stale; reload the current proposal and class.')
    }
  }

  return {
    canAttempt: blockers.length === 0 && unverified.length === 0,
    state: blockers.length ? 'blocked' : unverified.length ? 'unverified' : 'prechecks-passed',
    blockers,
    unverified,
    proposalVersion: inspected.proposalVersion,
    fingerprint: inspected.fingerprint,
    versionSemantics: 'The apply request version is the selected proposal version.',
    backendIsFinalAuthority: true,
  }
}

export const getNormalLifecycleError = (error) => ({
  status: Number(error?.status ?? error?.response?.status) || 0,
  code: typeof error?.code === 'string' ? error.code : null,
  message: getErrorMessage(error, 'Normal lifecycle request failed.'),
  details: error?.details ?? error?.response?.data ?? null,
})

export const normalLifecycleVersionSemantics = Object.freeze({
  proposalInput: 'Use lifecycleVersion from the latest GET /api/classes/{id}.',
  applyDecision: 'Use version from the selected proposal in GET /api/classes/{id}/normal-proposals.',
  cancelDecision: 'Use lifecycleVersion from the latest GET /api/classes/{id}.',
  fingerprint: 'Proposal view/member choice response value; do not generate or send in Manager apply/cancel bodies.',
})

export const isNormalLifecycleStaleError = (error, expectedCode) => {
  const status = Number(error?.status ?? error?.response?.status) || 0
  if (status !== 409) return false
  const details = error?.details ?? error?.response?.data
  const raw = [error?.code, error?.message, details?.code, details?.message]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toUpperCase()
  return raw.includes(expectedCode)
}

