import assert from 'node:assert/strict'
import * as normalRefundApi from '../src/api/normalRefundApi.js'
import {
  approveNormalRefund,
  buildApproveNormalRefundRequest,
  buildNormalRefundNoteRequest,
  buildNormalRefundVerificationRequest,
  buildVerifyNormalRefundReceiverRequest,
  canActOnNormalRefund,
  canReviewNormalRefund,
  getNormalRefundById,
  getNormalRefundDocument,
  getNormalRefundError,
  getNormalRefundHistory,
  getNormalRefunds,
  inspectNormalRefund,
  isNormalRefundManager,
  isNormalRefundReceptionist,
  normalRefundVersionSemantics,
  recordNormalRefundIssue,
  requestNormalRefundInformation,
  verifyNormalRefundAttempt,
  verifyNormalRefundReceiver,
} from '../src/api/normalRefundApi.js'

const originalFetch = globalThis.fetch
const originalConsole = { log: console.log, warn: console.warn, error: console.error }
const requests = []
const refund = {
  id: 31, invoiceId: 700, classId: 81, memberId: 9, origin: 'NormalClassCancellation',
  status: 'Approved', amount: 125000, version: 4, receiverId: 10, bank: 'Example Bank',
  accountNumber: 'SENSITIVE-12345', accountName: 'Member Example', receiverVerified: true,
  dueAt: null, firstDueAt: '2026-11-20T04:00:00Z', overdue: false, issueNote: null,
  centerId: 1,
  attempts: [{ id: 22, status: 'Submitted', receiverId: 10, amount: 125000, bankReference: 'BANK-REF-22', performedAt: '2026-11-10T04:00:00Z', claimedBy: 7, verifiedAt: null, documentIds: [55] }],
}
const history = { receivers: [], verifications: [] }
const actor = { id: 4, role: 'CenterManager', authorities: ['MANAGE_INVOICES'], status: 'Active', authenticated: true, centerId: 1 }
let currentRefund = structuredClone(refund)
let postStatus = 200
let postBodyOverride = null
let resolvePost
let useDelayedPost = false
const response = (body, status = 200, headers = { 'Content-Type': 'application/json' }) =>
  new Response(body instanceof Blob ? body : JSON.stringify(body), { status, headers })

try {
  const logged = []
  console.log = (...args) => logged.push(args.join(' '))
  console.warn = (...args) => logged.push(args.join(' '))
  console.error = (...args) => logged.push(args.join(' '))

  globalThis.fetch = async (url, options) => {
    const path = new URL(String(url)).pathname
    const method = options.method
    const body = options.body ? JSON.parse(options.body) : null
    requests.push({ path, method, body, credentials: options.credentials })
    if (method === 'GET' && path === '/api/normal-refunds') return response([currentRefund])
    if (method === 'GET' && path === '/api/normal-refunds/31') return response(currentRefund)
    if (method === 'GET' && path === '/api/normal-refunds/31/history') return response(history)
    if (method === 'GET' && path === '/api/normal-refunds/31/documents/55') return response(new Blob(['authenticated receipt bytes'], { type: 'application/pdf' }), 200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="receipt-55.pdf"' })
    if (method === 'GET' && path.endsWith('/documents/56')) return response({ message: 'not a file' }, 200, { 'Content-Type': 'application/json' })
    if (method === 'GET' && path.endsWith('/documents/57')) return response({ code: 'MISSING_DOCUMENT' }, 404)
    if (method === 'POST') {
      if (useDelayedPost) return new Promise((resolve) => { resolvePost = resolve })
      const status = postStatus
      const result = postBodyOverride ?? (status >= 400 ? { code: status === 409 ? 'REFUND_VERSION_STALE' : `E${status}`, message: 'refund rejected' } : { ...currentRefund, version: currentRefund.version + 1 })
      if (status >= 400) return response(result, status)
      currentRefund = result
      return response(result, status)
    }
    return response({ message: 'unexpected request' }, 404)
  }

  const list = await getNormalRefunds()
  assert.equal(list.length, 1)
  assert.equal(list[0].amount, 125000)
  assert.equal(list[0].version, 4)
  assert.equal(list[0].accountNumber, 'SENSITIVE-12345')
  assert.deepEqual(await getNormalRefundById(31), currentRefund)
  assert.deepEqual(await getNormalRefundHistory(31), history)
  const file = await getNormalRefundDocument(31, 55)
  assert.equal(file.contentType, 'application/pdf')
  assert.equal(file.contentDisposition, 'attachment; filename="receipt-55.pdf"')
  assert.equal(requests.at(-1).credentials, 'include')
  await assert.rejects(() => getNormalRefundDocument(31, 56), (error) => error.code === 'NORMAL_REFUND_DOCUMENT_UNVERIFIED')
  await assert.rejects(() => getNormalRefundDocument(31, 57), (error) => error.status === 404 && error.code === 'MISSING_DOCUMENT')

  const facts = inspectNormalRefund({ ...refund, amount: 0, version: 0, overdue: false, receiverVerified: false, dueAt: null })
  assert.equal(facts.amount, 0)
  assert.equal(facts.version, 0)
  assert.equal(facts.overdue, false)
  assert.equal(facts.receiverVerified, false)
  assert.equal(facts.dueAt, null)

  assert.deepEqual(buildVerifyNormalRefundReceiverRequest(refund, { source: 'Checked against bank account owner', note: 'Manager verified' }), { version: 4, source: 'Checked against bank account owner', note: 'Manager verified' })
  assert.throws(() => buildVerifyNormalRefundReceiverRequest(refund, { source: ' ' }), (error) => error.code === 'NORMAL_REFUND_SOURCE_REQUIRED')
  assert.throws(() => buildVerifyNormalRefundReceiverRequest(refund, { source: 'x'.repeat(2001) }), (error) => error.code === 'NORMAL_REFUND_SOURCE_TOO_LONG')
  assert.deepEqual(buildApproveNormalRefundRequest(refund), { version: 4 }, 'approve body contains only version')
  assert.throws(() => buildApproveNormalRefundRequest({ ...refund, receiverVerified: false }), (error) => error.code === 'RECEIVER_VERIFICATION_REQUIRED')
  assert.deepEqual(buildNormalRefundNoteRequest(refund, { note: 'Please provide updated receiver details' }), { version: 4, note: 'Please provide updated receiver details' })
  assert.throws(() => buildNormalRefundNoteRequest(refund, { note: ' ' }), (error) => error.code === 'NORMAL_REFUND_NOTE_REQUIRED')

  const successVerification = {
    outcome: 'Success', bankSource: 'Bank portal transfer report', reference: 'BANK-REF-22', amount: 125000,
    receiverId: 10, performedAt: '2026-11-10T04:00:00Z', note: 'Matched independent bank report',
    independentBankCheckConfirmed: true, documentVerified: true,
  }
  assert.deepEqual(buildNormalRefundVerificationRequest(refund, refund.attempts[0], successVerification), {
    version: 4, outcome: 'Success', bankSource: 'Bank portal transfer report', reference: 'BANK-REF-22',
    amount: 125000, receiverId: 10, performedAt: '2026-11-10T04:00:00Z', note: 'Matched independent bank report',
  })
  for (const outcome of ['Pending', 'Failed', 'Reversed']) {
    assert.deepEqual(buildNormalRefundVerificationRequest(refund, refund.attempts[0], { outcome, bankSource: 'Bank portal', note: 'Transfer not confirmed' }), { version: 4, outcome, bankSource: 'Bank portal', note: 'Transfer not confirmed' })
  }
  assert.throws(() => buildNormalRefundVerificationRequest(refund, refund.attempts[0], { ...successVerification, outcome: 'Confirmed' }), (error) => error.code === 'BANK_OUTCOME_INVALID')
  assert.throws(() => buildNormalRefundVerificationRequest(refund, refund.attempts[0], { ...successVerification, documentVerified: false }), (error) => error.code === 'TRANSFER_DOCUMENT_REQUIRED')
  assert.throws(() => buildNormalRefundVerificationRequest(refund, { ...refund.attempts[0], status: 'Claimed' }, successVerification), (error) => error.code === 'NORMAL_REFUND_ATTEMPT_NOT_SUBMITTED')
  assert.throws(() => buildNormalRefundVerificationRequest(refund, refund.attempts[0], { ...successVerification, amount: 124999 }), (error) => error.code === 'BANK_VERIFICATION_MISMATCH')

  const receptionist = { ...actor, role: 'Receptionist' }
  const admin = { ...actor, role: 'Admin' }
  const inactive = { ...actor, status: 'Inactive' }
  const otherCenter = { ...actor, centerId: 2 }
  assert.equal(isNormalRefundManager(actor), true)
  assert.equal(isNormalRefundReceptionist(receptionist), true)
  assert.equal(canReviewNormalRefund(actor), true)
  assert.equal(canReviewNormalRefund(admin), false)
  assert.equal(canActOnNormalRefund(actor, refund), true)
  assert.equal(canActOnNormalRefund(admin, refund), false)
  assert.equal(canActOnNormalRefund(inactive, refund), false)
  assert.equal(canActOnNormalRefund(otherCenter, refund), false)
  assert.equal(canActOnNormalRefund({ ...actor, authorities: [] }, refund), false)
  assert.equal(normalRefundVersionSemantics.review.includes('fresh GET'), true)

  const reset = () => { requests.length = 0; currentRefund = structuredClone(refund); postStatus = 200; postBodyOverride = null }
  reset()
  await verifyNormalRefundReceiver(31, { source: 'Bank record checked' }, { actor })
  assert.deepEqual(requests.map(({ method, path, body }) => [method, path, body]), [
    ['GET', '/api/normal-refunds/31', null],
    ['POST', '/api/normal-refunds/31/verify-receiver', { version: 4, source: 'Bank record checked' }],
  ])

  const actions = [
    [approveNormalRefund, {}, '/api/normal-refunds/31/approve', { version: 4 }],
    [requestNormalRefundInformation, { note: 'Update receiver information' }, '/api/normal-refunds/31/request-information', { version: 4, note: 'Update receiver information' }],
    [recordNormalRefundIssue, { note: 'Account mismatch found' }, '/api/normal-refunds/31/issues', { version: 4, note: 'Account mismatch found' }],
  ]
  for (const [action, input, path, expectedBody] of actions) {
    reset()
    await action(31, input, { actor })
    assert.deepEqual(requests.map(({ method, path: requestPath }) => [method, requestPath]), [['GET', '/api/normal-refunds/31'], ['POST', path]])
    assert.deepEqual(requests.at(-1).body, expectedBody)
  }

  reset()
  await verifyNormalRefundAttempt(31, 22, { outcome: 'Pending', bankSource: 'Bank transfer screen', note: 'Bank has not settled yet' }, { actor })
  assert.deepEqual(requests.at(-1).body, { version: 4, outcome: 'Pending', bankSource: 'Bank transfer screen', note: 'Bank has not settled yet' })
  reset()
  await verifyNormalRefundAttempt(31, 22, successVerification, { actor })
  assert.deepEqual(requests.map(({ method, path }) => [method, path]), [
    ['GET', '/api/normal-refunds/31'], ['GET', '/api/normal-refunds/31/documents/55'], ['POST', '/api/normal-refunds/31/attempts/22/verify'],
  ])
  assert.deepEqual(requests.at(-1).body, {
    version: 4, outcome: 'Success', bankSource: 'Bank portal transfer report', reference: 'BANK-REF-22',
    amount: 125000, receiverId: 10, performedAt: '2026-11-10T04:00:00Z', note: 'Matched independent bank report',
  })
  assert.equal(requests.some(({ path }) => /\/(claim|submit|documents)$/.test(path) && !path.includes('/31/documents/')), false)
  assert.equal('claimNormalRefund' in normalRefundApi, false)
  assert.equal('submitNormalRefundAttempt' in normalRefundApi, false)
  assert.equal('uploadNormalRefundDocument' in normalRefundApi, false)

  for (const unauthorized of [admin, inactive, { ...actor, authorities: [] }]) {
    reset()
    await assert.rejects(() => approveNormalRefund(31, {}, { actor: unauthorized }), (error) => error.code === 'NORMAL_REFUND_MANAGER_ACCESS_REQUIRED')
    assert.equal(requests.length, 0, 'unauthorized actor is blocked before network request')
  }
  reset()
  currentRefund.centerId = 2
  await assert.rejects(() => approveNormalRefund(31, {}, { actor }), (error) => error.code === 'NORMAL_REFUND_MANAGER_ACCESS_REQUIRED')
  assert.equal(requests.filter(({ method }) => method === 'POST').length, 0, 'cross-center refund is blocked before write')

  reset()
  useDelayedPost = true
  const first = verifyNormalRefundReceiver(31, { source: 'Bank account verified' }, { actor })
  const second = verifyNormalRefundReceiver(31, { source: 'Bank account verified' }, { actor })
  for (let index = 0; index < 20 && !resolvePost; index++) await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(requests.filter(({ method }) => method === 'GET').length, 1)
  assert.equal(requests.filter(({ method }) => method === 'POST').length, 1)
  resolvePost(response({ ...refund, receiverVerified: true, version: 5 }))
  await Promise.all([first, second])
  useDelayedPost = false

  for (const status of [400, 401, 403, 404, 409, 500]) {
    reset()
    postStatus = status
    await assert.rejects(() => approveNormalRefund(31, {}, { actor }), (error) => error.status === status)
    assert.equal(requests.filter(({ method }) => method === 'POST').length, 1, `HTTP ${status} POST is not retried`)
  }
  const staleError = getNormalRefundError({ status: 409, code: 'REFUND_VERSION_STALE', details: { currentVersion: 8 } })
  assert.equal(staleError.details.currentVersion, 8)
  assert.equal(staleError.reloadBeforeNextAction, true)
  assert.equal(getNormalRefundError({ status: 0 }).outcomeUncertain, true)
  assert.equal(getNormalRefundError({ status: 500 }).outcomeUncertain, true)

  globalThis.fetch = async () => response({ malformed: true })
  await assert.rejects(() => getNormalRefunds(), /invalid NormalRefundView list/)
  globalThis.fetch = async () => response({ message: 'forbidden' }, 403)
  await assert.rejects(() => getNormalRefunds(), (error) => error.status === 403)
  assert.equal(logged.some((entry) => entry.includes(refund.accountNumber)), false)
} finally {
  globalThis.fetch = originalFetch
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
}

console.log('CM-FIX-16A Normal refund API and logic tests passed')
