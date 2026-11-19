// Member phản hồi đề xuất dời khai giảng / chuyển lớp Normal:
//   POST /api/normal-proposals/{id}/respond, body {version, fingerprint, choice}
// choice là "Accept" hoặc "Refund" (Backend trả NORMAL_CHOICE_INVALID với giá trị khác).
// version và fingerprint lấy từ NormalChangeProposalView mới nhất của Member
// (GET /api/classes/{id}/normal-proposals); không tự sinh. Tách khỏi normalClassLifecycleApi.js
// (luồng Manager) để hai bên không lẫn quyền. Backend là nơi kiểm quyền và trạng thái cuối cùng.
import { httpClient } from './httpClient.js'
import { NormalLifecycleValidationError } from './normalClassLifecycleApi.js'

const INT32_MAX = 2147483647
export const NORMAL_PROPOSAL_CHOICES = Object.freeze(['Accept', 'Refund'])

const requireId = (value, label) => {
  const id = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(id) || id <= 0 || id > INT32_MAX) {
    throw new NormalLifecycleValidationError(`${label} must be a positive int32.`)
  }
  return id
}

export const validateNormalProposalChoice = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NormalLifecycleValidationError('Request payload must be an object.')
  }
  const extra = Object.keys(payload).find((key) => !['version', 'fingerprint', 'choice'].includes(key))
  if (extra) throw new NormalLifecycleValidationError(`Unsupported request field: ${extra}`)
  if (!Number.isSafeInteger(payload.version) || payload.version < 0) {
    throw new NormalLifecycleValidationError(
      'A current, safe integer proposal version is required.',
      'NORMAL_LIFECYCLE_VERSION_REQUIRED',
    )
  }
  if (typeof payload.fingerprint !== 'string' || !payload.fingerprint.trim()) {
    throw new NormalLifecycleValidationError('The proposal fingerprint is required.', 'NORMAL_PROPOSAL_FINGERPRINT_REQUIRED')
  }
  if (!NORMAL_PROPOSAL_CHOICES.includes(payload.choice)) {
    throw new NormalLifecycleValidationError('choice must be Accept or Refund.', 'NORMAL_CHOICE_INVALID')
  }
  return { version: payload.version, fingerprint: payload.fingerprint, choice: payload.choice }
}

// Dựng body từ đề xuất hiện tại của Member.
export const buildNormalProposalChoiceRequest = (proposal, choice) => {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new NormalLifecycleValidationError('A current NormalChangeProposalView is required.')
  }
  return validateNormalProposalChoice({ version: proposal.version, fingerprint: proposal.fingerprint, choice })
}

const inFlight = new Map()

export const respondNormalProposal = (proposalId, payload, options) => {
  const id = requireId(proposalId, 'proposalId')
  const body = validateNormalProposalChoice(payload)
  const path = `/api/normal-proposals/${id}/respond`
  const key = `${path}:${JSON.stringify(body)}`
  const existing = inFlight.get(key)
  if (existing) return existing
  const request = httpClient.post(path, body, options)
    .then((response) => {
      if (!response || typeof response !== 'object' || Array.isArray(response)) {
        throw new Error('Backend returned an invalid NormalChangeProposalView.')
      }
      return response
    })
    .finally(() => inFlight.delete(key))
  inFlight.set(key, request)
  return request
}
