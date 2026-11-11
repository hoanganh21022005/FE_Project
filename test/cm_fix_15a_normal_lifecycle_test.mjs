import assert from 'node:assert/strict'
import {
  applyNormalClassProposal,
  canManageNormalClassLifecycle,
  cancelNormalClassBeforeOpening,
  classifyNormalProposalKind,
  createNormalClassProposal,
  evaluateNormalClassLifecycle,
  evaluateNormalProposalApply,
  getNormalClassProposals,
  getNormalLifecycleError,
  inspectNormalClassProposal,
  normalLifecycleVersionSemantics,
  validateNormalChangeDecision,
  validateNormalClassProposalInput,
} from '../src/api/normalClassLifecycleApi.js'

const proposal = {
  id: 25,
  classId: 12,
  targetClassId: 99,
  kind: 'Transfer',
  status: 'Pending',
  shiftDays: null,
  version: 7,
  fingerprint: 'be-fingerprint-25',
  reason: 'Room maintenance',
  schedule: [{ sessionId: 301, date: '2026-12-01', coachId: 8, roomId: 3 }],
  choices: [{ memberId: 4, choice: 'Waiting', respondedAt: null }],
}
const originalFetch = globalThis.fetch
const requests = []
let resolveFetch
let rejectFetch
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

try {
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options.method, body: options.body ? JSON.parse(options.body) : null })
    const response = await new Promise((resolve, reject) => { resolveFetch = resolve; rejectFetch = reject })
    return response
  }

  const listCall = getNormalClassProposals(12)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(new URL(requests.at(-1).url).pathname, '/api/classes/12/normal-proposals')
  assert.equal(requests.at(-1).method, 'GET')
  resolveFetch(jsonResponse([proposal]))
  const listed = await listCall
  assert.equal(listed[0].version, 7)
  assert.equal(listed[0].fingerprint, 'be-fingerprint-25')
  assert.deepEqual(listed[0].choices, proposal.choices)

  const postponeBody = validateNormalClassProposalInput({
    kind: 'Postpone', shiftDays: 7, version: 3, reason: 'Coach unavailable',
  })
  assert.deepEqual(postponeBody, { kind: 'Postpone', shiftDays: 7, version: 3, reason: 'Coach unavailable' })
  const transferBody = validateNormalClassProposalInput({ kind: 'Transfer', targetClassId: 99, version: 7 })
  assert.deepEqual(transferBody, { kind: 'Transfer', targetClassId: 99, version: 7 })
  assert.throws(() => validateNormalClassProposalInput({ kind: 'Postpone', shiftDays: 3, targetClassId: 99, version: 1 }), /must not include targetClassId/)
  assert.throws(() => validateNormalClassProposalInput({ kind: 'Transfer', targetClassId: 99, shiftDays: 3, version: 1 }), /must not include shiftDays/)
  assert.throws(() => validateNormalClassProposalInput({ kind: 'Transfer', targetClassId: 99, version: 1, fingerprint: 'fake' }), /Unsupported request field/)
  assert.deepEqual(classifyNormalProposalKind('Postpone').kind, 'postpone')
  assert.equal(classifyNormalProposalKind('backend-specific').verified, false)

  const createCall = createNormalClassProposal(12, { kind: 'Postpone', shiftDays: 7, version: 3 })
  const duplicateCreateCall = createNormalClassProposal(12, { kind: 'Postpone', shiftDays: 7, version: 3 })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(new URL(requests.at(-1).url).pathname, '/api/classes/12/normal-proposals')
  assert.equal(requests.filter((item) => item.method === 'POST' && item.url.includes('/classes/12/normal-proposals')).length, 1,
    'identical concurrent proposal submissions share one in-flight request')
  assert.equal(requests.at(-1).method, 'POST')
  assert.deepEqual(requests.at(-1).body, { kind: 'Postpone', version: 3, shiftDays: 7 })
  resolveFetch(jsonResponse({ ...proposal, kind: 'Postpone', choices: [] }))
  assert.equal((await createCall).version, 7)
  assert.equal((await duplicateCreateCall).version, 7)

  const decision = validateNormalChangeDecision({ version: 7, reason: '  Apply after members agree  ' })
  assert.deepEqual(decision, { version: 7, reason: 'Apply after members agree' })
  assert.deepEqual(validateNormalChangeDecision({ version: 7, reason: '   ' }), { version: 7 })
  assert.throws(() => validateNormalChangeDecision({ version: 7, fingerprint: 'should-not-send' }), /Unsupported request field/)

  const applyCall = applyNormalClassProposal(25, { version: 7, reason: 'Members agreed' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(new URL(requests.at(-1).url).pathname, '/api/normal-proposals/25/apply')
  assert.deepEqual(requests.at(-1).body, { version: 7, reason: 'Members agreed' })
  resolveFetch(jsonResponse(proposal))
  const appliedResponse = await applyCall
  assert.equal(appliedResponse.fingerprint, proposal.fingerprint)
  assert.deepEqual(appliedResponse.choices, proposal.choices)
  assert.equal(proposal.status, 'Pending', 'service does not mutate local proposal status')

  const cancelCall = cancelNormalClassBeforeOpening(12, { version: 4, reason: 'Unsafe venue' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(new URL(requests.at(-1).url).pathname, '/api/classes/12/cancel-before-opening')
  assert.deepEqual(requests.at(-1).body, { version: 4, reason: 'Unsafe venue' })
  const classResponse = { id: 12, classType: 'Normal', status: 'Cancelled', lifecycleVersion: 5 }
  resolveFetch(jsonResponse(classResponse))
  assert.deepEqual(await cancelCall, classResponse)

  const managerAuth = ['MANAGE_CLASSES']
  assert.equal(canManageNormalClassLifecycle('CenterManager', managerAuth), true)
  assert.equal(canManageNormalClassLifecycle('Member', managerAuth), false)
  assert.equal(canManageNormalClassLifecycle('Admin', managerAuth), false)
  assert.equal(canManageNormalClassLifecycle('Manager', []), false)

  const openNormal = { id: 12, classType: 'Normal', apiStatus: 'Open', lifecycleVersion: 3, postponementCount: 0, changePending: false }
  assert.equal(evaluateNormalClassLifecycle(openNormal, { action: 'proposal', kind: 'Postpone' }).canAttempt, true)
  assert.equal(evaluateNormalClassLifecycle({ ...openNormal, postponementCount: 1 }, { kind: 'Postpone' }).canAttempt, false)
  assert.equal(evaluateNormalClassLifecycle({ ...openNormal, apiStatus: 'Ongoing' }, { action: 'cancel' }).canAttempt, false)
  assert.equal(evaluateNormalClassLifecycle({ ...openNormal, classType: 'Advanced' }).canAttempt, false)
  assert.equal(evaluateNormalClassLifecycle({ ...openNormal, apiStatus: null }).state, 'unverified')
  assert.equal(evaluateNormalClassLifecycle({ ...openNormal, changePending: null }).state, 'unverified')
  assert.equal(evaluateNormalClassLifecycle({ ...openNormal, changePending: true }).canAttempt, false)

  const inspected = inspectNormalClassProposal(proposal)
  assert.equal(inspected.state, 'pending')
  assert.equal(inspected.hasWaitingChoices, true)
  assert.equal(inspected.fingerprint, proposal.fingerprint)
  assert.equal(evaluateNormalProposalApply(proposal).canAttempt, false)
  assert.equal(evaluateNormalProposalApply({ ...proposal, choices: [{ memberId: 4, choice: 'Accept' }] }).canAttempt, true)
  assert.equal(evaluateNormalProposalApply({ ...proposal, choices: undefined }).state, 'unverified')
  assert.equal(evaluateNormalProposalApply({ ...proposal, choices: [{ memberId: 4, choice: 'UnrecognizedChoice' }] }).state, 'unverified')
  assert.equal(inspectNormalClassProposal({ ...proposal, status: 'BackendReview', choices: [] }).state, 'unverified')
  assert.equal(normalLifecycleVersionSemantics.applyDecision.startsWith('NEED_BE_CONFIRMATION'), true)

  await assert.rejects(() => getNormalClassProposals(0), /positive int32/)
  assert.throws(() => createNormalClassProposal(12, { kind: 'Postpone', shiftDays: 1, version: 1.5 }), /safe integer version/)

  for (const status of [400, 401, 403, 404, 409, 500]) {
    globalThis.fetch = async (url, options) => {
      requests.push({ url: String(url), method: options.method, body: options.body ? JSON.parse(options.body) : null })
      return jsonResponse({ code: `E${status}`, message: 'rejected' }, status)
    }
    await assert.rejects(() => applyNormalClassProposal(25, { version: 7 }), (error) => error.status === status)
    assert.equal(getNormalLifecycleError({ status }).status, status)
  }
  assert.equal(requests.filter((item) => item.method === 'POST' && item.url.includes('/normal-proposals/25/apply')).length, 7,
    'each rejected write is sent once; no automatic retry occurs')
  assert.equal(requests.some((item) => item.url.includes('/respond')), false, 'Manager service does not implement Member response endpoint')
} finally {
  globalThis.fetch = originalFetch
}

console.log('CM-FIX-15A Normal lifecycle API and logic tests passed')
