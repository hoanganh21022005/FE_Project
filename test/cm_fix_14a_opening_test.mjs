import assert from 'node:assert/strict'
import { confirmNormalClassOpening } from '../src/api/managerApi.js'
import {
  evaluateNormalClassOpening,
  getFirstNormalClassSession,
  getNormalClassOpeningError,
  getOpeningReasonRequirement,
  parseVietnamSessionStart,
  validNormalClassOpeningRequest,
} from '../src/api/normalClassOpening.js'

const session = {
  id: 90,
  classId: 71,
  sessionDate: '2026-01-02',
  startTime: '10:00:00',
  status: 'Scheduled',
  coachId: 8,
  roomId: 3,
}
const classItem = {
  id: 71,
  classType: 'Normal',
  status: 'open',
  apiStatus: 'Open',
  coachId: 8,
  minCapacity: 2,
  openingConfirmedAt: null,
  changePending: false,
}
const enrollments = [
  { status: 'Registered', paymentStatus: 'Paid' },
  { status: 'Registered', paymentStatus: 'Paid' },
  { status: 'Pending', paymentStatus: 'Paid' },
  { status: 'Registered', paymentStatus: 'Pending' },
]
const authorities = ['MANAGE_CLASSES']

assert.equal(parseVietnamSessionStart(session), Date.UTC(2026, 0, 2, 3))
assert.equal(parseVietnamSessionStart({ ...session, sessionDate: '2026-02-30' }), null)
assert.equal(getFirstNormalClassSession([{ ...session, status: 'Cancelled' }, session]).session.id, 90)

const outsideReasonWindow = getOpeningReasonRequirement({
  firstSession: session,
  now: new Date('2026-01-01T02:59:00Z'),
})
assert.equal(outsideReasonWindow.reasonRequired, false)
const insideReasonWindow = getOpeningReasonRequirement({
  firstSession: session,
  now: new Date('2026-01-01T03:01:00Z'),
})
assert.equal(insideReasonWindow.reasonRequired, true)
assert.equal(getOpeningReasonRequirement({ firstSession: null }).known, false)

const regularWindow = evaluateNormalClassOpening({
  classItem, sessions: [session], enrollments, authorities,
  now: new Date('2026-01-01T02:59:00Z'),
})
assert.equal(regularWindow.paidRegisteredCount, 2, 'pending enrollment/payment do not count')
assert.equal(regularWindow.reasonRequired, false, '48-hour member cutoff does not gate manager confirmation')
assert.equal(regularWindow.canSubmit, true)
assert.equal(regularWindow.eligibilityStatus, 'unverified', 'Backend eligibility remains authoritative')
assert.deepEqual(regularWindow.payload, {})

const lateWithoutReason = evaluateNormalClassOpening({
  classItem, sessions: [session], enrollments, authorities,
  now: new Date('2026-01-01T03:01:00Z'),
})
assert.equal(lateWithoutReason.reasonRequired, true)
assert.equal(lateWithoutReason.canSubmit, false)
assert.ok(lateWithoutReason.blockers.some((item) => item.includes('lý do')))

const lateWithReason = evaluateNormalClassOpening({
  classItem, sessions: [session], enrollments, authorities, reason: 'Xác nhận sát giờ',
  now: new Date('2026-01-01T03:01:00Z'),
})
assert.equal(lateWithReason.canSubmit, true)
assert.deepEqual(lateWithReason.payload, { reason: 'Xác nhận sát giờ' })

const pendingOnly = evaluateNormalClassOpening({
  classItem, sessions: [session], enrollments: enrollments.slice(2), authorities,
  now: new Date('2026-01-01T02:00:00Z'),
})
assert.equal(pendingOnly.paidRegisteredCount, 0)
assert.equal(pendingOnly.canSubmit, false)

const alreadyStarted = evaluateNormalClassOpening({
  classItem, sessions: [session], enrollments, authorities,
  now: new Date('2026-01-02T03:00:00Z'),
})
assert.equal(alreadyStarted.canSubmit, false)
assert.ok(alreadyStarted.blockers.some((item) => item.includes('đã bắt đầu')))

assert.equal(evaluateNormalClassOpening({ classItem: { ...classItem, classType: 'Advanced' }, sessions: [session], enrollments, authorities }).canSubmit, false)
assert.equal(evaluateNormalClassOpening({ classItem: { ...classItem, openingConfirmedAt: '2026-01-01T00:00:00Z' }, sessions: [session], enrollments, authorities }).canSubmit, false)
assert.equal(evaluateNormalClassOpening({ classItem: { ...classItem, changePending: true }, sessions: [session], enrollments, authorities }).canSubmit, false)
assert.equal(evaluateNormalClassOpening({ classItem, sessions: [session], enrollments, authorities: [] }).canSubmit, false)
assert.equal(evaluateNormalClassOpening({ classItem, sessions: null, enrollments, authorities }).eligibilityStatus, 'unverified')
const missingMinimum = evaluateNormalClassOpening({ classItem: { ...classItem, minCapacity: null }, sessions: [session], enrollments, authorities, now: new Date('2026-01-01T02:00:00Z') })
assert.equal(missingMinimum.minimum, null)
assert.equal(missingMinimum.eligibilityStatus, 'unverified')
assert.deepEqual(validNormalClassOpeningRequest({ reason: '  reviewed  ' }), { reason: 'reviewed' })
assert.deepEqual(validNormalClassOpeningRequest({ reason: '' }), {})
assert.throws(() => validNormalClassOpeningRequest({ reason: 'ok', unexpected: true }), /Unsupported/)
assert.equal(getNormalClassOpeningError({ status: 409, code: 'STALE_VERSION', message: 'Conflict' }).status, 409)

const originalFetch = globalThis.fetch
const requests = []
let resolveFetch
try {
  globalThis.fetch = (url, options) => {
    requests.push({ url: String(url), method: options.method, body: JSON.parse(options.body) })
    return new Promise((resolve) => { resolveFetch = resolve })
  }
  const firstCall = confirmNormalClassOpening(71, { reason: '  approved  ' })
  const duplicateCall = confirmNormalClassOpening(71, { reason: 'different reason' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(requests.length, 1, 'concurrent duplicate requests are coalesced')
  assert.equal(new URL(requests[0].url).pathname, '/api/classes/71/confirm-opening')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, { reason: 'approved' })
  const response = { id: 71, status: 'Open', openingConfirmedAt: '2026-01-01T03:30:00Z' }
  resolveFetch(new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  assert.deepEqual(await firstCall, response)
  assert.deepEqual(await duplicateCall, response)

  await assert.rejects(() => confirmNormalClassOpening(0, {}), /positive integer/)
  await assert.rejects(() => confirmNormalClassOpening(71, { reason: 'ok', extra: 1 }), /Unsupported/)

  for (const status of [400, 401, 403, 404, 409, 500]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ code: `E${status}`, message: 'rejected' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
    await assert.rejects(() => confirmNormalClassOpening(71, {}), (error) => error.status === status)
  }
} finally {
  globalThis.fetch = originalFetch
}

console.log('CM-FIX-14A Normal opening API and logic tests passed')
