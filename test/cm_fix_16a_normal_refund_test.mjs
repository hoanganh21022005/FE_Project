import assert from 'node:assert/strict'
import * as normalRefundApi from '../src/api/normalRefundApi.js'
import {
  approveNormalRefund,
  buildNormalRefundReviewRequest,
  buildNormalRefundVerificationRequest,
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
  id: 31,
  invoiceId: 700,
  classId: 81,
  memberId: 9,
  origin: 'NormalClassCancellation',
  status: 'Approved',
  amount: 125000,
  version: 4,
  receiverId: 10,
  bank: 'Example Bank',
  accountNumber: 'SENSITIVE-12345',
  accountName: 'Member Example',
  receiverVerified: true,
  dueAt: null,
  firstDueAt: '2026-11-20T04:00:00Z',
  overdue: false,
  issueNote: null,
  attempts: [{ id: 22, status: 'Submitted', receiverId: 10, amount: 125000, bankReference: 'BANK-REF-22', performedAt: '2026-11-10T04:00:00Z', claimedBy: 7, verifiedAt: null, documentIds: [55] }],
}
const history = { receivers: [], verifications: [] }
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
    requests.push({ path, method, body: options.body ? JSON.parse(options.body) : null, credentials: options.credentials })

    if (method === 'GET' && path === '/api/normal-refunds') return response([currentRefund])
    if (method === 'GET' && path === '/api/normal-refunds/31') return response(currentRefund)
    if (method === 'GET' && path === '/api/normal-refunds/31/history') return response(history)
    if (method === 'GET' && path === '/api/normal-refunds/31/documents/55') {
      return response(new Blob(['authenticated receipt bytes'], { type: 'application/pdf' }), 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="receipt-55.pdf"',
      })
    }
    if (method === 'GET' && path.endsWith('/documents/56')) {
      return response({ message: 'not a file' }, 200, { 'Content-Type': 'application/json' })
    }
    if (method === 'GET' && path.endsWith('/documents/57')) return response({ code: 'MISSING_DOCUMENT' }, 404)
    if (method === 'POST') {
      if (useDelayedPost) {
        return new Promise((resolve) => { resolvePost = resolve })
      }
      const status = postStatus
      const body = postBodyOverride ?? (status >= 400 ? { code: `E${status}`, message: 'refund rejected', detail: { stale: status === 409 } } : { ...currentRefund, status: 'Approved', version: currentRefund.version + 1 })
      if (status >= 400) return response(body, status)
      currentRefund = body
      return response(body, status)
    }
    return response({ message: 'unexpected request' }, 404)
  }

  const list = await getNormalRefunds()
  assert.equal(list.length, 1)
  assert.equal(list[0].amount, 125000)
  assert.equal(list[0].version, 4)
  assert.equal(list[0].accountNumber, 'SENSITIVE-12345', 'service preserves Backend DTO fields without logging them')
  assert.deepEqual(await getNormalRefundById(31), currentRefund)
  assert.deepEqual(await getNormalRefundHistory(31), history)
  assert.deepEqual(requests.slice(0, 3).map(({ path, method }) => [path, method]), [
    ['/api/normal-refunds', 'GET'],
    ['/api/normal-refunds/31', 'GET'],
    ['/api/normal-refunds/31/history', 'GET'],
  ])

  const file = await getNormalRefundDocument(31, 55)
  assert.equal(file.blob.type, 'application/pdf')
  assert.equal(file.contentType, 'application/pdf')
  assert.equal(file.contentDisposition, 'attachment; filename="receipt-55.pdf"')
  assert.equal(requests.at(-1).credentials, 'include', 'document request uses authenticated session credentials')
  await assert.rejects(() => getNormalRefundDocument(31, 56), (error) => error.code === 'NORMAL_REFUND_DOCUMENT_UNVERIFIED')
  await assert.rejects(() => getNormalRefundDocument(31, 57), (error) => error.status === 404 && error.code === 'MISSING_DOCUMENT')
  await assert.rejects(() => getNormalRefundDocument(0, 55), /positive int32/)

  const facts = inspectNormalRefund({ ...refund, amount: 0, version: 0, overdue: false, receiverVerified: false, issueNote: null, dueAt: null })
  assert.equal(facts.amount, 0)
  assert.equal(facts.version, 0)
  assert.equal(facts.overdue, false)
  assert.equal(facts.receiverVerified, false)
  assert.equal(facts.issueNote, null)
  assert.equal(facts.dueAt, null)
  assert.deepEqual(buildNormalRefundReviewRequest(refund, { source: 'Manager review', note: 'Reviewed' }), {
    version: 4, source: 'Manager review', note: 'Reviewed',
  })
  assert.throws(() => buildNormalRefundReviewRequest({ ...refund, version: null }, { source: 'Manager review' }), (error) => error.code === 'NORMAL_REFUND_VERSION_UNVERIFIED')
  assert.throws(() => buildNormalRefundReviewRequest(refund, {}), (error) => error.code === 'NORMAL_REFUND_SOURCE_UNVERIFIED')
  assert.throws(() => buildNormalRefundReviewRequest(refund, { source: 'Manager review', version: 5 }), /Unsupported request field/)
  assert.throws(() => buildNormalRefundReviewRequest({ ...refund, id: 0 }, { source: 'Manager review' }), /Refund ID does not match/)

  const verification = buildNormalRefundVerificationRequest(refund, refund.attempts[0], {
    outcome: 'Confirmed', bankSource: 'Bank statement', note: 'Matched actual transfer',
  })
  assert.deepEqual(verification, {
    version: 4,
    outcome: 'Confirmed',
    bankSource: 'Bank statement',
    reference: 'BANK-REF-22',
    amount: 125000,
    receiverId: 10,
    performedAt: '2026-11-10T04:00:00Z',
    note: 'Matched actual transfer',
  })
  assert.throws(() => buildNormalRefundVerificationRequest(refund, { ...refund.attempts[0], amount: null }, { outcome: 'Confirmed', bankSource: 'Bank statement' }), (error) => error.code === 'NORMAL_REFUND_AMOUNT_UNVERIFIED')
  assert.throws(() => buildNormalRefundVerificationRequest(refund, refund.attempts[0], { outcome: '', bankSource: 'Bank statement' }), (error) => error.code === 'NORMAL_REFUND_VERIFICATION_UNVERIFIED')

  const manager = { role: 'CenterManager', authorities: ['MANAGE_INVOICES'] }
  const receptionist = { role: 'Receptionist', authorities: ['MANAGE_INVOICES'] }
  assert.equal(isNormalRefundManager(manager), true)
  assert.equal(isNormalRefundReceptionist(receptionist), true)
  assert.equal(canReviewNormalRefund(manager), true)
  assert.equal(canReviewNormalRefund(receptionist), false)
  assert.equal(canReviewNormalRefund({ role: 'Manager', authorities: [] }), false)
  assert.deepEqual(normalRefundVersionSemantics.review.includes('fresh GET'), true)

  requests.length = 0
  currentRefund = structuredClone(refund)
  const verifyReceiverResponse = await verifyNormalRefundReceiver(31, { source: 'Manager console', note: 'Bank details matched' })
  assert.equal(verifyReceiverResponse.status, 'Approved')
  assert.deepEqual(requests.map(({ path, method, body }) => [path, method, body]), [
    ['/api/normal-refunds/31', 'GET', null],
    ['/api/normal-refunds/31/verify-receiver', 'POST', { version: 4, source: 'Manager console', note: 'Bank details matched' }],
  ])
  assert.equal(currentRefund.version, 5, 'only the mocked Backend response advances version')
  assert.equal(refund.version, 4, 'request helper does not mutate prior Backend data')

  const mutationCases = [
    [approveNormalRefund, '/api/normal-refunds/31/approve'],
    [requestNormalRefundInformation, '/api/normal-refunds/31/request-information'],
    [recordNormalRefundIssue, '/api/normal-refunds/31/issues'],
  ]
  for (const [action, expectedPath] of mutationCases) {
    requests.length = 0
    currentRefund = structuredClone(refund)
    await action(31, { source: 'Manager console', note: 'Review note' })
    assert.deepEqual(requests.map(({ path, method }) => [path, method]), [
      ['/api/normal-refunds/31', 'GET'], [expectedPath, 'POST'],
    ])
    assert.deepEqual(requests.at(-1).body, { version: 4, source: 'Manager console', note: 'Review note' })
  }

  requests.length = 0
  currentRefund = structuredClone(refund)
  await verifyNormalRefundAttempt(31, 22, { outcome: 'Confirmed', bankSource: 'Bank statement', note: 'Matched actual transfer' })
  assert.deepEqual(requests.map(({ path, method }) => [path, method]), [
    ['/api/normal-refunds/31', 'GET'],
    ['/api/normal-refunds/31/attempts/22/verify', 'POST'],
  ])
  assert.deepEqual(requests.at(-1).body, verification)
  assert.deepEqual(Object.keys(requests.at(-1).body).sort(), ['amount', 'bankSource', 'note', 'outcome', 'performedAt', 'receiverId', 'reference', 'version'].sort())
  assert.equal(requests.some(({ path }) => /\/(claim|submit|documents)$/.test(path)), false, 'Manager API exports no Receptionist claim/submit/upload workflow')
  assert.equal('claimNormalRefund' in normalRefundApi, false)
  assert.equal('submitNormalRefundAttempt' in normalRefundApi, false)
  assert.equal('uploadNormalRefundDocument' in normalRefundApi, false)

  requests.length = 0
  currentRefund = structuredClone(refund)
  useDelayedPost = true
  const firstApprove = approveNormalRefund(31, { source: 'Manager console', note: 'same write' })
  const secondApprove = approveNormalRefund(31, { source: 'Manager console', note: 'same write' })
  for (let index = 0; index < 20 && !resolvePost; index++) await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(requests.filter(({ method }) => method === 'GET').length, 1, 'duplicate in-flight calls share the pre-write authoritative read')
  assert.equal(requests.filter(({ method }) => method === 'POST').length, 1, 'identical in-flight financial writes are coalesced')
  resolvePost(response({ ...refund, status: 'Approved', version: 5 }))
  await Promise.all([firstApprove, secondApprove])
  useDelayedPost = false

  for (const status of [400, 401, 403, 404, 409, 500]) {
    requests.length = 0
    currentRefund = structuredClone(refund)
    postStatus = status
    await assert.rejects(() => approveNormalRefund(31, { source: 'Manager console' }), (error) => error.status === status && error.code === `E${status}` && error.details?.detail?.stale === (status === 409))
    assert.equal(requests.filter(({ method }) => method === 'POST').length, 1, `HTTP ${status} write is not retried`)
  }
  postStatus = 200
  const staleError = getNormalRefundError({ status: 409, code: 'STALE', message: 'Stale version', details: { currentVersion: 8 } })
  assert.equal(staleError.details.currentVersion, 8)
  assert.equal(staleError.reloadBeforeNextAction, true)
  assert.equal(getNormalRefundError({ status: 0 }).outcomeUncertain, true)
  assert.equal(getNormalRefundError({ status: 500 }).outcomeUncertain, true)

  globalThis.fetch = async () => response({ malformed: true })
  await assert.rejects(() => getNormalRefunds(), /invalid NormalRefundView list/)
  globalThis.fetch = async () => response({ message: 'forbidden' }, 403)
  await assert.rejects(() => getNormalRefunds(), (error) => error.status === 403)
  assert.equal(logged.some((entry) => entry.includes(refund.accountNumber)), false, 'sensitive account number is never written to console')

  const actionExports = [
    verifyNormalRefundReceiver,
    approveNormalRefund,
    requestNormalRefundInformation,
    recordNormalRefundIssue,
    verifyNormalRefundAttempt,
  ]
  assert.equal(actionExports.length, 5)
  assert.equal(requests.some(({ path }) => /\/normal-refunds\/\d+\/(claim|attempts\/\d+\/submit|attempts\/\d+\/documents)$/.test(path)), false)
} finally {
  globalThis.fetch = originalFetch
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
}

console.log('CM-FIX-16A Normal refund API and logic tests passed')
